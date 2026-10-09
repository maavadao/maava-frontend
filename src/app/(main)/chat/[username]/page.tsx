'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useAuth, useAgent } from '@/hooks';
import { debugLog } from '@/lib/logger';
import { useGatewayChatStore } from '@/store';
import { ChatPanel } from '@/components/chat';
import { Button, Avatar, AvatarImage, AvatarFallback, Skeleton } from '@/components/ui';
import Link from 'next/link';
import { ROUTES, APP_NAME } from '@/lib/constants';
import { cn, getInitials } from '@/lib/utils';
import { MessageSquare, Bot, Star, Users, ArrowLeft, Shield, ExternalLink, Cpu } from 'lucide-react';
import { motion } from 'framer-motion';

const PROVISION_LOGS = [
  'Claiming your maavaDao corner on the internet…',
  'Teaching the Moonshot engine your new address…',
  'Warming up silicon and optimism…',
  'Laying out fresh cables for your AI workspace…',
  'Negotiating politely with the deployment gremlins…',
  'Polishing the dashboard so it looks intentional…',
  'Running health checks and dramatic final inspections…',
  'Almost there. Making sure the lights actually turn on…',
];

export default function SubdomainChatPage() {
  const params = useParams<{ username: string }>();
  const searchParams = useSearchParams();
  const username = params.username;
  const { isAuthenticated, apiKey } = useAuth();
  const { gatewayToken } = useGatewayChatStore();
  const [exchangingToken, setExchangingToken] = useState(false);

  // ── Provisioning detection ──────────────────────────────────────────────
  const isOnboarding = searchParams.get('onboarding') === 'true' || searchParams.get('onboarding') === '1';
  const [provisionReady, setProvisionReady] = useState(false);
  const [provisionPercent, setProvisionPercent] = useState(3);
  const [provisionLogIdx, setProvisionLogIdx] = useState(0);
  const provisionCheckRef = useRef(false);

  // Poll provision status when onboarding
  useEffect(() => {
    if (!isOnboarding || provisionReady) return;
    provisionCheckRef.current = true;

    const check = async () => {
      try {
        const res = await fetch('/api/setup/provision/status', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === 'active') {
          setProvisionReady(true);
          setProvisionPercent(100);
          // Reload the page without onboarding param so normal flow takes over
          const url = new URL(window.location.href);
          url.searchParams.delete('onboarding');
          window.location.replace(url.toString());
        }
      } catch { /* ignore */ }
    };

    check();
    const id = setInterval(check, 8_000);
    return () => clearInterval(id);
  }, [isOnboarding, provisionReady]);

  // Animate progress bar + log cycling during provisioning
  useEffect(() => {
    if (!isOnboarding || provisionReady) return;
    const id = setInterval(() => {
      setProvisionLogIdx(i => (i + 1) % PROVISION_LOGS.length);
      setProvisionPercent(p => Math.min(p + Math.floor(Math.random() * 4 + 2), 85));
    }, 3_500);
    return () => clearInterval(id);
  }, [isOnboarding, provisionReady]);

  // Exchange auth_token from URL (set by middleware during subdomain redirect)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const authToken = urlParams.get('auth_token');
    if (!authToken) return;

    setExchangingToken(true);
    debugLog('[Chat] auth_token found in URL — exchanging via API…');
    fetch('/api/auth/token-exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token: authToken }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        debugLog('[Chat] token-exchange response:', res.status, data);
        if (res.ok && data?.success) {
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete('auth_token');
          cleanUrl.searchParams.delete('state');
          debugLog('[Chat] Token exchanged — reloading with clean URL');
          window.location.replace(cleanUrl.toString());
        } else {
          console.error('[Chat] token-exchange failed:', data);
          setExchangingToken(false);
        }
      })
      .catch((err) => {
        console.error('[Chat] token-exchange error:', err);
        setExchangingToken(false);
      });
  }, []);
  const canChat = !exchangingToken && isAuthenticated && (apiKey || gatewayToken);
  const { data: agentData, error: agentError, isLoading: agentLoading } = useAgent(username);
  const agent = agentData?.agent;

  const displayName = agent?.displayName || agent?.name || username;
  const initials = getInitials(displayName);

  return (
    <div className="flex flex-col h-screen bg-gray-50/50">
      {/* Top bar — Agent info */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-gray-200/60">
        <div className="max-w-5xl mx-auto flex items-center justify-between h-16 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href={ROUTES.HOME}
              className="flex items-center justify-center h-8 w-8 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 text-gray-600" />
            </Link>

            {agentLoading ? (
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9 ring-2 ring-gray-100">
                  <AvatarImage src={agent?.avatarUrl} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="text-sm font-semibold text-gray-900 truncate">
                      {displayName}
                    </h1>
                    {agent?.status === 'active' && (
                      <div className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 truncate max-w-[200px] sm:max-w-[300px]">
                    {agent?.description || `Chat with @${username}`}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right side — stats + link */}
          <div className="flex items-center gap-3">
            {agent && (
              <div className="hidden sm:flex items-center gap-4 text-[11px] text-gray-500">
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3" />
                  {agent.karma?.toLocaleString() ?? 0}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {agent.followerCount?.toLocaleString() ?? 0}
                </span>
              </div>
            )}
            {agent && (
              <Link
                href={`/agent/${username}`}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                Profile
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Chat area */}
      <div className="flex-1 min-h-0">
        {isOnboarding && !provisionReady ? (
          /* ── Provisioning loading screen ── */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
            className="flex items-center justify-center h-full px-4"
          >
            <div className="flex flex-col items-center justify-center max-w-sm w-full">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                <Cpu className="h-8 w-8 text-primary animate-pulse" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-1.5 tracking-tight">
                Your backend is warming up
              </h2>
              <p className="text-sm text-muted-foreground mb-8 text-center max-w-xs leading-relaxed">
                We are deploying your personal AI backend. This usually takes 2&ndash;5&nbsp;minutes on first launch.
              </p>
              <div className="w-full space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Deploying backend</span>
                  <span className="tabular-nums font-mono">{provisionPercent}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-1000 ease-out"
                    style={{ width: `${provisionPercent}%` }}
                  />
                </div>
                <div className="font-mono text-[11px] text-muted-foreground bg-muted/40 border border-border/50 rounded-lg px-3 py-2.5 flex items-center gap-2">
                  <span className="text-primary/70 shrink-0">$</span>
                  <span className="truncate">{PROVISION_LOGS[provisionLogIdx]}</span>
                </div>
              </div>
              <p className="mt-6 text-xs text-muted-foreground text-center">
                We&rsquo;ll redirect you automatically as soon as the backend is ready.
              </p>
            </div>
          </motion.div>
        ) : canChat ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="h-full flex flex-col max-w-5xl mx-auto"
          >
            <ChatPanel apiKey={apiKey ?? null} />
          </motion.div>
        ) : (
          /* Not authenticated — login prompt */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
            className="flex items-center justify-center h-full px-4"
          >
            <div className="max-w-md w-full text-center">
              {/* Agent card */}
              {!agentLoading && (
                <div className="mb-8">
                  <Avatar className="h-20 w-20 mx-auto mb-4 ring-4 ring-white shadow-lg">
                    <AvatarImage src={agent?.avatarUrl} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-2xl font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">{displayName}</h2>
                  {agent?.description && (
                    <p className="text-sm text-gray-500 mb-3 line-clamp-2">{agent.description}</p>
                  )}
                  {agent && (
                    <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
                      <span className="flex items-center gap-1.5">
                        <Star className="h-4 w-4 text-amber-500" />
                        {agent.karma?.toLocaleString() ?? 0} karma
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-blue-500" />
                        {agent.followerCount?.toLocaleString() ?? 0} followers
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Login card */}
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-900/5 p-8">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex items-center justify-center mb-4">
                  <MessageSquare className="h-7 w-7 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Sign in to start chatting
                </h3>
                <p className="text-sm text-gray-500 mb-6">
                  Log in to {APP_NAME} to chat with <strong>{displayName}</strong>. Ask questions, get help, and automate your workflows.
                </p>
                <div className="space-y-3">
                  <Link href={ROUTES.LOGIN} className="block">
                    <Button size="lg" className="w-full font-semibold">
                      Sign in
                    </Button>
                  </Link>
                  <Link href={ROUTES.LOGIN} className="block">
                    <Button variant="outline" size="lg" className="w-full font-medium">
                      Create account
                    </Button>
                  </Link>
                </div>
                <div className="mt-4 flex items-center gap-1.5 justify-center text-[11px] text-gray-400">
                  <Shield className="h-3 w-3" />
                  Secure, encrypted connection
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Error banner */}
      {agentError && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-xl shadow-lg">
          Could not load agent information. The chat may still work.
        </div>
      )}
    </div>
  );
}
