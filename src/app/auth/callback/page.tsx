'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store';
import { useCloudStore } from '@/store/cloud';
import { api } from '@/lib/api';
import { Loader2 } from 'lucide-react';
import { MEMBER_SPACE_URL } from '@/lib/constants';

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <Loader2 className="w-16 h-16 mx-auto animate-spin text-primary" />
          <h2 className="text-xl font-semibold text-gray-900">Loading...</h2>
        </div>
      </div>
    }>
      <AuthCallbackInner />
    </Suspense>
  );
}

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');

  // Unregister service workers to prevent stale cache issues
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((r) => r.unregister());
      });
    }
  }, []);

  useEffect(() => {
    const processCallback = async () => {
      const token = searchParams.get('token');
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const errorParam = searchParams.get('error');

      if (errorParam) {
        setError(`Authentication failed: ${errorParam}`);
        setTimeout(() => router.push('/auth/login'), 3000);
        return;
      }

      if (!token && !code) {
        setError('No authentication code received');
        setTimeout(() => router.push('/auth/login'), 3000);
        return;
      }

      try {
        // 0. Clear stale cloud state from any previous user session.
        //    Prevents stale subdomain redirect if switching accounts.
        useCloudStore.getState().clearCloud();
        useCloudStore.getState().initCloudMode();

        // 1. Exchange the OIDC code or legacy auth token via the server-side session route.
        const sessionRes = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(code ? { code, state } : { token }),
          credentials: 'include',
        });

        if (!sessionRes.ok) {
          throw new Error('Failed to establish session');
        }

        const sessionData = await sessionRes.json();
        const { subdomain: cookieSubdomain, userId, email, pendingSubdomain } = sessionData.user as {
          subdomain: string | null;
          userId: string;
          email: string;
          pendingSubdomain: string | null;
        };
        const transferToken = sessionData.transferToken as string | null;
        const accessToken = (sessionData.token as string | null) || token;

        if (!accessToken) {
          throw new Error('No access token available after session exchange');
        }

        // 2. Store the access token in Zustand so API calls can include it in headers.
        useAuthStore.setState({ token: accessToken });
        api.setApiKey(accessToken);

        // 3. Fetch rich user profile (displayName, avatarUrl, username) — non-fatal.
        let userData = {
          id: userId,
          email,
          displayName: '',
          avatarUrl: '',
          username: email?.split('@')[0] || '',
          isActive: true,
          isVerified: true,
          createdAt: new Date().toISOString(),
        };

        try {
          const meRes = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (meRes.ok) {
            const meData = await meRes.json();
            if (meData.success && meData.data) {
              userData = {
                id: meData.data.id || userId,
                email: meData.data.email || email,
                displayName: meData.data.displayName || '',
                avatarUrl: meData.data.avatarUrl || '',
                username: meData.data.username || userData.username,
                isActive: true,
                isVerified: true,
                createdAt: new Date().toISOString(),
              };
            }
          }
        } catch {
          // Non-fatal: display info unavailable, continue with redirect.
        }

  useAuthStore.setState({ user: userData, apiKey: accessToken });

        // 4. Redirect based on tenant status.
        if (cookieSubdomain) {
          // Existing user with a fully provisioned tenant → go to the member space.
          // Pass the transfer token in the URL so the member space can establish its
          // own session cookie without relying on cross-domain cookie sharing.
          const subdomainUrl = new URL(MEMBER_SPACE_URL);
          if (transferToken) {
            subdomainUrl.searchParams.set('auth_token', transferToken);
            subdomainUrl.searchParams.set('state', crypto.randomUUID());
          }
          window.location.href = subdomainUrl.toString();
        } else if (pendingSubdomain) {
          // Seeded user with a tenant row but no backend deployed → onboarding with pre-filled subdomain.
          router.push(`/?step=subdomain&suggested=${encodeURIComponent(pendingSubdomain)}`);
        } else {
          // New user or no tenant yet → go straight to subdomain setup.
          router.push('/?step=subdomain');
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        setError('Failed to complete authentication. Please try again.');
        setTimeout(() => router.push('/auth/login'), 3000);
      }
    };

    processCallback();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-4">
        {error ? (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center">
              <span className="text-2xl">&#x274C;</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Authentication Failed</h2>
            <p className="text-gray-600">{error}</p>
            <p className="text-sm text-gray-400">Redirecting...</p>
          </>
        ) : (
          <>
            <Loader2 className="w-16 h-16 mx-auto animate-spin text-primary" />
            <h2 className="text-xl font-semibold text-gray-900">Completing sign in...</h2>
            <p className="text-gray-600">Please wait while we set up your account</p>
          </>
        )}
      </div>
    </div>
  );
}
