'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Input } from '@/components/ui';
import { MawadaoLogo } from '@/components/layout';
import { INTEREST_CATEGORIES, ROUTES, STORAGE_KEYS, APP_NAME, CLOUD_MODE, MEMBER_SPACE_URL, MEMBER_SPACE_HOST } from '@/lib/constants';
import { useCloudStore } from '@/store/cloud';
import {
  ArrowRight,
  Check,
  X,
  Sparkles,
  Globe,
  Loader2,
  Rocket,
  AlertCircle,
  Moon,
  Sun,
  Languages,
  BellRing,
  BellOff,
  Minimize2,
  Maximize2,
  MessageCircle,
  MessageSquare,
  Zap,
  Shield,
  BarChart2,
  Clock,
  SlidersHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Preference categories ─────────────────────────────────────────────────────
const PREF_THEME = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System default', icon: SlidersHorizontal },
];

const PREF_LANGUAGE = [
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Español' },
  { id: 'fr', label: 'Français' },
  { id: 'de', label: 'Deutsch' },
  { id: 'pt', label: 'Português' },
  { id: 'zh', label: '中文' },
  { id: 'ar', label: 'العربية' },
  { id: 'ja', label: '日本語' },
];

const PREF_NOTIFICATIONS = [
  { id: 'all', label: 'All updates', icon: BellRing },
  { id: 'important', label: 'Important only', icon: Zap },
  { id: 'none', label: 'Mute for now', icon: BellOff },
];

const PREF_DENSITY = [
  { id: 'compact', label: 'Compact', icon: Minimize2, desc: 'More content, less spacing' },
  { id: 'comfortable', label: 'Comfortable', icon: Maximize2, desc: 'Balanced and spacious' },
];

const PREF_RESPONSE_STYLE = [
  { id: 'concise', label: 'Concise', icon: MessageCircle, desc: 'Short, direct answers' },
  { id: 'detailed', label: 'Detailed', icon: MessageSquare, desc: 'Thorough explanations' },
  { id: 'balanced', label: 'Balanced', icon: BarChart2, desc: 'Adapts to question depth' },
];

const PREF_PRIVACY = [
  { id: 'standard', label: 'Standard', icon: Shield, desc: 'Save history & preferences' },
  { id: 'private', label: 'Private mode', icon: Clock, desc: 'No history stored' },
];

interface Preferences {
  theme: string;
  language: string;
  notifications: string;
  density: string;
  responseStyle: string;
  privacy: string;
}

const DEFAULT_PREFS: Preferences = {
  theme: 'system',
  language: 'en',
  notifications: 'important',
  density: 'comfortable',
  responseStyle: 'balanced',
  privacy: 'standard',
};

const STEPS_LOCAL = ['interests', 'preferences', 'welcome'] as const;
const STEPS_CLOUD = ['subdomain', 'interests', 'preferences', 'provisioning', 'ready'] as const;

type LocalStep = (typeof STEPS_LOCAL)[number];
type CloudStep = (typeof STEPS_CLOUD)[number];
type Step = LocalStep | CloudStep;

