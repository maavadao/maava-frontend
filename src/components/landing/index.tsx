'use client';

import * as React from 'react';
import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button, Input } from '@/components/ui';
import { MawadaoLogo } from '@/components/layout';
import { ROUTES, APP_NAME, MEMBER_SPACE_HOST, memberSpaceUrl } from '@/lib/constants';
import { useAuthStore, useSetupStore } from '@/store';
import { useCloudStore } from '@/store/cloud';
import { cn } from '@/lib/utils';
import { finalizeEmailPasswordAuth } from '@/lib/email-auth-session';
import {
  ArrowRight,
  Bot,
  LayoutDashboard,
  Store,
  ShieldCheck,
  Play,
  Check,
  Sparkles,
  Globe,
  Loader2,
  X,
  Mail,
  Lock,
  User,
} from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';
import { FaMicrosoft } from 'react-icons/fa6';
import { SiTelegram, SiDiscord, SiSlack, SiWhatsapp } from 'react-icons/si';

import { motion, AnimatePresence } from 'framer-motion';

// =============================================================================
// Animated Background Elements
// =============================================================================

function FloatingOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div
        className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-blue-400/20 via-indigo-300/10 to-transparent blur-3xl"
        animate={{
          x: [0, 30, -20, 0],
          y: [0, -20, 10, 0],
          scale: [1, 1.1, 0.95, 1],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-violet-400/15 via-purple-300/10 to-transparent blur-3xl"
        animate={{
          x: [0, -25, 15, 0],
          y: [0, 15, -25, 0],
          scale: [1, 0.95, 1.05, 1],
        }}
        transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-gradient-to-r from-cyan-300/10 via-blue-200/5 to-transparent blur-3xl"
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

function GridBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.035]">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(rgba(0,0,0,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.4) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />
    </div>
  );
}

