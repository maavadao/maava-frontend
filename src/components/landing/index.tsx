'use client';

import * as React from 'react';
import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button, Input } from '@/components/ui';
import { MawadaoLogo } from '@/components/layout';
import { ROUTES, MEMBER_SPACE_HOST, memberSpaceUrl } from '@/lib/constants';
import { CONTACT_URL } from '@/lib/pricing';
import { REGISTRY_REPO } from '@/lib/registry';
import { useAuthStore, useSetupStore } from '@/store';
import { useCloudStore } from '@/store/cloud';
import { cn } from '@/lib/utils';
import { finalizeEmailPasswordAuth } from '@/lib/email-auth-session';
import {
  ArrowRight,
  Check,
  Compass,
  GraduationCap,
  HeartHandshake,
  Languages,
  Lightbulb,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  Store,
  User,
  UserRound,
  Globe,
  X,
} from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';
import { FaMicrosoft } from 'react-icons/fa6';
import { SiTelegram, SiDiscord, SiSlack, SiWhatsapp } from 'react-icons/si';

import { motion, AnimatePresence } from 'framer-motion';

const MISSION_URL = 'https://github.com/mawadao/mawadao/blob/main/MISSION.md';

// Content settles into place once as it scrolls in; critically damped, no bounce.
const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { type: 'spring', bounce: 0, duration: 0.6 },
} as const;

// =============================================================================
// Navigation — translucent bar; content scrolls underneath it
// =============================================================================
export function LandingNav() {
  return (
    <header className="material-nav sticky top-0 z-50 w-full border-b border-border/40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex h-14 items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <MawadaoLogo />
          <nav aria-label="Main" className="hidden md:flex items-center gap-1">
            {[
              { href: ROUTES.MARKETPLACE, label: 'Marketplace' },
              { href: ROUTES.TOOLS, label: 'AI tools' },
              { href: '#what-you-can-do', label: 'What you can do' },
              { href: '#safety', label: 'Safety' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-2 rounded-full text-footnote font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <a
          href="#how-it-works"
          className="press inline-flex items-center gap-1.5 px-4 h-11 rounded-full text-footnote font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Create your workspace
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </a>
      </div>
    </header>
  );
}

// =============================================================================
// Guided Setup — Multi-step Wizard (with Interests step)
// =============================================================================





// Smooth page transition variants
const pageVariants = {
  initial: { opacity: 0, y: 8, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -8, filter: 'blur(4px)' },
};

const pageTransition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
  mass: 0.8,
};

function RainbowBar() {
  return (
    <div className="absolute bottom-0 left-0 right-0 h-[3px] overflow-hidden rounded-b-2xl">
      <div
        className="h-full w-[200%] animate-shimmer"
        style={{
          background:
            'linear-gradient(90deg, #818cf8, #c084fc, #f472b6, #fb923c, #facc15, #34d399, #60a5fa, #818cf8)',
        }}
      />
    </div>
  );
}

// Provider options for step 3
const PROVIDER_OPTIONS = [
  { id: 'moonshot', name: 'Moonshot', description: 'Default — mawa optimised engine', badge: 'Default' },
  { id: 'openai', name: 'OpenAI', description: 'GPT-4o and GPT-4.1 models', badge: null },
  { id: 'anthropic', name: 'Claude', description: 'Claude Sonnet and Opus models', badge: null },
  { id: 'google', name: 'Gemini', description: 'Google Gemini 2.5 models', badge: null },
] as const;

// Step progress bar — fixed to 3 steps (Account → Subdomain → Provider)
function StepProgress({ current, labels: customLabels }: { current: number; labels?: string[] }) {
  const total = 3;
  const labels = customLabels || ['Account', 'Workspace', 'AI model'];
  return (
    <div className="flex items-center justify-between mb-8">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Step {current} of {total}
      </span>
      <div className="flex items-center gap-1.5 flex-1 mx-6">
        {Array.from({ length: total }, (_, i) => i + 1).map((s) => (
          <div key={s} className="flex-1 h-[3px] rounded-full overflow-hidden bg-muted">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: s <= current ? '100%' : '0%' }}
              transition={{
                duration: 0.5,
                ease: [0.32, 0.72, 0, 1],
                delay: s <= current ? (s - 1) * 0.1 : 0,
              }}
            />
          </div>
        ))}
      </div>
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{labels[current - 1] || ''}</span>
    </div>
  );
}

// Google icon — exact brand logo
function GoogleIcon() {
  return <FcGoogle className="w-5 h-5" />;
}

// Microsoft icon — exact brand logo
function MicrosoftIcon() {
  return <FaMicrosoft className="w-5 h-5 text-[#00A4EF]" />;
}



