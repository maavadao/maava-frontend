'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { finalizeEmailPasswordAuth } from '@/lib/email-auth-session';
import { debugLog, debugWarn } from '@/lib/logger';
import { useAuthStore } from '@/store';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import { AlertCircle, User, Lock } from 'lucide-react';
import { APP_NAME, memberSpaceUrl } from '@/lib/constants';

/** Sanitize redirect URL — only allow same-origin or *.mawadao.com */
function sanitizeRedirect(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw, window.location.origin);
    const host = url.hostname.toLowerCase();
    if (host === 'mawadao.com' || host.endsWith('.mawadao.com')) {
      // Force HTTPS for production
      url.protocol = 'https:';
      return url.toString();
    }
    // Same-origin relative path
    if (url.origin === window.location.origin) return url.pathname + url.search;
  } catch { /* invalid URL — ignore */ }
  return null;
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginUser, isLoading } = useAuthStore();
  const [error, setError] = useState('');
  const redirectTo = searchParams.get('redirect');
  const redirectingRef = useRef(false);

  /** Safe redirect — prevents double-navigations */
  const safeRedirect = (url: string, label: string) => {
    if (redirectingRef.current) {
      debugLog(`[Login] safeRedirect blocked (already redirecting). Target: ${url}`);
      return;
    }
    redirectingRef.current = true;
    debugLog(`[Login] ${label} → navigating to:`, url);
    window.location.href = url;
  };

  // If already authenticated (httpOnly cookie), redirect away immediately
  useEffect(() => {
    debugLog('[Login] mount — checking me-session for existing auth…');
    const controller = new AbortController();

    fetch('/api/auth/me-session', { credentials: 'include', signal: controller.signal })
      .then((r) => {
        debugLog('[Login] me-session response status:', r.status);
        return r.ok ? r.json() : null;
      })
      .then(async (data) => {
        debugLog('[Login] me-session data:', JSON.stringify(data));
        if (data?.authenticated && data.subdomain) {
          debugLog('[Login] Already authenticated with subdomain:', data.subdomain, '— fetching transfer token');

          // Throttle: don't retry within 10 seconds (prevents fast loops)
          const storageKey = `mawadao-redirect-${data.subdomain}`;
          const lastAttempt = sessionStorage.getItem(storageKey);
          if (lastAttempt && Date.now() - Number(lastAttempt) < 10_000) {
            console.error('[Login] Redirect attempted too recently — likely a loop. Last attempt:', new Date(Number(lastAttempt)).toISOString());
            setError(
              'Unable to reach your workspace. Please wait a few seconds and refresh, or try opening your workspace directly at ' + memberSpaceUrl(data.subdomain),
            );
            return;
          }
          sessionStorage.setItem(storageKey, String(Date.now()));

          try {
            // Fetch a transfer token so the member space can establish its own cookie
            const ttRes = await fetch('/api/auth/transfer-token', { credentials: 'include' });
            debugLog('[Login] transfer-token response status:', ttRes.status);
            if (ttRes.ok) {
              const ttData = await ttRes.json();
              const targetUrl = new URL(memberSpaceUrl(data.subdomain));
              targetUrl.searchParams.set('auth_token', ttData.transferToken);
              targetUrl.searchParams.set('state', crypto.randomUUID());
              debugLog('[Login] Redirecting to the member space with transfer token:', targetUrl.toString());
              window.location.href = targetUrl.toString();
              return;
            } else {
              console.error('[Login] transfer-token failed:', ttRes.status, await ttRes.text().catch(() => ''));
            }
          } catch (err) {
            debugWarn('[Login] Transfer token fetch failed, falling back to direct redirect:', err);
          }
          // Fallback: redirect without transfer token (relies on .mawadao.com cookie)
          debugLog('[Login] Falling back to direct member-space redirect (no transfer token)');
          window.location.href = memberSpaceUrl(data.subdomain);
        } else if (data?.authenticated) {
          debugLog('[Login] Already authenticated (no subdomain) — redirect to /');
          window.location.href = '/';
        } else {
          debugLog('[Login] Not authenticated — showing login form');
        }
      })
      .catch((err) => {
        if ((err as Error).name !== 'AbortError') {
          console.error('[Login] me-session check failed:', err);
        }
      });

    return () => controller.abort();
  }, [router]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Username/email + password login
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (redirectingRef.current) return;
    if (!identifier.trim() || !password.trim()) {
      setError('Please enter your username/email and password');
      return;
    }
    try {
      debugLog('[Login] Attempting loginUser…');
      await loginUser(identifier.trim(), password);
      const storedApiKey = useAuthStore.getState().apiKey;
      if (!storedApiKey) {
        throw new Error('No API key available after authentication');
      }

      debugLog('[Login] loginUser succeeded, establishing frontend session...');
      const { destination } = await finalizeEmailPasswordAuth({ apiKey: storedApiKey, redirectTo });

      if (destination.external) {
        debugLog('[Login] Success — redirecting to subdomain:', destination.url);
        safeRedirect(destination.url, 'Email auth redirect');
        return;
      }

      debugLog('[Login] Success — routing to onboarding:', destination.url);
      redirectingRef.current = true;
      router.replace(destination.url);
    } catch (err) {
      console.error('[Login] Failed:', err);
      setError((err as Error).message || 'Invalid credentials');
    }
  };

  const handleGoogleSignIn = () => {
    // The callback page handles subdomain lookup and redirect on its own,
    // so no need to pass the redirect URL through the OAuth flow.
    window.location.href = '/api/auth/google';
  };

  return (
    <Card className="w-full max-w-md shadow-elevated">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-2xl font-bold">Welcome to {APP_NAME}</CardTitle>
        <CardDescription className="text-base mt-2">
          Sign in to discover and deploy AI agents for your team
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 pt-4">
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* 1. Google — primary CTA */}
        <Button
          type="button"
          variant="outline"
          className="w-full h-11 text-sm font-medium gap-3 border-2 hover:bg-accent"
          onClick={handleGoogleSignIn}
          disabled={isLoading}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Continue with Google
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">or</span>
          </div>
        </div>

        {/* 2. Email / Password form */}
        <form onSubmit={handlePasswordLogin} className="space-y-3">
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Username or email"
              className="w-full rounded-md border bg-background px-10 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              autoComplete="username"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full rounded-md border bg-background px-10 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" className="w-full h-11" disabled={isLoading}>
            {isLoading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="text-sm text-center text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/auth/register" className="text-primary hover:underline">Create one</Link>
        </p>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">or</span>
          </div>
        </div>

        {/* 3. Microsoft — disabled, coming soon */}
        <div className="relative flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1 h-11 text-sm font-medium gap-3 border-2 opacity-50 cursor-not-allowed"
            disabled
          >
            <svg className="h-4 w-4" viewBox="0 0 23 23">
              <path fill="#f35325" d="M1 1h10v10H1z" />
              <path fill="#81bc06" d="M12 1h10v10H12z" />
              <path fill="#05a6f0" d="M1 12h10v10H1z" />
              <path fill="#ffba08" d="M12 12h10v10H12z" />
            </svg>
            Continue with Microsoft
          </Button>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted px-2 py-0.5 rounded-full whitespace-nowrap">Coming soon</span>
        </div>

        {/* Fallback: API key login for development / agent accounts */}
        <DeveloperLogin />

        <p className="text-xs text-center text-muted-foreground leading-relaxed">
          By signing in, you agree to our{' '}
          <a href="/terms" className="text-primary hover:underline">Terms of Service</a>
          {' '}and{' '}
          <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>
        </p>
      </CardContent>
    </Card>
  );
}

function DeveloperLogin() {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');

  const handleApiKeyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!apiKey.trim()) {
      setError('Please enter an API key');
      return;
    }
    try {
      await login(apiKey.trim());
      router.push('/');
    } catch (err) {
      setError((err as Error).message || 'Invalid API key');
    }
  };

  if (!showApiKey) {
    return (
      <button
        type="button"
        onClick={() => setShowApiKey(true)}
        className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        Developer? Sign in with API key
      </button>
    );
  }

  return (
    <form onSubmit={handleApiKeyLogin} className="space-y-3">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <input
        type="text"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder="Enter your API key"
        className="w-full rounded-md border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        autoFocus
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" className="flex-1" disabled={isLoading}>
          {isLoading ? 'Signing in…' : 'Sign in'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setShowApiKey(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