function FloatingParticles() {
  const [particles, setParticles] = React.useState<
    Array<{ id: number; x: number; y: number; size: number; duration: number; delay: number }>
  >([]);

  React.useEffect(() => {
    setParticles(
      Array.from({ length: 20 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 2 + Math.random() * 3,
        duration: 10 + Math.random() * 20,
        delay: Math.random() * 10,
      })),
    );
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-blue-500/20"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size }}
          animate={{
            y: [0, -30, 0],
            opacity: [0, 0.6, 0],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// =============================================================================
// Typing animation for hero
// =============================================================================
function TypeWriter({ words, className }: { words: string[]; className?: string }) {
  const [currentWord, setCurrentWord] = React.useState(0);
  const [currentText, setCurrentText] = React.useState('');
  const [isDeleting, setIsDeleting] = React.useState(false);

  React.useEffect(() => {
    const word = words[currentWord];
    const timeout = setTimeout(
      () => {
        if (!isDeleting) {
          setCurrentText(word.substring(0, currentText.length + 1));
          if (currentText === word) {
            setTimeout(() => setIsDeleting(true), 2000);
          }
        } else {
          setCurrentText(word.substring(0, currentText.length - 1));
          if (currentText === '') {
            setIsDeleting(false);
            setCurrentWord((prev) => (prev + 1) % words.length);
          }
        }
      },
      isDeleting ? 50 : 100,
    );
    return () => clearTimeout(timeout);
  }, [currentText, isDeleting, currentWord, words]);

  return (
    <span className={className}>
      {currentText}
      <motion.span
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
        className="inline-block w-[3px] h-[1em] bg-blue-500 ml-0.5 align-middle"
      />
    </span>
  );
}

// =============================================================================
// Landing Nav — simplified, no sign-in buttons (login happens in wizard)
// =============================================================================
export function LandingNav() {
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? 'bg-background/80 dark:bg-card/80 backdrop-blur-xl border-b border-border/50 shadow-[0_1px_3px_rgba(0,0,0,0.04)]'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 flex h-16 items-center justify-between">
        <div className="flex items-center gap-10">
          <MawadaoLogo />
          <nav className="hidden md:flex items-center gap-8">
            {['How It Works', 'Features', 'Channels'].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
                className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors duration-200"
              >
                {item}
              </a>
            ))}
          </nav>
        </div>
        <a
          href="#how-it-works"
          className="inline-flex items-center gap-2 px-5 h-9 rounded-full text-[13px] font-semibold shadow-sm hover:shadow-md transition-all duration-300 bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          Get Started
          <ArrowRight className="h-3.5 w-3.5" />
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
  { id: 'moonshot', name: 'Moonshot', description: 'Default — mawaDao optimised engine', badge: 'Default' },
  { id: 'openai', name: 'OpenAI', description: 'GPT-4o and GPT-4.1 models', badge: null },
  { id: 'anthropic', name: 'Claude', description: 'Claude Sonnet and Opus models', badge: null },
  { id: 'google', name: 'Gemini', description: 'Google Gemini 2.5 models', badge: null },
] as const;

// Step progress bar — fixed to 3 steps (Account → Subdomain → Provider)
function StepProgress({ current, labels: customLabels }: { current: number; labels?: string[] }) {
  const total = 3;
  const labels = customLabels || ['Account', 'Subdomain', 'Provider'];
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
      setSubdomainError('Subdomain must be 3-63 chars, start with a letter, lowercase letters, numbers, and hyphens only');
      return;
    }
    // Block only when explicitly marked unavailable (not when null/unchecked)
    if (subdomainAvailable === false) {
      setSubdomainError('This subdomain is already taken');
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
  const stepLabels = ['Account', 'Subdomain', 'Provider'];
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
            Free to start &middot; $5 free credits
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
                <h3 className="text-[22px] font-bold text-foreground mb-1.5 tracking-tight">
                  Set up your AI agent in 3&nbsp;steps
                </h3>
                <p className="text-[13px] text-muted-foreground mb-7 leading-relaxed">
                  Create your account, pick a name, choose your AI provider, and your workspace is ready.
                </p>

                <div className="space-y-4 mb-8 flex-1">
                  {[
                    { n: 1, t: 'Create your account', d: 'Quick & free — Google, Microsoft, or email.' },
                    { n: 2, t: 'Choose your subdomain', d: 'Pick a unique name for your AI agent page.' },
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
                  No credit card required. $5 free credits included.
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
                  <h3 className="text-[22px] font-bold text-foreground mb-1 tracking-tight">
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

                <h3 className="text-[22px] font-bold text-foreground mb-1 tracking-tight text-center">
                  {authMode === 'register' ? 'Create your account' : 'Welcome back'}
                </h3>
                <p className="text-[13px] text-muted-foreground mb-5 text-center">
                  {authMode === 'register' ? 'Set up your mawaDao account' : 'Sign in to your existing account'}
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
                  <h3 className="text-[22px] font-bold text-foreground mb-2 tracking-tight">
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
                  <h3 className="text-[22px] font-bold text-foreground mb-1 tracking-tight">
                    Choose Your Subdomain
                  </h3>
                  <p className="text-[13px] text-muted-foreground">
                    This will be your personal AI agent page
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
                        <X className="h-3 w-3" /> {subdomainReason || 'This subdomain is already taken'}
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
                  <h3 className="text-[22px] font-bold text-foreground mb-1 tracking-tight">
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
                    <><span>Launch Workspace</span><ArrowRight className="h-4 w-4" /></>
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
export function LandingHero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-slate-50/80 via-white to-white dark:from-background dark:via-background dark:to-background pt-20 pb-4 md:pt-28 md:pb-8">
      <GridBackground />
      <FloatingOrbs />
      <FloatingParticles />

      <div className="relative max-w-6xl mx-auto px-6">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50/80 dark:bg-blue-950/60 border border-blue-100/60 dark:border-blue-800/40 text-blue-600 dark:text-blue-400 text-[12px] font-semibold mb-6"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Powered by AI &middot; Built for the future
            </motion.div>

            <h1 className="text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-extrabold tracking-tight text-foreground leading-[1.05] mb-6">
              Your Own{' '}
              <span className="bg-gradient-to-r from-blue-600 via-indigo-500 to-violet-500 bg-clip-text text-transparent">
                AI Agents
              </span>
              <br />
              <TypeWriter
                words={['for support', 'for sales', 'for research', 'for your team']}
                className="text-foreground"
              />
            </h1>

            <p className="text-base md:text-[17px] text-muted-foreground max-w-xl mx-auto leading-relaxed">
              {APP_NAME} runs your agents in the cloud 24/7. Connect Telegram, Slack, WhatsApp &amp; more.{' '}
              Launch your workspace, connect your channels, and start shipping useful automation fast.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
            className="flex justify-center mb-10"
          >
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 px-6 h-11 rounded-full text-[14px] font-semibold shadow-sm hover:shadow-md transition-all duration-300 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Launch your workspace
              <ArrowRight className="h-4 w-4" />
            </a>
          </motion.div>

        </div>

        <Suspense fallback={<div className="max-w-lg mx-auto w-full h-[420px] rounded-2xl border border-border/60 bg-background/80 animate-pulse" />}>
          <GuidedSetup />
        </Suspense>
      </div>
    </section>
  );
}

// =============================================================================
// Features Section — Apple-like glassmorphism cards
// =============================================================================
const FEATURES = [
  {
    icon: Bot,
    title: 'Put your agent to work',
    description:
      'Automate repetitive tasks with ease. Assign your agent to handle inquiries, process data, or manage scheduling while you sleep.',
    gradient: 'from-primary to-blue-500',
  },
  {
    icon: LayoutDashboard,
    title: 'Create your space',
    description:
      'Build customizable dashboards tailored to your specific needs. Organize your agents, tools, and analytics in one unified workspace.',
    gradient: 'from-primary to-blue-500',
  },
  {
    icon: Store,
    title: 'List agent',
    description:
      'Share your creations with the world. Seamlessly integrate with our marketplace to monetize your specialized agents.',
    gradient: 'from-primary to-blue-500',
  },
  {
    icon: ShieldCheck,
    title: 'Privacy Preserving',
    description:
      'Your data stays yours. Enterprise-grade security ensures your interactions and agent configurations remain private and secure.',
    gradient: 'from-primary to-blue-500',
  },
];

export function LandingFeatures() {
  return (
    <section id="features" className="py-20 md:py-28 bg-background relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-radial from-blue-50/40 dark:from-blue-950/20 via-transparent to-transparent pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-6">
        <div className="text-center mb-14">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-600 mb-3 block">
              Features
            </span>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-4">Everything You Need</h2>
            <p className="text-muted-foreground max-w-lg mx-auto text-[15px]">
              A cloud AI platform that adapts to your workflow &mdash; not the other way around.
            </p>
          </motion.div>
        </div>

        <div className="grid md:grid-cols-2 gap-5 max-w-4xl mx-auto">
          {FEATURES.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="group relative p-6 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm hover:shadow-[0_8px_40px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_8px_40px_rgba(0,0,0,0.2)] hover:border-border transition-all duration-500"
            >
              <div
                className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-[0.03] transition-opacity duration-500`}
              />
              <div className="relative">
                <div
                  className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${feature.gradient} mb-4 shadow-lg shadow-primary/10`}
                >
                  <feature.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-[15px] font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-[13px] text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// Live Demo Section
// =============================================================================
export function LandingDemo() {
  return (
    <section className="py-20 md:py-28 bg-background">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-600 mb-3 block">
            Live Demo
          </span>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-3">See It in Action</h2>
          <p className="text-muted-foreground text-[15px]">Watch a full cloud deployment from start to finish.</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-2xl mx-auto"
        >
          <div className="relative aspect-video rounded-2xl overflow-hidden bg-gradient-to-br from-amber-200/80 via-amber-100 to-orange-200/80 shadow-[0_8px_60px_rgba(0,0,0,0.1)]">
            <div className="absolute top-3.5 left-3.5 flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
            </div>
            <div className="absolute top-3 right-3.5 text-[10px] text-gray-600/40 font-mono">
              <span className="bg-white/40 rounded px-1.5 py-0.5">00:35</span>
            </div>
            <button
              type="button"
              className="absolute inset-0 flex items-center justify-center group cursor-pointer"
              aria-label="Play demo video"
            >
              <div className="w-16 h-16 rounded-full bg-white/90 shadow-lg flex items-center justify-center group-hover:scale-110 group-active:scale-95 transition-transform duration-300">
                <Play className="h-6 w-6 text-primary ml-0.5" />
              </div>
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// =============================================================================
// Stats / Social Proof
// =============================================================================
export function LandingStats() {
  const stats = [
    { value: '10K+', label: 'Agents Deployed' },
    { value: '50+', label: 'AI Models' },
    { value: '99.9%', label: 'Uptime' },
    { value: '<1s', label: 'Response Time' },
  ];

  return (
    <section className="py-16 bg-muted/60">
      <div className="max-w-4xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="text-center"
            >
              <div className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">{stat.value}</div>
              <div className="text-[13px] text-muted-foreground mt-1 font-medium">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// Connect Channels Section
// =============================================================================
function DiscordIconLg() {
  return (
    <div className="w-10 h-10 rounded-xl bg-indigo-600 dark:bg-indigo-700 flex items-center justify-center">
      <SiDiscord className="w-6 h-6 text-white" />
    </div>
  );
}

function TelegramIconLg() {
  return (
    <div className="w-10 h-10 rounded-xl bg-blue-500 dark:bg-blue-600 flex items-center justify-center">
      <SiTelegram className="w-6 h-6 text-white" />
    </div>
  );
}

function SlackIconLg() {
  return (
    <div className="w-10 h-10 rounded-xl bg-gray-600 dark:bg-gray-700 flex items-center justify-center">
      <SiSlack className="w-6 h-6 text-white" />
    </div>
  );
}

function WhatsAppIconLg() {
  return (
    <div className="w-10 h-10 rounded-xl bg-green-500 dark:bg-green-600 flex items-center justify-center">
      <SiWhatsapp className="w-6 h-6 text-white" />
    </div>
  );
}

const CHANNEL_LIST = [
  { icon: DiscordIconLg, label: 'Discord', subtitle: 'Integrate communities' },
  { icon: TelegramIconLg, label: 'Telegram', subtitle: 'Automate messaging' },
  { icon: SlackIconLg, label: 'Slack', subtitle: 'Business workflows' },
  { icon: WhatsAppIconLg, label: 'WhatsApp', subtitle: 'Global reach' },
];

export function LandingChannels() {
  return (
    <section className="py-20 md:py-28 bg-muted/60">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-2">
            Connect Channels to
            <br />
            Manage your business
          </h2>
        </motion.div>

        <div className="flex justify-center gap-10 md:gap-16 mb-10 flex-wrap">
          {CHANNEL_LIST.map((ch, i) => (
            <motion.div
              key={ch.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="flex flex-col items-center text-center group cursor-default"
            >
              <div className="transition-all duration-300 group-hover:scale-110 group-hover:-translate-y-1">
                <ch.icon />
              </div>
              <span className="text-sm font-semibold text-foreground mt-3">{ch.label}</span>
              <span className="text-[12px] text-muted-foreground mt-0.5">{ch.subtitle}</span>
            </motion.div>
          ))}
        </div>

        <div className="text-center">
          <Link href={ROUTES.CHANNELS}>
            <Button
              variant="outline"
              className="rounded-full px-6 h-10 text-[13px] font-medium border-border hover:border-border/80 hover:bg-muted transition-all duration-200"
            >
              View All Integrations
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// Credits Banner
// =============================================================================
export function LandingCreditsBanner() {
  return (
    <div className="py-8 bg-background">
      <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        $5 Free Credits &middot; No Subscription &middot; Cancel Anytime
      </p>
    </div>
  );
}

// =============================================================================
// CTA Section (Dark with tech bg)
// =============================================================================
export function LandingCTA() {
  return (
    <section className="relative bg-gray-950 text-white py-20 md:py-28 overflow-hidden">
      <div className="absolute inset-0 opacity-[0.06]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
      </div>
      <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-blue-600/20 via-indigo-600/10 to-transparent blur-3xl" />
      <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-violet-600/20 via-purple-600/10 to-transparent blur-3xl" />

      <div className="relative max-w-6xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-white">
            Ready to Deploy
            <br />
            Your AI Assistant?
          </h2>
          <p className="text-gray-400 max-w-lg mx-auto mb-8 text-[15px]">
            Join others running {APP_NAME} in the cloud. Start free, no technical skills required.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
            <Link href="#how-it-works">
              <Button
                size="lg"
                className="gap-2 px-8 h-12 text-[15px] font-semibold shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/30 transition-all duration-300"
              >
                Get Started Free
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="#features">
              <Button
                variant="outline"
                size="lg"
                className="px-8 h-12 text-[15px] font-semibold border-gray-700 text-white hover:bg-white/10 hover:text-white transition-all duration-300"
              >
                Learn More
              </Button>
            </Link>
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-600">
            $5 Free Credits &middot; No Subscription Required
          </p>
        </motion.div>
      </div>
    </section>
  );
}

// =============================================================================
// Footer
// =============================================================================
export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-background py-14">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          <div className="col-span-2 md:col-span-1">
            <MawadaoLogo />
            <p className="text-[13px] text-muted-foreground mt-3 leading-relaxed max-w-xs">
              {APP_NAME} in the cloud. Deploy in under 1 minute, built for the future of AI.
            </p>
          </div>

          <div>
            <h4 className="text-[13px] font-semibold text-foreground mb-4">Product</h4>
            <ul className="space-y-2.5 text-[13px] text-muted-foreground">
              <li>
                <a href="#how-it-works" className="hover:text-foreground transition-colors duration-200">
                  How It Works
                </a>
              </li>
              <li>
                <Link href="/security" className="hover:text-foreground transition-colors duration-200">
                  Security
                </Link>
              </li>
              <li>
                <a href="#features" className="hover:text-foreground transition-colors duration-200">
                  Features
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-[13px] font-semibold text-foreground mb-4">Legal</h4>
            <ul className="space-y-2.5 text-[13px] text-muted-foreground">
              <li>
                <Link href="/privacy" className="hover:text-foreground transition-colors duration-200">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-foreground transition-colors duration-200">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-[13px] font-semibold text-foreground mb-4">Support</h4>
            <ul className="space-y-2.5 text-[13px] text-muted-foreground">
              <li>
                <a href="#" className="hover:text-foreground transition-colors duration-200">
                  FAQ
                </a>
              </li>
              <li>
                <a href="mailto:support@mawadao.ai" className="hover:text-foreground transition-colors duration-200">
                  support@mawadao.ai
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-border text-center">
          <p className="text-[12px] text-muted-foreground">
            &copy; {new Date().getFullYear()} {APP_NAME} Inc. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