export default function OnboardingPage() {
  const router = useRouter();
  const { isCloudMode, setJWT, setTenantStatus } = useCloudStore();

  const steps = CLOUD_MODE || isCloudMode ? STEPS_CLOUD : STEPS_LOCAL;
  const [step, setStep] = useState<Step>(steps[0]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFS);

  // --- Subdomain state (cloud mode) ---
  const [subdomain, setSubdomain] = useState('');
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [availabilityReason, setAvailabilityReason] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Provisioning state ---
  const [provisioning, setProvisioning] = useState(false);
  const [provisionError, setProvisionError] = useState('');
  const [provisionedSubdomain, setProvisionedSubdomain] = useState('');
  const [deployProgress, setDeployProgress] = useState(0); // 0=creating, 1=deploying, 2=configuring, 3=done
  const [provisionLog, setProvisionLog] = useState('Initializing workspace...');
  const [provisionPercent, setProvisionPercent] = useState(0);

  const isValidSubdomain = useCallback((s: string) => {
    return /^[a-z][a-z0-9-]{1,61}[a-z0-9]$/.test(s) && s.length >= 3 && s.length <= 63;
  }, []);

  const setPref = <K extends keyof Preferences>(key: K, value: string) => {
    setPreferences(p => ({ ...p, [key]: value }));
  };

  // ── Fancy provision log messages per phase ────────────────────────────────
  const PROVISION_LOGS: Record<number, string[]> = {
    0: [
      'Initializing workspace...',
      'Allocating cloud resources...',
      'Reserving your namespace...',
    ],
    1: [
      'Pulling AI runtime image...',
      'Deploying backend container...',
      'Booting OpenClaw engine...',
      'Wiring up WebSocket gateway...',
    ],
    2: [
      'Mounting persistent storage...',
      'Configuring environment...',
      'Applying user preferences...',
      'Running health checks...',
    ],
    3: [
      'Everything looks good.',
      'Backend is online.',
    ],
  };

  const advanceProvisionLog = useCallback((phase: number, offset: number) => {
    const msgs = PROVISION_LOGS[phase] ?? PROVISION_LOGS[0];
    setProvisionLog(msgs[offset % msgs.length]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-time subdomain availability check
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!subdomain || !isValidSubdomain(subdomain)) {
      setAvailable(null);
      setAvailabilityReason('');
      return;
    }

    setChecking(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/setup/check-subdomain?subdomain=${encodeURIComponent(subdomain)}`
        );
        const data = await res.json();
        setAvailable(data.available);
        setAvailabilityReason(data.reason || '');
      } catch {
        setAvailable(null);
        setAvailabilityReason('');
      } finally {
        setChecking(false);
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [subdomain, isValidSubdomain]);

  const toggleInterest = (id: string) => {
    setSelectedInterests((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSubdomainInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSubdomain(val);
    setProvisionError('');
  };

  // --- Provision backend ---
  const handleProvision = async () => {
    if (!isValidSubdomain(subdomain) || available !== true) return;

    setProvisioning(true);
    setProvisionError('');
    setTenantStatus('provisioning');
    setStep('provisioning');
    setDeployProgress(0);
    setProvisionPercent(5);
    setProvisionLog('Initializing workspace...');

    try {
      const res = await fetch('/api/setup/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ subdomain }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Provisioning failed' }));
        throw new Error(errData.error || `Error ${res.status}`);
      }

      const data = await res.json();

      // If already active (dev mode or existing tenant), skip polling
      if (data.status === 'active' || data.tenant?.backendUrl) {
        if (data.token) setJWT(data.token);
        setProvisionedSubdomain(subdomain);
        setTenantStatus('active');
        setDeployProgress(3);
        setProvisionPercent(100);
        setProvisionLog('Backend is online.');
        setStep('ready');
        setProvisioning(false);
        return;
      }

      // Cloud mode: poll /api/setup/provision/status until active or error
      setDeployProgress(1);
      await pollProvisionStatus();
    } catch (err) {
      setProvisionError((err as Error).message);
      setTenantStatus('error');
      setStep('subdomain');
      setProvisioning(false);
    }
  };

  const pollProvisionStatus = async () => {
    const POLL_INTERVAL = 15000; // 15 seconds
    const MAX_POLLS = 24;        // ~6 minutes max

    for (let i = 0; i < MAX_POLLS; i++) {
      // Advance progress bar and log message while waiting
      const phase = deployProgress;
      const targetPct = Math.min(10 + i * 4, 88);
      setProvisionPercent(targetPct);
      advanceProvisionLog(phase, i);

      await new Promise((r) => setTimeout(r, POLL_INTERVAL));

      // Advance the phase indicator after enough polls
      if (i === 2) { setDeployProgress(2); setProvisionPercent(40); advanceProvisionLog(2, 0); }

      try {
        const res = await fetch('/api/setup/provision/status', {
          credentials: 'include',
        });
        if (!res.ok) continue;

        const data = await res.json();

        if (data.status === 'active') {
          setProvisionedSubdomain(subdomain);
          setTenantStatus('active');
          setDeployProgress(3);
          setProvisionPercent(100);
          advanceProvisionLog(3, 0);
          setStep('ready');
          setProvisioning(false);
          return;
        }

        if (data.status === 'error' || data.status === 'suspended') {
          throw new Error('Backend provisioning failed. Please try again.');
        }
      } catch (err) {
        if ((err as Error).message.includes('provisioning failed')) {
          setProvisionError((err as Error).message);
          setTenantStatus('error');
          setStep('subdomain');
          setProvisioning(false);
          return;
        }
        // Network blip — keep polling
      }
    }

    // Timed out
    setProvisionError('Provisioning is taking longer than expected. Please refresh the page to check status.');
    setTenantStatus('error');
    setStep('subdomain');
    setProvisioning(false);
  };

  const handleContinue = () => {
    const isCloud = CLOUD_MODE || isCloudMode;

    if (isCloud) {
      if (step === 'subdomain') {
        // Claim subdomain name first, then collect interests + preferences before provisioning
        setStep('interests');
      } else if (step === 'interests') {
        localStorage.setItem(STORAGE_KEYS.INTERESTS, JSON.stringify(selectedInterests));
        setStep('preferences');
      } else if (step === 'preferences') {
        localStorage.setItem('mawadao_preferences', JSON.stringify(preferences));
        // Now provision — interests and preferences already collected
        handleProvision();
      } else if (step === 'ready') {
        // Provisioning done — go to the member space
        localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, 'true');
        if (provisionedSubdomain) {
          window.location.href = MEMBER_SPACE_URL;
        } else {
          router.push(ROUTES.CHAT);
        }
      }
    } else {
      // Local mode
      if (step === 'interests') {
        localStorage.setItem(STORAGE_KEYS.INTERESTS, JSON.stringify(selectedInterests));
        setStep('preferences');
      } else if (step === 'preferences') {
        localStorage.setItem('mawadao_preferences', JSON.stringify(preferences));
        setStep('welcome');
      } else {
        localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, 'true');
        router.push(ROUTES.CHAT);
      }
    }
  };

  const stepIndex = (steps as readonly string[]).indexOf(step);

  return (
    <div className="min-h-screen bg-white dark:bg-background flex flex-col">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <MawadaoLogo />
      </div>

      {/* Progress */}
      <div className="w-full max-w-2xl mx-auto px-6 pt-8">
        <div className="flex gap-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                stepIndex >= i ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-6 py-12">
        <AnimatePresence mode="wait">
          {/* ============ CLOUD: Subdomain Selection ============ */}
          {step === 'subdomain' && (
            <motion.div
              key="subdomain"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-md"
            >
              <div className="text-center mb-8">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
                  <Globe className="h-7 w-7 text-primary" />
                </div>
                <h1 className="text-3xl font-bold mb-3">Choose your subdomain</h1>
                <p className="text-muted-foreground text-lg">
                  This will be your personal AI workspace URL
                </p>
              </div>

              <div className="space-y-4">
                {/* Subdomain input */}
                <div className="space-y-2">
                  <label htmlFor="subdomain" className="text-sm font-medium">
                    Subdomain
                  </label>
                  <div className="relative">
                    <Input
                      id="subdomain"
                      value={subdomain}
                      onChange={handleSubdomainInput}
                      placeholder="your-name"
                      maxLength={63}
                      autoFocus
                      autoComplete="off"
                      className={cn(
                        'pr-10 text-base',
                        available === true && subdomain && isValidSubdomain(subdomain) &&
                          'border-emerald-500 focus-visible:ring-emerald-500/20',
                        available === false &&
                          'border-red-500 focus-visible:ring-red-500/20'
                      )}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {checking && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                      {!checking && available === true && subdomain && isValidSubdomain(subdomain) && (
                        <Check className="h-4 w-4 text-emerald-500" />
                      )}
                      {!checking && available === false && (
                        <X className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    3-63 characters. Start with a letter. Letters, numbers, and hyphens only.
                  </p>

                  {/* Availability feedback */}
                  {!checking && available === true && subdomain && isValidSubdomain(subdomain) && (
                    <p className="text-xs text-emerald-600 flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      Subdomain is available!
                    </p>
                  )}
                  {!checking && available === false && (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <X className="h-3 w-3" />
                      {availabilityReason === 'Reserved'
                        ? 'This subdomain is reserved'
                        : 'This subdomain is already taken'}
                    </p>
                  )}

                  {provisionError && (
                    <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {provisionError}
                    </div>
                  )}
                </div>

                {/* Preview */}
                {subdomain && isValidSubdomain(subdomain) && (
                  <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Your workspace name
                    </p>
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-primary shrink-0" />
                      <p className="text-sm font-mono font-medium text-foreground">
                        {subdomain}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      You&apos;ll open your workspace at {MEMBER_SPACE_HOST}.
                    </p>
                  </div>
                )}

                <Button
                  size="lg"
                  onClick={handleContinue}
                  disabled={
                    !subdomain ||
                    !isValidSubdomain(subdomain) ||
                    available !== true ||
                    checking ||
                    provisioning
                  }
                  className="w-full gap-2"
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* ============ CLOUD: Provisioning in progress ============ */}
          {step === 'provisioning' && (
            <motion.div
              key="provisioning"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-lg text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>
              <h1 className="text-3xl font-bold mb-2">Setting up your workspace</h1>
              <p className="text-muted-foreground mb-1">
                We&apos;re provisioning{' '}
                <span className="font-semibold text-foreground font-mono">
                  {subdomain}
                </span>
              </p>
              <p className="text-sm text-muted-foreground mb-8">
                This takes a minute. Grab a coffee.
              </p>

              {/* Progress bar */}
              <div className="mb-3">
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    initial={{ width: '5%' }}
                    animate={{ width: `${provisionPercent}%` }}
                    transition={{ duration: 1.2, ease: 'easeInOut' }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <p className="text-xs text-muted-foreground font-mono">{provisionLog}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">{provisionPercent}%</p>
                </div>
              </div>

              {/* Phase steps */}
              <div className="mt-6 space-y-2.5">
                <ProvisionStep label="Creating workspace" done={deployProgress >= 1} active={deployProgress === 0} />
                <ProvisionStep label="Deploying AI backend" done={deployProgress >= 2} active={deployProgress === 1} />
                <ProvisionStep label="Configuring storage" done={deployProgress >= 3} active={deployProgress === 2} />
              </div>

              <p className="text-[11px] text-muted-foreground/50 mt-8">
                Checking every 15 seconds &mdash; hang tight
              </p>
            </motion.div>
          )}

          {/* ============ CLOUD: Ready ============ */}
          {step === 'ready' && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-lg text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mx-auto mb-6">
                <Check className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h1 className="text-3xl font-bold mb-3">Workspace is ready!</h1>
              <p className="text-muted-foreground text-lg mb-2">
                Your AI workspace is live at
              </p>
              <a
                href={MEMBER_SPACE_URL}
                className="inline-flex items-center gap-2 text-primary font-mono font-medium text-lg hover:underline mb-6"
              >
                <Globe className="h-5 w-5" />
                {MEMBER_SPACE_HOST}
              </a>
              <p className="text-muted-foreground mb-8">
                Your workspace is personalized and ready. Let&apos;s go!
              </p>
              <Button size="lg" onClick={handleContinue} className="min-w-[200px] gap-2">
                Open my workspace
                <ArrowRight className="h-4 w-4" />
              </Button>
            </motion.div>
          )}

          {/* ============ Interests (both modes) ============ */}
          {step === 'interests' && (
            <motion.div
              key="interests"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-2xl"
            >
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold mb-3">What are you interested in?</h1>
                <p className="text-muted-foreground text-lg">
                  Select topics to personalize your {APP_NAME} experience
                </p>
              </div>

              <div className="flex flex-wrap justify-center gap-3 mb-10">
                {INTEREST_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleInterest(cat.id)}
                    className={`interest-pill ${
                      selectedInterests.includes(cat.id)
                        ? 'interest-pill-active'
                        : 'interest-pill-inactive'
                    }`}
                  >
                    <span className="mr-1.5">{cat.icon}</span>
                    {cat.label}
                    {selectedInterests.includes(cat.id) && (
                      <Check className="h-3.5 w-3.5 ml-1.5" />
                    )}
                  </button>
                ))}
              </div>

              <div className="flex justify-center">
                <Button
                  size="lg"
                  onClick={handleContinue}
                  disabled={selectedInterests.length === 0}
                  className="min-w-[200px] gap-2"
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>

              {selectedInterests.length === 0 && (
                <p className="text-center text-sm text-muted-foreground mt-4">
                  Select at least one interest to continue
                </p>
              )}
            </motion.div>
          )}

          {/* ============ Preferences ============ */}
          {step === 'preferences' && (
            <motion.div
              key="preferences"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-2xl"
            >
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold mb-3">Your preferences</h1>
                <p className="text-muted-foreground text-lg">
                  Tailor the experience to fit your workflow
                </p>
              </div>

              <div className="space-y-8">

                {/* Theme */}
                <PrefSection title="Appearance" icon={Sun}>
                  <div className="grid grid-cols-3 gap-3">
                    {PREF_THEME.map(({ id, label, icon: Icon }) => (
                      <PrefCard
                        key={id}
                        selected={preferences.theme === id}
                        onClick={() => setPref('theme', id)}
                      >
                        <Icon className="h-5 w-5 mb-1.5 text-primary" />
                        <span className="text-sm font-medium">{label}</span>
                      </PrefCard>
                    ))}
                  </div>
                </PrefSection>

                {/* Response style */}
                <PrefSection title="Response style" icon={MessageSquare}>
                  <div className="grid grid-cols-3 gap-3">
                    {PREF_RESPONSE_STYLE.map(({ id, label, icon: Icon, desc }) => (
                      <PrefCard
                        key={id}
                        selected={preferences.responseStyle === id}
                        onClick={() => setPref('responseStyle', id)}
                      >
                        <Icon className="h-5 w-5 mb-1.5 text-primary" />
                        <span className="text-sm font-medium leading-tight">{label}</span>
                        <span className="text-[11px] text-muted-foreground mt-1 leading-tight text-center">{desc}</span>
                      </PrefCard>
                    ))}
                  </div>
                </PrefSection>

                {/* Layout density */}
                <PrefSection title="Layout density" icon={SlidersHorizontal}>
                  <div className="grid grid-cols-2 gap-3">
                    {PREF_DENSITY.map(({ id, label, icon: Icon, desc }) => (
                      <PrefCard
                        key={id}
                        selected={preferences.density === id}
                        onClick={() => setPref('density', id)}
                      >
                        <Icon className="h-5 w-5 mb-1.5 text-primary" />
                        <span className="text-sm font-medium">{label}</span>
                        <span className="text-[11px] text-muted-foreground mt-1 text-center">{desc}</span>
                      </PrefCard>
                    ))}
                  </div>
                </PrefSection>

                {/* Notifications */}
                <PrefSection title="Notifications" icon={BellRing}>
                  <div className="grid grid-cols-3 gap-3">
                    {PREF_NOTIFICATIONS.map(({ id, label, icon: Icon }) => (
                      <PrefCard
                        key={id}
                        selected={preferences.notifications === id}
                        onClick={() => setPref('notifications', id)}
                      >
                        <Icon className="h-5 w-5 mb-1.5 text-primary" />
                        <span className="text-sm font-medium text-center leading-tight">{label}</span>
                      </PrefCard>
                    ))}
                  </div>
                </PrefSection>

                {/* Language */}
                <PrefSection title="Language" icon={Languages}>
                  <div className="flex flex-wrap gap-2">
                    {PREF_LANGUAGE.map(({ id, label }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setPref('language', id)}
                        className={cn(
                          'px-4 py-2 rounded-xl border text-sm font-medium transition-all',
                          preferences.language === id
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </PrefSection>

                {/* Privacy */}
                <PrefSection title="Privacy" icon={Shield}>
                  <div className="grid grid-cols-2 gap-3">
                    {PREF_PRIVACY.map(({ id, label, icon: Icon, desc }) => (
                      <PrefCard
                        key={id}
                        selected={preferences.privacy === id}
                        onClick={() => setPref('privacy', id)}
                      >
                        <Icon className="h-5 w-5 mb-1.5 text-primary" />
                        <span className="text-sm font-medium">{label}</span>
                        <span className="text-[11px] text-muted-foreground mt-1 text-center">{desc}</span>
                      </PrefCard>
                    ))}
                  </div>
                </PrefSection>

              </div>

              <div className="flex justify-center mt-10">
                <Button
                  size="lg"
                  onClick={handleContinue}
                  className="min-w-[200px] gap-2"
                >
                  {(CLOUD_MODE || isCloudMode) ? 'Finish Setup' : 'Continue'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* ============ LOCAL: Welcome ============ */}
          {step === 'welcome' && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-lg text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-3xl font-bold mb-3">You&apos;re all set!</h1>
              <p className="text-muted-foreground text-lg mb-4">
                We&apos;ve personalized your {APP_NAME} experience based on your interests.
              </p>
              <p className="text-muted-foreground mb-8">
                Browse the marketplace to discover AI agents that can help your team work smarter.
              </p>
              <Button size="lg" onClick={handleContinue} className="min-w-[200px] gap-2">
                Go to Marketplace
                <ArrowRight className="h-4 w-4" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Provisioning step indicator used during backend setup */
function ProvisionStep({
  label,
  done,
  active,
}: {
  label: string;
  done: boolean;
  active?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 justify-center">
      <div className="w-5 h-5 flex items-center justify-center">
        {done ? (
          <Check className="h-4 w-4 text-emerald-500" />
        ) : active ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
        )}
      </div>
      <span
        className={cn(
          'text-sm',
          done && 'text-emerald-600 dark:text-emerald-400',
          active && 'text-foreground font-medium',
          !done && !active && 'text-muted-foreground'
        )}
      >
        {label}
      </span>
    </div>
  );
}

/** Labeled section wrapper for the preferences step */
function PrefSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">{title}</h3>
      </div>
      {children}
    </div>
  );
}

/** Selectable card tile used inside preferences */
function PrefCard({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex flex-col items-center justify-center rounded-xl border px-3 py-4 transition-all text-center gap-0.5',
        selected
          ? 'border-primary bg-primary/8 ring-1 ring-primary/30 text-foreground'
          : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-muted/50'
      )}
    >
      {selected && (
        <span className="absolute top-2 right-2 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
          <Check className="h-2.5 w-2.5 text-primary-foreground" />
        </span>
      )}
      {children}
    </button>
  );
}
