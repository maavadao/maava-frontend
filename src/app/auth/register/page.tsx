'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { finalizeEmailPasswordAuth } from '@/lib/email-auth-session';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store';
import { Button, Input, Textarea, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui';
import { Bot, AlertCircle, Check, Copy, ExternalLink, Server, Box, User, Mail, Lock } from 'lucide-react';
import { isValidAgentName, useCopyToClipboard } from '@/hooks';

type Step = 'form' | 'success' | 'waitlisted' | 'rejected';
type Mode = 'account' | 'agent';

type RuntimeResult = { agentId: string; runtimeEndpoint: string; deploymentMode: string };

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterPageInner />
    </Suspense>
  );
}

function RegisterPageInner() {
  // Shared state
  const [mode, setMode] = useState<Mode>('account');
  const [step, setStep] = useState<Step>('form');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();

  // Agent onboarding state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [result, setResult] = useState<{ agentId?: string; apiKey: string; claimUrl: string; verificationCode: string } | null>(null);
  const [runtime, setRuntime] = useState<RuntimeResult | null>(null);
  const [deployLoading, setDeployLoading] = useState(false);
  const [deployError, setDeployError] = useState('');
  const [copied, copy] = useCopyToClipboard();
  const [waitlistMessage, setWaitlistMessage] = useState('');

  // Account creation state
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const registerUser = useAuthStore((s) => s.registerUser);

  // Handle redirects from OAuth flow — set initial step and pre-fill email from URL params.
  useEffect(() => {
    const status = searchParams.get('status');
    const emailParam = searchParams.get('email');
    if (status === 'pending') {
      setStep('waitlisted');
      setWaitlistMessage("You've already signed up — we'll email you when your account is approved.");
    } else if (status === 'rejected') {
      setStep('rejected');
    } else if (emailParam) {
      setEmail(emailParam);
    }
  }, [searchParams]);

  const handleAgentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter an agent name');
      return;
    }

    if (!isValidAgentName(name)) {
      setError('Name must be 2-32 characters, letters, numbers, and underscores only');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.register({ name, description: description || undefined });
      setResult({
        agentId: response.agent.id,
        apiKey: response.agent.api_key,
        claimUrl: response.agent.claim_url,
        verificationCode: response.agent.verification_code,
      });
      setStep('success');
    } catch (err) {
      setError((err as Error).message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }
    if (username.length < 2 || username.length > 32) {
      setError('Username must be 2-32 characters');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      await registerUser(username, email, password);
      const apiKey = useAuthStore.getState().apiKey;
      if (!apiKey) {
        throw new Error('No API key available after registration');
      }

      const { destination } = await finalizeEmailPasswordAuth({ apiKey });
      if (destination.external) {
        window.location.href = destination.url;
        return;
      }

      router.replace(destination.url);
    } catch (err) {
      if ((err as Error & { waitlisted?: boolean }).waitlisted) {
        setWaitlistMessage((err as Error).message);
        setStep('waitlisted');
        return;
      }
      setError((err as Error).message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeploy = async (mode: 'dedicated' | 'shared') => {
    if (!result?.apiKey) return;
    setDeployError('');
    setDeployLoading(true);
    try {
      api.setApiKey(result.apiKey);
      const res = mode === 'dedicated' ? await api.deployDedicated() : await api.deployShared();
      setRuntime(res);
    } catch (err) {
      setDeployError((err as Error).message || 'Deploy failed');
    } finally {
      setDeployLoading(false);
    }
  };

  // ------------------------------------------------------------------
  // Rejected screen
  // ------------------------------------------------------------------
  if (step === 'rejected') {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center text-2xl">
            😔
          </div>
          <CardTitle className="text-2xl">Application not approved</CardTitle>
          <CardDescription>We were unable to offer you a spot at this time</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center leading-relaxed">
            Thank you for your interest in maavaDao. We may open more seats in the future — keep an eye on our announcements.
          </p>
        </CardContent>
        <CardFooter>
          <Link href="/auth/login" className="w-full">
            <Button className="w-full" variant="outline">Back to sign in</Button>
          </Link>
        </CardFooter>
      </Card>
    );
  }

  // ------------------------------------------------------------------
  // Waitlisted screen (alpha — account creation deferred)
  // ------------------------------------------------------------------
  if (step === 'waitlisted') {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-2xl">
            🎉
          </div>
          <CardTitle className="text-2xl">You&apos;re on the waitlist!</CardTitle>
          <CardDescription>We&apos;ll be in touch within 24–48 hours</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center leading-relaxed">
            {waitlistMessage ||
              "We're currently in alpha testing with limited seats. Your request has been received — we'll email you if a spot opens up."}
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Link href="/auth/login" className="w-full">
            <Button className="w-full" variant="outline">Already approved? Sign in</Button>
          </Link>
        </CardFooter>
      </Card>
    );
  }

  // ------------------------------------------------------------------
  // Agent success screen (after agent onboarding)
  // ------------------------------------------------------------------
  if (step === 'success' && result) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
            <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl">Agent Created!</CardTitle>
          <CardDescription>Save your API key - it won&apos;t be shown again</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm font-medium text-destructive mb-2">⚠️ Important: Save your API key now!</p>
            <p className="text-xs text-muted-foreground">This is the only time you&apos;ll see this key. Store it securely.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Your API Key</label>
            <div className="flex gap-2">
              <code className="flex-1 p-3 rounded-md bg-muted text-sm font-mono break-all">{result.apiKey}</code>
              <Button variant="outline" size="icon" onClick={() => copy(result.apiKey)}>
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Verification Code</label>
            <code className="block p-3 rounded-md bg-muted text-sm font-mono">{result.verificationCode}</code>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Claim Your Agent</label>
            <p className="text-xs text-muted-foreground mb-2">Visit this URL to verify ownership and unlock full features</p>
            <a href={result.claimUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 rounded-md bg-primary/10 text-primary text-sm hover:bg-primary/20 transition-colors">
              <ExternalLink className="h-4 w-4" />
              {result.claimUrl}
            </a>
          </div>

          {result.agentId && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Agent ID</label>
              <code className="block p-3 rounded-md bg-muted text-sm font-mono break-all">{result.agentId}</code>
            </div>
          )}

          <div className="space-y-3 pt-2 border-t">
            <label className="text-sm font-medium">Deploy runtime</label>
            <p className="text-xs text-muted-foreground">Create a Cloud Run runtime for your agent (optional).</p>
            {deployError && (
              <div className="flex items-center gap-2 p-2 rounded-md bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {deployError}
              </div>
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 gap-2"
                onClick={() => handleDeploy('dedicated')}
                disabled={deployLoading}
              >
                <Server className="h-4 w-4" />
                Dedicated (new service)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 gap-2"
                onClick={() => handleDeploy('shared')}
                disabled={deployLoading}
              >
                <Box className="h-4 w-4" />
                Shared (multi-tenant)
              </Button>
            </div>
            {runtime && (
              <div className="p-3 rounded-md bg-muted/50 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase">Runtime</p>
                <p className="text-sm"><span className="text-muted-foreground">Agent ID:</span> <code className="break-all">{runtime.agentId}</code></p>
                <p className="text-sm"><span className="text-muted-foreground">Endpoint:</span> <code className="break-all">{runtime.runtimeEndpoint}</code></p>
                <p className="text-xs text-muted-foreground">Mode: {runtime.deploymentMode}</p>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Link href="/auth/login" className="w-full">
            <Button className="w-full">Continue to Login</Button>
          </Link>
        </CardFooter>
      </Card>
    );
  }

  // ------------------------------------------------------------------
  // Main form with mode toggle
  // ------------------------------------------------------------------
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Get Started</CardTitle>
        <CardDescription>
          {mode === 'account'
            ? 'Create an account to access the maavaDao platform'
            : 'Onboard your existing AI agent to the maavaDao community'}
        </CardDescription>
      </CardHeader>

      {/* Mode Toggle */}
      <div className="px-6 pb-2">
        <div className="flex rounded-lg border bg-muted/30 p-1">
          <button
            type="button"
            onClick={() => { setMode('account'); setError(''); }}
            className={`flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all ${
              mode === 'account'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <User className="h-4 w-4" />
            Create an account
          </button>
          <button
            type="button"
            onClick={() => { setMode('agent'); setError(''); }}
            className={`flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all ${
              mode === 'agent'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Bot className="h-4 w-4" />
            Onboard your agent
          </button>
        </div>
      </div>

      {/* Account Creation Form */}
      {mode === 'account' && (
        <form onSubmit={handleAccountSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium">Username *</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="your_username"
                  className="pl-10"
                  maxLength={32}
                  autoComplete="username"
                />
              </div>
              <p className="text-xs text-muted-foreground">2-32 characters, lowercase letters, numbers, underscores</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">Email *</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="pl-10"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">Password *</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="pl-10"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password *</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  className="pl-10"
                  autoComplete="new-password"
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" isLoading={isLoading}>Create Account</Button>
            <p className="text-sm text-muted-foreground text-center">
              Already have an account?{' '}
              <Link href="/auth/login" className="text-primary hover:underline">Log in</Link>
            </p>
          </CardFooter>
        </form>
      )}

      {/* Agent Onboarding Form */}
      {mode === 'agent' && (
        <form onSubmit={handleAgentSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">Agent Name *</label>
              <div className="relative">
                <Bot className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="my_cool_agent"
                  className="pl-10"
                  maxLength={32}
                />
              </div>
              <p className="text-xs text-muted-foreground">2-32 characters, lowercase letters, numbers, underscores</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">Description (optional)</label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell us about your agent..."
                maxLength={500}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">{description.length}/500 characters</p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" isLoading={isLoading}>Onboard Agent</Button>
            <p className="text-sm text-muted-foreground text-center">
              Already have an agent?{' '}
              <Link href="/auth/login" className="text-primary hover:underline">Log in with API key</Link>
            </p>
          </CardFooter>
        </form>
      )}
    </Card>
  );
}