function GuidedSetup() {
  const { user, setUser, setApiKey } = useAuthStore();
  const {
    setupStep,
    setSetupStep,
    selectedProvider,
    setSelectedProvider,
    completeSetup,
  } = useSetupStore();

  const searchParams = useSearchParams();

  type WizardStepLocal = 'intro' | 'account' | 'email-auth' | 'subdomain' | 'provider' | 'waitlisted';
  const urlStep = searchParams.get('step');

  // If redirected back from OAuth with ?step=subdomain and user is logged in
  const initialStep: WizardStepLocal = React.useMemo(() => {
    // Check if user already has a subdomain (from cloud store persistence).
    // If so, skip subdomain selection entirely — they're already provisioned.
    const existingSubdomain = useCloudStore.getState().subdomain;
    if (user && existingSubdomain) return 'subdomain';
    if (urlStep === 'subdomain' && user) return 'subdomain';
    // Already logged in — go to subdomain step
    if (user) return 'subdomain';
    return 'intro';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [step, setStepLocal] = React.useState<WizardStepLocal>(initialStep);
  const [direction, setDirection] = React.useState<1 | -1>(1);

  // Reset to login step when user logs out (in case they log out without a page reload)
  React.useEffect(() => {
    if (!user) setStepLocal('intro');
  }, [user]);

  // If logged in, check session for existing subdomain and redirect if found
  React.useEffect(() => {
    if (!user) return;
    const existingSub = useCloudStore.getState().subdomain;
    if (existingSub) {
      window.location.href = memberSpaceUrl(existingSub);
      return;
    }
    // Check httpOnly cookie for subdomain
    fetch('/api/auth/me-session', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.subdomain) {
          useCloudStore.getState().setSubdomain(data.subdomain);
          window.location.href = memberSpaceUrl(data.subdomain);
        }
      })
      .catch(() => {});
  }, [user]);

  // Email auth state
  const [authMode, setAuthMode] = React.useState<'login' | 'register'>('register');
  const [emailForm, setEmailForm] = React.useState({ email: '', password: '', username: '', confirmPassword: '' });
  const [emailLoading, setEmailLoading] = React.useState(false);
  const [emailError, setEmailError] = React.useState('');
  const [waitlistMessage, setWaitlistMessage] = React.useState('');

  // Subdomain selection state
  const suggestedSubdomain = searchParams.get('suggested') || '';
  const [subdomain, setSubdomain] = React.useState(suggestedSubdomain);
  const [subdomainChecking, setSubdomainChecking] = React.useState(false);
  const [subdomainAvailable, setSubdomainAvailable] = React.useState<boolean | null>(null);
  const [subdomainReason, setSubdomainReason] = React.useState('');
  const [subdomainError, setSubdomainError] = React.useState('');
  const [provisioning, setProvisioning] = React.useState(false);
  const [sessionJwt, setSessionJwt] = React.useState<string | null>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (suggestedSubdomain) {
      setSubdomain(suggestedSubdomain);
    }
  }, [suggestedSubdomain]);

  // Generate subdomain suggestion from user's email
  const suggestSubdomainFromEmail = React.useCallback((email: string): string => {
    if (!email || !email.includes('@')) return '';
    const localPart = email.split('@')[0].toLowerCase();
    // Clean: keep only letters, numbers, hyphens
    const clean = localPart.replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '');
    if (!clean || clean.length < 2) return '';
    // Add short random suffix for uniqueness
    const suffix = Math.random().toString(36).slice(2, 5);
    const base = clean.slice(0, 50);
    return `${base}-${suffix}`;
  }, []);

  // Auth store persistence can hydrate after the component mounts. When that
  // happens, honor the current URL step and move the wizard forward so email
  // auth lands on subdomain selection just like OAuth.
  React.useEffect(() => {
    if (!user) return;

    const existingSubdomain = useCloudStore.getState().subdomain;
    if (existingSubdomain) return;

    // Suggest subdomain from user's email if we don't have one yet
    if (!subdomain && user.email) {
      const suggested = suggestSubdomainFromEmail(user.email);
      if (suggested) setSubdomain(suggested);
    }

    // Only pull the user forward to 'subdomain' if they're on an earlier step.
    // Never reset a later step (e.g. 'provider') back to 'subdomain'.
    if (step === 'intro' || step === 'account' || step === 'email-auth') {
      setStepLocal('subdomain');
    }
  }, [user, urlStep, step, subdomain, suggestSubdomainFromEmail]);

  const goTo = React.useCallback(
    (target: WizardStepLocal, dir: 1 | -1 = 1) => {
      setDirection(dir);
      setStepLocal(target);
      if (['intro'].includes(target)) {
        setSetupStep(target as any);
      }
    },
    [setSetupStep],
  );

  const handleStartBuilding = () => {
    if (user) {
      // If user already has a subdomain, redirect to their tenant
      const existingSub = useCloudStore.getState().subdomain;
      if (existingSub) {
        window.location.href = memberSpaceUrl(existingSub);
        return;
      }
      goTo('subdomain');
    } else {
      goTo('account');
    }
  };

  // ── Google OAuth ──────────────────────────────────────────
  const handleGoogleSignIn = React.useCallback(() => {
    // Route through frontend API so auth host is resolved at runtime.
    window.location.href = '/api/auth/google';
  }, []);

  // ── Email auth ────────────────────────────────────────────
  const handleEmailAuth = React.useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    const { email, password, username: formUsername, confirmPassword } = emailForm;

    if (!email.trim() || !email.includes('@')) {
      setEmailError('Please enter a valid email');
      return;
    }
    if (password.length < 8) {
      setEmailError('Password must be at least 8 characters');
      return;
    }

    setEmailLoading(true);
    try {
      if (authMode === 'register') {
        if (!formUsername.trim() || formUsername.length < 2) {
          setEmailError('Username must be at least 2 characters');
          setEmailLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setEmailError('Passwords do not match');
          setEmailLoading(false);
          return;
        }
        await useAuthStore.getState().registerUser(formUsername, email, password);
      } else {
        await useAuthStore.getState().loginUser(email, password);
      }

      const storedApiKey = useAuthStore.getState().apiKey;
      if (!storedApiKey) {
        throw new Error('No API key available after authentication');
      }

      const { session, destination } = await finalizeEmailPasswordAuth({ apiKey: storedApiKey });

      if (session.token) {
        setSessionJwt(session.token);
      }

      if (destination.external) {
        window.location.href = destination.url;
        return;
      }

      if (destination.pendingSubdomain) {
        setSubdomain(destination.pendingSubdomain);
      }

      // Auth successful, no subdomain yet — go to subdomain setup
      // Suggest subdomain from email address
      const suggestedFromEmail = suggestSubdomainFromEmail(emailForm.email);
      if (suggestedFromEmail && !subdomain) {
        setSubdomain(suggestedFromEmail);
      }
      goTo('subdomain');
    } catch (err) {
      if ((err as Error & { waitlisted?: boolean }).waitlisted) {
        setWaitlistMessage((err as Error).message);
        goTo('waitlisted');
        return;
      }
      setEmailError((err as Error).message || 'Authentication failed');
    } finally {
      setEmailLoading(false);
    }
  }, [emailForm, authMode, goTo]);

  // ── Username check (debounced) ────────────────────────────
  const isValidSubdomain = React.useCallback((name: string) => {
    return /^[a-z][a-z0-9-]{1,61}[a-z0-9]$/.test(name) && name.length >= 3 && name.length <= 63;
  }, []);

  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!subdomain || !isValidSubdomain(subdomain)) {
      setSubdomainAvailable(null);
      setSubdomainReason('');
      return;
    }
    setSubdomainChecking(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/setup/check-subdomain?subdomain=${encodeURIComponent(subdomain)}`);
        const data = await res.json();
        setSubdomainAvailable(data.available);
        setSubdomainReason(data.reason || '');
      } catch {
        setSubdomainAvailable(null);
        setSubdomainReason('');
      } finally {
        setSubdomainChecking(false);
      }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [subdomain, isValidSubdomain]);

  const redirectToProvisionedTenant = React.useCallback((targetSubdomain: string) => {
    completeSetup();
    useCloudStore.getState().setSubdomain(targetSubdomain);
    window.location.href = `${memberSpaceUrl(targetSubdomain)}?onboarding=true`;
  }, [completeSetup]);

  const handleSubdomainProvision = React.useCallback(async () => {
    setSubdomainError('');
    if (!isValidSubdomain(subdomain)) {
      setSubdomainError('Use 3–63 lowercase letters, numbers or hyphens, starting with a letter.');
      return;
    }
    // Block only when explicitly marked unavailable (not when null/unchecked)
    if (subdomainAvailable === false) {
      setSubdomainError('This name is already taken');
      return;
    }
    setProvisioning(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sessionJwt) {
        headers['Authorization'] = `Bearer ${sessionJwt}`;
      }
      const res = await fetch('/api/setup/provision', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ subdomain, provider: selectedProvider }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Provisioning failed' }));
        throw new Error(errData.error || `Error ${res.status}`);
      }
      // Redirect immediately; chat page owns the provisioning loading UI.
      redirectToProvisionedTenant(subdomain);
    } catch (err) {
      setSubdomainError((err as Error).message);
      goTo('provider', -1);
    } finally {
      setProvisioning(false);
    }
  }, [subdomain, subdomainAvailable, isValidSubdomain, goTo, sessionJwt, selectedProvider, redirectToProvisionedTenant]);

  // Step progress: account(1) → subdomain(2) → provider(3) → provision → redirect to chat
  const totalSteps = 3;
  const stepLabels = ['Account', 'Workspace', 'AI model'];
  const currentProgress =
    step === 'account' || step === 'email-auth' ? 1 :
    step === 'subdomain' ? 2 :
    step === 'provider' ? 3 : 0;

  return (
    <div id="how-it-works" className="max-w-lg mx-auto w-full">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
        className="relative bg-background/80 dark:bg-card/80 backdrop-blur-xl rounded-2xl border border-border/60 shadow-[0_8px_60px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_60px_rgba(0,0,0,0.3)] overflow-hidden"
      >
        <div className="flex items-center justify-between px-8 pt-7 pb-0">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Guided Setup</span>
          <span className="text-[11px] font-medium bg-blue-50/80 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full border border-blue-100/60 dark:border-blue-800/40">
            Free for education
          </span>
        </div>

        <div className="px-8 pt-5 pb-8 min-h-[420px] flex flex-col">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            {/* ── INTRO ─────────────────────────────────────────────── */}
            {step === 'intro' && (
              <motion.div
                key="intro"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={pageTransition}
                className="flex flex-col flex-1"
              >
                <h3 className="text-title text-foreground mb-1.5">
                  Set up your AI agent in 3&nbsp;steps
                </h3>
                <p className="text-[13px] text-muted-foreground mb-7 leading-relaxed">
                  Create your account, pick a name, choose your AI provider, and your workspace is ready.
                </p>

                <div className="space-y-4 mb-8 flex-1">
                  {[
                    { n: 1, t: 'Create your account', d: 'Quick & free — Google, Microsoft, or email.' },
                    { n: 2, t: 'Choose your workspace name', d: `Your space will be ${MEMBER_SPACE_HOST}/your-name.` },
                    { n: 3, t: 'Select your AI provider', d: 'Moonshot, OpenAI, Claude, or Gemini.' },
                  ].map((s, i) => (
                    <motion.div
                      key={s.n}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.08, duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                      className="flex items-start gap-4"
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-[13px] font-semibold text-primary-foreground">
                        {s.n}
                      </div>
                      <div className="pt-0.5">
                        <h4 className="text-sm font-semibold text-foreground">{s.t}</h4>
                        <p className="text-[13px] text-muted-foreground">{s.d}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <Button
                  size="lg"
                  onClick={handleStartBuilding}
                  className="w-full gap-2 h-12 text-[15px] font-semibold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-200 shadow-sm hover:shadow-lg"
                >
                  Start Building
                  <ArrowRight className="h-4 w-4" />
                </Button>

                <p className="text-[11px] text-center text-muted-foreground mt-4">
                  Free for students, schools, orphanages and educators.
                </p>
              </motion.div>
            )}

            {/* ── ACCOUNT — Create account (Step 1) ──────────────── */}
            {step === 'account' && (
              <motion.div
                key="account"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={pageTransition}
                className="flex flex-col flex-1"
              >
                <StepProgress current={1} labels={stepLabels} />

                <div className="text-center mb-6">
                  <h3 className="text-title text-foreground mb-1">
                    Get started free
                  </h3>
                  <p className="text-[13px] text-muted-foreground">
                    Create your account — takes less than a minute.
                  </p>
                </div>

                <div className="space-y-2.5 mb-auto flex-1">
                  <motion.button
                    type="button"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.35 }}
                    onClick={handleGoogleSignIn}
                    className="w-full flex items-center justify-center gap-3 h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/30 hover:shadow-lg hover:shadow-blue-500/40 transition-all duration-200 text-[14px] font-semibold"
                  >
                    <FcGoogle className="w-5 h-5" />
                    Continue with Google
                  </motion.button>

                  <motion.button
                    type="button"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15, duration: 0.35 }}
                    onClick={() => goTo('email-auth')}
                    className="w-full flex items-center justify-center gap-3 h-11 rounded-xl border border-border bg-card hover:bg-muted hover:border-border/80 hover:shadow-sm transition-all duration-200 text-[14px] font-semibold text-foreground"
                  >
                    <Mail className="w-5 h-5 text-muted-foreground" />
                    Continue with Email
                  </motion.button>

                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.35 }}
                    className="relative"
                  >
                    <button
                      type="button"
                      disabled
                      className="w-full flex items-center justify-center gap-3 h-11 rounded-xl border border-border bg-card opacity-50 cursor-not-allowed text-[14px] font-semibold text-foreground"
                    >
                      <FaMicrosoft className="w-5 h-5 text-[#00A4EF]" />
                      Continue with Microsoft
                    </button>
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted px-2 py-0.5 rounded-full whitespace-nowrap">
                      Coming soon
                    </span>
                  </motion.div>
                </div>

                <div className="flex items-center justify-between mt-5 pt-2">
                  <button
                    type="button"
                    onClick={() => goTo('intro', -1)}
                    className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2 -ml-3 rounded-lg hover:bg-muted"
                  >
                    Back
                  </button>

                </div>
              </motion.div>
            )}

            {/* ── EMAIL AUTH — Inline Register / Login form ────────── */}
            {step === 'email-auth' && (
              <motion.div
                key="email-auth"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={pageTransition}
                className="flex flex-col flex-1"
              >
                <StepProgress current={1} labels={stepLabels} />

                <h3 className="text-title text-foreground mb-1 text-center">
                  {authMode === 'register' ? 'Create your account' : 'Welcome back'}
                </h3>
                <p className="text-[13px] text-muted-foreground mb-5 text-center">
                  {authMode === 'register' ? 'Set up your mawa account' : 'Sign in to your existing account'}
                </p>

                {/* Mode toggle */}
                <div className="flex rounded-lg border bg-muted/30 p-1 mb-5">
                  <button
                    type="button"
                    onClick={() => { setAuthMode('register'); setEmailError(''); }}
                    className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                      authMode === 'register' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Register
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAuthMode('login'); setEmailError(''); }}
                    className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                      authMode === 'login' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Sign in
                  </button>
                </div>

                <form onSubmit={handleEmailAuth} className="space-y-3 flex-1 flex flex-col">
                  {emailError && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/10 text-destructive text-[13px]">
                      <X className="h-4 w-4 shrink-0" />
                      {emailError}
                    </div>
                  )}

                  {authMode === 'register' && (
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={emailForm.username}
                        onChange={(e) => setEmailForm((f) => ({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                        placeholder="Username"
                        className="pl-10"
                        maxLength={32}
                        autoComplete="username"
                      />
                    </div>
                  )}

                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      value={emailForm.email}
                      onChange={(e) => setEmailForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="Email address"
                      className="pl-10"
                      autoComplete="email"
                    />
                  </div>

                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="password"
                      value={emailForm.password}
                      onChange={(e) => setEmailForm((f) => ({ ...f, password: e.target.value }))}
                      placeholder="Password"
                      className="pl-10"
                      autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                    />
                  </div>

                  {authMode === 'register' && (
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="password"
                        value={emailForm.confirmPassword}
                        onChange={(e) => setEmailForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                        placeholder="Confirm password"
                        className="pl-10"
                        autoComplete="new-password"
                      />
                    </div>
                  )}

                  <div className="flex-1" />

                  <Button
                    type="submit"
                    disabled={emailLoading}
                    className="w-full gap-2 h-11 rounded-xl text-[14px] font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {emailLoading ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Please wait...</>
                    ) : (
                      <>{authMode === 'register' ? 'Create Account' : 'Sign In'}<ArrowRight className="h-4 w-4" /></>
                    )}
                  </Button>

                  {/* Google alternative */}
                  <div className="relative my-1">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">or</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    className="w-full flex items-center justify-center gap-2.5 h-10 rounded-xl border border-border bg-card hover:bg-muted transition-all text-[13px] font-medium text-foreground"
                  >
                    <GoogleIcon />
                    Continue with Google
                  </button>
                </form>

                <div className="flex items-center justify-center mt-4 pt-2">
                  <button
                    type="button"
                    onClick={() => goTo('account', -1)}
                    className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-muted"
                  >
                    &larr; Back
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── WAITLISTED — Alpha waitlist confirmation ──────── */}
            {step === 'waitlisted' && (
              <motion.div
                key="waitlisted"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={pageTransition}
                className="flex flex-col flex-1 items-center justify-center text-center gap-4"
              >
                <div className="mx-auto h-16 w-16 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-3xl">
                  🎉
                </div>
                <div>
                  <h3 className="text-title text-foreground mb-2">
                    You&apos;re on the waitlist!
                  </h3>
                  <p className="text-[13px] text-muted-foreground leading-relaxed max-w-xs mx-auto">
                    {waitlistMessage ||
                      "We're in alpha testing with limited seats. We'll review your application and email you within 24–48 hours if a spot opens up."}
                  </p>
                </div>
                <p className="text-[13px] text-muted-foreground">
                  Already approved?{' '}
                  <button
                    type="button"
                    onClick={() => { setAuthMode('login'); goTo('email-auth'); }}
                    className="text-primary underline-offset-4 hover:underline font-medium"
                  >
                    Sign in
                  </button>
                </p>
              </motion.div>
            )}

            {/* ── SUBDOMAIN — Choose your subdomain (post-auth) ──── */}
            {step === 'subdomain' && (
              <motion.div
                key="subdomain"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={pageTransition}
                className="flex flex-col flex-1"
              >
                  <StepProgress current={2} labels={stepLabels} />

                <div className="text-center mb-4">
                  <div className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Globe className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-title text-foreground mb-1">
                    Choose your workspace name
                  </h3>
                  <p className="text-footnote text-muted-foreground">
                    Your space will be {MEMBER_SPACE_HOST}/{subdomain || 'your-name'}
                  </p>
                </div>

                <div className="flex flex-col flex-1">
                  <div className="space-y-2 mb-4">
                    <div className="relative">
                      <Input
                        value={subdomain}
                        onChange={(e) => {
                          const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                          setSubdomain(val);
                          setSubdomainError('');
                        }}
                        placeholder="your-name"
                        maxLength={63}
                        autoFocus
                        autoComplete="off"
                        className={cn(
                          'pr-10 text-base',
                          subdomainAvailable === true && subdomain && 'border-emerald-500 focus-visible:ring-emerald-500/20',
                          subdomainAvailable === false && 'border-red-500 focus-visible:ring-red-500/20'
                        )}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {subdomainChecking && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                        {!subdomainChecking && subdomainAvailable === true && subdomain && (
                          <Check className="h-4 w-4 text-emerald-500" />
                        )}
                        {!subdomainChecking && subdomainAvailable === false && (
                          <X className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      3-63 characters. Start with a letter, lowercase letters, numbers, and hyphens only.
                    </p>

                    {!subdomainChecking && subdomainAvailable === true && subdomain && isValidSubdomain(subdomain) && (
                      <p className="text-xs text-emerald-600 flex items-center gap-1">
                        <Check className="h-3 w-3" /> Subdomain is available!
                      </p>
                    )}
                    {!subdomainChecking && subdomainAvailable === false && (
                      <p className="text-xs text-red-600 flex items-center gap-1">
                        <X className="h-3 w-3" /> {subdomainReason || 'This name is already taken'}
                      </p>
                    )}
                    {subdomainError && <p className="text-xs text-red-600">{subdomainError}</p>}
                  </div>

                  {/* Subdomain preview */}
                  {subdomain && isValidSubdomain(subdomain) && (
                    <div className="rounded-lg border bg-muted/50 p-4 mb-4 space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Your workspace URL
                      </p>
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-primary shrink-0" />
                        <p className="text-sm font-mono font-medium text-foreground">
                          {MEMBER_SPACE_HOST}/{subdomain}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex-1" />

                  <Button
                    onClick={() => goTo('provider')}
                    className="w-full gap-2 h-11 rounded-xl text-[14px] font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
                    disabled={provisioning || !subdomain || !isValidSubdomain(subdomain) || subdomainAvailable !== true || subdomainChecking}
                  >
                    {provisioning ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Reserving...</>
                    ) : (
                      <><span>Continue</span><ArrowRight className="h-4 w-4" /></>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}

            {/* ── PROVIDER — Select AI provider (Step 3) ────────── */}
            {step === 'provider' && (
              <motion.div
                key="provider"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={pageTransition}
                className="flex flex-col flex-1"
              >
                <StepProgress current={3} labels={stepLabels} />

                <div className="text-center mb-5">
                  <div className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-title text-foreground mb-1">
                    Choose Your AI Provider
                  </h3>
                  <p className="text-[13px] text-muted-foreground">
                    You can always change this later in settings.
                  </p>
                </div>

                <div className="space-y-2 mb-6 flex-1">
                  {PROVIDER_OPTIONS.map((prov, i) => (
                    <motion.button
                      key={prov.id}
                      type="button"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 + i * 0.06, duration: 0.35 }}
                      onClick={() => setSelectedProvider(prov.id)}
                      className={cn(
                        'w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border text-left transition-all duration-200',
                        selectedProvider === prov.id
                          ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
                          : 'border-border bg-card hover:bg-muted hover:border-border/80'
                      )}
                    >
                      <div className={cn(
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                        selectedProvider === prov.id ? 'border-primary' : 'border-muted-foreground/30'
                      )}>
                        {selectedProvider === prov.id && (
                          <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-semibold text-foreground">{prov.name}</span>
                          {prov.badge && (
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                              {prov.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-muted-foreground mt-0.5">{prov.description}</p>
                      </div>
                      {selectedProvider === prov.id && (
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      )}
                    </motion.button>
                  ))}
                </div>

                <Button
                  onClick={handleSubdomainProvision}
                  className="w-full gap-2 h-11 rounded-xl text-[14px] font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
                  disabled={provisioning || !selectedProvider}
                >
                  {provisioning ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Launching...</>
                  ) : (
                    <><span>Create workspace</span><ArrowRight className="h-4 w-4" /></>
                  )}
                </Button>

                <div className="flex items-center justify-center mt-3">
                  <button
                    type="button"
                    onClick={() => goTo('subdomain', -1)}
                    className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-muted"
                  >
                    &larr; Back
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        <RainbowBar />
      </motion.div>

      <p className="text-[11px] text-center text-muted-foreground mt-5">
        By continuing, you agree to our{' '}
        <Link href="/terms" className="text-blue-600 hover:underline">
          Terms
        </Link>{' '}
        and{' '}
        <Link href="/privacy" className="text-blue-600 hover:underline">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}

// =============================================================================
// Hero Section (with tech animations + embedded wizard)
// =============================================================================

// =============================================================================
// Hero
// =============================================================================
export function LandingHero() {
  return (
    <section className="relative bg-background pt-16 pb-6 md:pt-24 md:pb-10">
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', bounce: 0, duration: 0.7 }}
          className="max-w-3xl mx-auto text-center mb-12"
        >
          <p className="text-footnote font-semibold text-primary mb-4">Free for schools, educators and learners</p>
          <h1 className="text-hero text-foreground text-balance mb-6">AI agents for every classroom.</h1>
          <p className="text-lede text-muted-foreground max-w-2xl mx-auto text-balance">
            Get your own AI agent, find agents reviewed for safety and built for learning, and explore the AI tools
            worth knowing. Built and owned by the community, for the children who need it most.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
            <a
              href="#how-it-works"
              className="press inline-flex items-center gap-2 px-6 h-12 rounded-full text-callout font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Create your workspace
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
            <Link
              href={ROUTES.MARKETPLACE}
              className="press inline-flex items-center gap-2 px-6 h-12 rounded-full text-callout font-semibold border border-border bg-background hover:bg-muted"
            >
              Browse agents
            </Link>
          </div>
        </motion.div>

        <Suspense fallback={<div className="max-w-lg mx-auto w-full h-[420px] rounded-2xl border border-border/60 bg-muted/40" />}>
          <GuidedSetup />
        </Suspense>
      </div>
    </section>
  );
}

// =============================================================================
// What you can do
// =============================================================================
const FEATURES = [
  {
    icon: UserRound,
    title: 'Your own agent',
    description: `A personal AI agent in your own space at ${MEMBER_SPACE_HOST}/your-name. Chat with it, give it skills, and connect it to the apps you already use.`,
    href: '#how-it-works',
    cta: 'Create your workspace',
  },
  {
    icon: Store,
    title: 'Agents for learning',
    description:
      'Find agents for tutoring, reading, maths and teaching support, reviewed for safety and age suitability. Free for students, schools, orphanages and educators.',
    href: ROUTES.MARKETPLACE,
    cta: 'Browse the marketplace',
  },
  {
    icon: Compass,
    title: 'Explore AI tools',
    description:
      'Learn what new and trending AI tools do, who they are for and what they cost, before you choose one for your class or project.',
    href: ROUTES.TOOLS,
    cta: 'Explore AI tools',
  },
  {
    icon: Lightbulb,
    title: 'Build and share',
    description:
      'Built an agent or know a good tool? List it on mawa with a pull request and the community will review it.',
    href: REGISTRY_REPO,
    cta: 'List your work',
  },
];

export function LandingFeatures() {
  return (
    <section id="what-you-can-do" className="py-20 md:py-28 bg-background scroll-mt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div {...reveal} className="max-w-2xl mb-12">
          <h2 className="text-display text-foreground text-balance">What you can do on mawa</h2>
        </motion.div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <motion.li key={f.title} {...reveal}>
              <div className="h-full rounded-2xl border border-border/70 bg-card p-6 sm:p-8 flex flex-col">
                <f.icon className="h-6 w-6 text-primary mb-5" aria-hidden />
                <h3 className="text-headline text-foreground mb-2">{f.title}</h3>
                <p className="text-callout text-muted-foreground flex-1">{f.description}</p>
                <a href={f.href} className="mt-5 inline-flex items-center gap-1 text-callout font-medium text-primary hover:underline">
                  {f.cta} <ArrowRight className="h-4 w-4" aria-hidden />
                </a>
              </div>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// =============================================================================
// Safety
// =============================================================================
const SAFETY = [
  {
    icon: ShieldCheck,
    title: 'Reviewed before it reaches a child',
    description: 'Agents used with children pass community safety review, filter content for the age group, and can be suspended the moment a concern is raised.',
  },
  {
    icon: Lock,
    title: 'Private by design',
    description: 'Agents must not collect personal data they don’t need, and no personal data about children is ever stored on a public ledger.',
  },
  {
    icon: GraduationCap,
    title: 'Teachers stay in charge',
    description: 'Agents support teachers and carers; they don’t replace them. Educators decide how and when agents are used.',
  },
  {
    icon: Languages,
    title: 'Made for every learner',
    description: 'Agents are tested for bias and built for low-cost devices, slow connections and local languages wherever possible.',
  },
];

export function LandingSafety() {
  return (
    <section id="safety" className="py-20 md:py-28 bg-muted/50 scroll-mt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div {...reveal} className="max-w-2xl mb-12">
          <h2 className="text-display text-foreground text-balance mb-4">Safe for children, by design.</h2>
          <p className="text-lede text-muted-foreground">
            Because mawaDao serves children, safety isn’t a setting. Every agent is held to the same standards.
          </p>
        </motion.div>
        <ul className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
          {SAFETY.map((s) => (
            <motion.li key={s.title} {...reveal} className="flex gap-4">
              <s.icon className="h-6 w-6 shrink-0 text-primary mt-0.5" aria-hidden />
              <div>
                <h3 className="text-headline text-foreground mb-1">{s.title}</h3>
                <p className="text-callout text-muted-foreground">{s.description}</p>
              </div>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// =============================================================================
// Channels
// =============================================================================
const CHANNEL_LIST = [
  { icon: SiWhatsapp, label: 'WhatsApp', color: 'bg-green-600' },
  { icon: SiTelegram, label: 'Telegram', color: 'bg-sky-600' },
  { icon: SiDiscord, label: 'Discord', color: 'bg-indigo-600' },
  { icon: SiSlack, label: 'Slack', color: 'bg-gray-700' },
];

export function LandingChannels() {
  return (
    <section id="channels" className="py-20 md:py-28 bg-background scroll-mt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 grid gap-10 md:grid-cols-2 md:items-center">
        <motion.div {...reveal}>
          <h2 className="text-display text-foreground text-balance mb-4">Meet learners where they already are.</h2>
          <p className="text-lede text-muted-foreground">
            Connect your agent to the messaging apps students and families already use, so there’s nothing new to install.
          </p>
        </motion.div>
        <motion.ul {...reveal} className="grid grid-cols-2 gap-3">
          {CHANNEL_LIST.map((ch) => (
            <li key={ch.label} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-4">
              <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl text-white', ch.color)}>
                <ch.icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="text-callout font-medium text-foreground">{ch.label}</span>
            </li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}

// =============================================================================
// Call to action
// =============================================================================
export function LandingCTA() {
  return (
    <section className="py-20 md:py-28 bg-muted/50">
      <motion.div {...reveal} className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <HeartHandshake className="h-8 w-8 text-primary mx-auto mb-6" aria-hidden />
        <h2 className="text-display text-foreground text-balance mb-4">
          Built by the community, for the children who need it most.
        </h2>
        <p className="text-lede text-muted-foreground mb-8">
          mawaDao is non-profit and community-owned. Bring your school, your skills or your ideas.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="#how-it-works"
            className="press inline-flex items-center justify-center gap-2 px-6 h-12 rounded-full text-callout font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Create your workspace <ArrowRight className="h-4 w-4" aria-hidden />
          </a>
          <a
            href={MISSION_URL}
            className="press inline-flex items-center justify-center px-6 h-12 rounded-full text-callout font-semibold border border-border bg-background hover:bg-muted"
          >
            Read our mission
          </a>
        </div>
      </motion.div>
    </section>
  );
}

// =============================================================================
// Footer
// =============================================================================
const FOOTER_LINKS = [
  {
    title: 'Use',
    links: [
      { href: ROUTES.MARKETPLACE, label: 'Agent marketplace' },
      { href: ROUTES.TOOLS, label: 'Explore AI tools' },
      { href: '#how-it-works', label: 'Create your workspace' },
    ],
  },
  {
    title: 'Contribute',
    links: [
      { href: REGISTRY_REPO, label: 'List a tool or agent' },
      { href: 'https://github.com/mawadao/mawa', label: 'Source code' },
      { href: MISSION_URL, label: 'Mission' },
    ],
  },
  {
    title: 'About',
    links: [
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
      { href: CONTACT_URL, label: 'Contact us' },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-background py-14">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          <div className="col-span-2 md:col-span-1">
            <MawadaoLogo />
            <p className="text-footnote text-muted-foreground mt-3 max-w-xs">
              A non-profit, community-owned marketplace for responsible AI agents, built to bring quality education to
              underserved children and orphans.
            </p>
          </div>
          {FOOTER_LINKS.map((col) => (
            <div key={col.title}>
              <h2 className="text-footnote font-semibold text-foreground mb-4">{col.title}</h2>
              <ul className="space-y-3 text-footnote text-muted-foreground">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} className="hover:text-foreground transition-colors">{l.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="pt-8 border-t border-border text-caption text-muted-foreground">
          © {new Date().getFullYear()} mawaDao contributors. Open source under the Apache 2.0 licence.
        </p>
      </div>
    </footer>
  );
}
