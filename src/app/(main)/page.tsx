'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/hooks';
import { memberSpaceUrl } from '@/lib/constants';
import { useCloudStore } from '@/store/cloud';
import { useAuthStore } from '@/store';
import { debugLog } from '@/lib/logger';
import {
  LandingNav,
  LandingHero,
} from '@/components/landing';

const LandingFeatures = dynamic(() => import('@/components/landing').then((mod) => mod.LandingFeatures));
const LandingSafety = dynamic(() => import('@/components/landing').then((mod) => mod.LandingSafety));
const LandingChannels = dynamic(() => import('@/components/landing').then((mod) => mod.LandingChannels));
const LandingCTA = dynamic(() => import('@/components/landing').then((mod) => mod.LandingCTA));
const LandingFooter = dynamic(() => import('@/components/landing').then((mod) => mod.LandingFooter));

export default function HomePage() {
  const { isAuthenticated } = useAuth();
  const cloudSubdomain = useCloudStore((s) => s.subdomain);
  const [checkedSession, setCheckedSession] = useState(false);
  const [exchangingToken, setExchangingToken] = useState(false);
  const redirectingRef = useRef(false);

  // --- Step 0: Exchange transfer token if present in URL ---
  // When arriving from mawadao.com after login, the URL contains
  // ?auth_token=TRANSFER_TOKEN&state=RANDOM. Call the token-exchange
  // API to set the auth cookie, then reload with a clean URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authToken = params.get('auth_token');
    if (!authToken) return;

    setExchangingToken(true);
    debugLog('[Home] auth_token found in URL — exchanging via API…');
    fetch('/api/auth/token-exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token: authToken }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        debugLog('[Home] token-exchange response:', res.status, data);
        if (res.ok && data?.success) {
          // Cookie is now set. Reload with a clean URL.
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete('auth_token');
          cleanUrl.searchParams.delete('state');
          debugLog('[Home] Token exchanged — reloading with clean URL:', cleanUrl.toString());
          window.location.replace(cleanUrl.toString());
        } else {
          console.error('[Home] token-exchange failed:', data);
          setExchangingToken(false);
        }
      })
      .catch((err) => {
        console.error('[Home] token-exchange error:', err);
        setExchangingToken(false);
      });
  }, []);

  // Verify the server-side session matches the cached subdomain.
  // Always checks — catches stale localStorage from a previous user.
  useEffect(() => {
    if (exchangingToken || checkedSession) return;
    debugLog('[Home] Checking me-session for subdomain…');
    fetch('/api/auth/me-session', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        debugLog('[Home] me-session data:', JSON.stringify(data));
        if (data?.authenticated) {
          // Session cookie is valid — sync subdomain from server truth.
          if (data.subdomain) {
            useCloudStore.getState().setSubdomain(data.subdomain);
          } else if (cloudSubdomain) {
            // User is authenticated but has no subdomain — clear stale cached one.
            debugLog('[Home] Clearing stale cached subdomain:', cloudSubdomain);
            useCloudStore.getState().setSubdomain(null);
          }
        } else {
          // Cookie missing or invalid — session is truly stale.
          if (cloudSubdomain) {
            debugLog('[Home] Clearing stale cached subdomain:', cloudSubdomain);
            useCloudStore.getState().setSubdomain(null);
          }
          const { user: staleUser, apiKey: staleKey } = useAuthStore.getState();
          if (staleUser || staleKey) {
            // Don't call logout() here — it wipes ALL localStorage (via localStorage.clear())
            // and destroys in-progress onboarding state. This fires as a false-positive when
            // registerUser()/loginUser() persists {user,apiKey} to localStorage before
            // finalizeEmailPasswordAuth() has had a chance to set the httpOnly cookie.
            //
            // Recovery path: if there's a stored API key, try email-session to re-issue
            // the cookie. On failure, do a targeted soft-clear of only auth state.
            debugLog('[Home] Stale auth — attempting session recovery with stored API key');
            const recoveryKey = staleKey;
            if (recoveryKey) {
              fetch('/api/auth/email-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ apiKey: recoveryKey }),
              })
                .then((r) => (r.ok ? r.json() : null))
                .then((recovered) => {
                  if (recovered?.success) {
                    debugLog('[Home] Session recovered — reloading to re-validate');
                    window.location.replace(window.location.href);
                  } else {
                    debugLog('[Home] Recovery failed — soft-clearing auth state');
                    useAuthStore.setState({ agent: null, user: null, apiKey: null, token: null, error: null });
                    useCloudStore.getState().clearCloud();
                    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
                  }
                })
                .catch(() => {
                  useAuthStore.setState({ agent: null, user: null, apiKey: null, token: null, error: null });
                  useCloudStore.getState().clearCloud();
                  fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
                });
            } else {
              // No API key to recover with — soft-clear only auth-specific state.
              debugLog('[Home] No recovery key — soft-clearing auth state');
              useAuthStore.setState({ agent: null, user: null, apiKey: null, token: null, error: null });
              useCloudStore.getState().clearCloud();
              fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
            }
          }
        }
      })
      .catch(() => { })
      .finally(() => setCheckedSession(true));
  }, [exchangingToken, checkedSession, cloudSubdomain]);

  // Authenticated users with a workspace go to the member space.
  // Waits for me-session check to complete to avoid redirecting with a stale session.
  useEffect(() => {
    if (!checkedSession) return;
    if (isAuthenticated && cloudSubdomain && !redirectingRef.current) {
      redirectingRef.current = true;
      const target = memberSpaceUrl(cloudSubdomain);
      debugLog('[Home] Redirecting authenticated user to the member space:', target);
      window.location.href = target;
    }
  }, [isAuthenticated, cloudSubdomain, checkedSession]);

  // Unauthenticated users OR authenticated users still onboarding: show landing page
  // The GuidedSetup wizard (inside LandingHero) detects auth state and resumes
  // at the subdomain step for logged-in users who haven't provisioned yet.
  return (
    <div className="min-h-screen bg-background">
      <LandingNav />
      <LandingHero />
      <LandingFeatures />
      <LandingSafety />
      <LandingChannels />
      <LandingCTA />
      <LandingFooter />
    </div>
  );
}
