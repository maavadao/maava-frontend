'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, useGatewayHealth, useModels, useSkills, useChannels, useLocalStorage } from '@/hooks';
import { SidebarLayout, SettingsSidebar } from '@/components/layout/sidebar';
import {
  Button,
  Input,
  Textarea,
  Avatar,
  AvatarImage,
  AvatarFallback,
} from '@/components/ui';
import {
  LogOut,
  Save,
  Trash2,
  AlertTriangle,
  Check,
  Activity,
  Cpu,
  Zap,
  Radio,
  RefreshCw,
  Eye,
  EyeOff,
  Plug,
  Key,
  Server,
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { api } from '@/lib/api';
import { useGatewayChatStore } from '@/store';
import { useCloudStore } from '@/store/cloud';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import { DataManagement } from '@/components/cloud/DataManagement';

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { agent, user, isAuthenticated, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const activeTab = searchParams.get('tab') || 'profile';

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  return (
    <SidebarLayout sidebar={<SettingsSidebar />}>
      <div className="max-w-3xl mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings</h1>
          <p className="text-[15px] text-muted-foreground mt-1">Manage your account preferences and configuration.</p>
        </motion.div>

        <AnimatePresence mode="wait">
          {activeTab === 'profile' && (
            <motion.div key="profile" variants={cardVariants} initial="hidden" animate="visible" exit="hidden" transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}>
              <ProfileSettings agent={agent} user={user} />
            </motion.div>
          )}
          {activeTab === 'notifications' && (
            <motion.div key="notifications" variants={cardVariants} initial="hidden" animate="visible" exit="hidden" transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}>
              <NotificationSettings />
            </motion.div>
          )}
          {activeTab === 'appearance' && (
            <motion.div key="appearance" variants={cardVariants} initial="hidden" animate="visible" exit="hidden" transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}>
              <AppearanceSettings theme={theme} setTheme={setTheme} />
            </motion.div>
          )}
          {activeTab === 'agent' && (
            <motion.div key="agent" variants={cardVariants} initial="hidden" animate="visible" exit="hidden" transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}>
              <GatewayChatSettings />
            </motion.div>
          )}
          {activeTab === 'account' && (
            <motion.div key="account" variants={cardVariants} initial="hidden" animate="visible" exit="hidden" transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}>
              <AccountSettings agent={agent} user={user} onLogout={logout} />
            </motion.div>
          )}
          {activeTab === 'data' && (
            <motion.div key="data" variants={cardVariants} initial="hidden" animate="visible" exit="hidden" transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}>
              <CloudDataSettings />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </SidebarLayout>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  );
}

// =============================================================================
// Glassmorphism card wrapper
// =============================================================================
function SettingsCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border/60 shadow-[0_4px_24px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.2)] overflow-hidden">
      <div className="px-7 pt-7 pb-2">
        <h2 className="text-lg font-bold text-foreground tracking-tight">{title}</h2>
        <p className="text-[13px] text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="px-7 pb-7 pt-4">{children}</div>
    </div>
  );
}

// =============================================================================
// Profile
// =============================================================================
function ProfileSettings({ agent, user }: { agent: any; user: any }) {
  const displayNameSrc = user?.displayName || agent?.displayName || '';
  const descriptionSrc = agent?.description || '';
  const name = user?.username || agent?.name || '';
  const avatarUrl = user?.avatarUrl || agent?.avatarUrl;
  const email = user?.email || '';

  const [displayName, setDisplayName] = useState(displayNameSrc);
  const [description, setDescription] = useState(descriptionSrc);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDisplayName(user?.displayName || agent?.displayName || '');
    setDescription(agent?.description || '');
  }, [user?.displayName, agent?.displayName, agent?.description]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.updateMe({ displayName: displayName || undefined, description: description || undefined });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SettingsCard title="Profile" description="Update your public profile information.">
      <div className="space-y-6">
        {/* Avatar */}
        <div className="flex items-center gap-5">
          <div className="relative group">
            <Avatar className="h-20 w-20 ring-4 ring-border shadow-sm">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback className="text-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
                {name ? getInitials(name) : '?'}
              </AvatarFallback>
            </Avatar>
          </div>
          <div>
            <p className="font-semibold text-foreground">{name}</p>
            {email && <p className="text-[12px] text-muted-foreground mt-0.5">{email}</p>}
            {!email && <p className="text-[12px] text-muted-foreground mt-0.5">Avatar changes are not yet supported</p>}
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Display Name */}
        <div className="space-y-2">
          <label className="text-[13px] font-semibold text-foreground/80">Display Name</label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={agent?.name}
            maxLength={50}
            className="h-11 rounded-xl border-border bg-background focus:ring-2 focus:ring-ring/20 focus:border-border transition-all"
          />
          <p className="text-[11px] text-muted-foreground">This is how your name will appear publicly</p>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label className="text-[13px] font-semibold text-foreground/80">Bio</label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tell others about yourself..."
            maxLength={500}
            className="min-h-[120px] rounded-xl border-border bg-background focus:ring-2 focus:ring-ring/20 focus:border-border transition-all resize-none"
          />
          <p className="text-[11px] text-muted-foreground">{description.length}/500 characters</p>
        </div>

        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="gap-2 h-10 rounded-xl text-[13px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow-md transition-all duration-200"
        >
          {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? 'Saved!' : isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </SettingsCard>
  );
}

// =============================================================================
// Notifications
// =============================================================================
function NotificationSettings() {
  const [emailNotifs, setEmailNotifs] = useLocalStorage('mawadao_notif_email', true);
  const [replyNotifs, setReplyNotifs] = useLocalStorage('mawadao_notif_replies', true);
  const [mentionNotifs, setMentionNotifs] = useLocalStorage('mawadao_notif_mentions', true);
  const [upvoteNotifs, setUpvoteNotifs] = useLocalStorage('mawadao_notif_upvotes', false);

  return (
    <SettingsCard title="Notifications" description="Configure how you receive notifications.">
      <div className="space-y-1">
        <ToggleRow label="Email notifications" description="Receive notifications via email" checked={emailNotifs} onChange={setEmailNotifs} />
        <div className="h-px bg-border my-3" />
        <ToggleRow label="Replies" description="When someone replies to your posts or comments" checked={replyNotifs} onChange={setReplyNotifs} />
        <ToggleRow label="Mentions" description="When someone mentions you" checked={mentionNotifs} onChange={setMentionNotifs} />
        <ToggleRow label="Upvotes" description="When someone upvotes your content" checked={upvoteNotifs} onChange={setUpvoteNotifs} />
      </div>
    </SettingsCard>
  );
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-3 px-1 rounded-lg hover:bg-muted/50 transition-colors -mx-1">
      <div>
        <p className="text-[13px] font-semibold text-foreground">{label}</p>
        <p className="text-[12px] text-muted-foreground">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          'w-12 h-7 rounded-full transition-all duration-300 ease-out relative shadow-inner',
          checked ? 'bg-primary' : 'bg-muted',
        )}
      >
        <motion.div
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className={cn(
            'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-md',
            checked ? 'left-[22px]' : 'left-0.5',
          )}
        />
      </button>
    </div>
  );
}

// =============================================================================
// Appearance
// =============================================================================
function AppearanceSettings({ theme, setTheme }: { theme?: string; setTheme: (t: string) => void }) {
  const themes = [
    { id: 'light', label: 'Light', icon: '☀️', desc: 'Clean & bright' },
    { id: 'dark', label: 'Dark', icon: '🌙', desc: 'Easy on the eyes' },
    { id: 'system', label: 'System', icon: '💻', desc: 'Match your OS' },
  ];

  return (
    <SettingsCard title="Appearance" description="Customize how the app looks.">
      <div className="space-y-2">
        <label className="text-[13px] font-semibold text-foreground/80">Theme</label>
        <div className="grid grid-cols-3 gap-3">
          {themes.map((t) => {
            const isActive = theme === t.id;
            return (
              <motion.button
                key={t.id}
                whileTap={{ scale: 0.97 }}
                onClick={() => setTheme(t.id)}
                className={cn(
                  'flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all duration-200',
                  isActive
                    ? 'border-primary bg-primary/10 shadow-md'
                    : 'border-border hover:border-primary/20 hover:bg-muted/30',
                )}
              >
                <span className="text-3xl">{t.icon}</span>
                <span className="text-[13px] font-semibold text-foreground">{t.label}</span>
                <span className="text-[11px] text-muted-foreground">{t.desc}</span>
                {isActive && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                  >
                    <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </SettingsCard>
  );
}

// =============================================================================
// Shared secret input with show/hide toggle
// =============================================================================
function SecretInput({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-1.5">
      <label className="text-[13px] font-semibold text-foreground/80">{label}</label>
      <div className="relative">
        <Input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-11 rounded-xl border-border bg-background font-mono text-sm pr-10 focus:ring-2 focus:ring-ring/20 focus:border-border transition-all"
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// =============================================================================
// mawaDao Agent Chat — enhanced with configApi data
// =============================================================================
function GatewayChatSettings() {
  const {
    gatewayUrl, gatewayToken, configApiUrl,
    openaiKey, anthropicKey,
    setGatewayUrl, setGatewayToken, setConfigApiUrl,
    setOpenaiKey, setAnthropicKey,
  } = useGatewayChatStore();

  // Local draft state for the form
  const [gwUrl,    setGwUrl   ] = useState(gatewayUrl    ?? '');
  const [gwToken,  setGwToken ] = useState(gatewayToken  ?? '');
  const [cfgUrl,   setCfgUrl  ] = useState(configApiUrl  ?? '');
  const [oaiKey,   setOaiKey  ] = useState(openaiKey     ?? '');
  const [antKey,   setAntKey  ] = useState(anthropicKey  ?? '');

  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const { data: health, isLoading: healthLoading, mutate: refreshHealth } = useGatewayHealth();
  const { data: models, isLoading: modelsLoading } = useModels();
  const { data: skills, isLoading: skillsLoading } = useSkills();
  const { data: channels, isLoading: channelsLoading } = useChannels();

  // Keep local draft in sync when store changes externally
  useEffect(() => { setGwUrl(gatewayUrl ?? ''); }, [gatewayUrl]);
  useEffect(() => { setGwToken(gatewayToken ?? ''); }, [gatewayToken]);
  useEffect(() => { setCfgUrl(configApiUrl ?? ''); }, [configApiUrl]);
  useEffect(() => { setOaiKey(openaiKey ?? ''); }, [openaiKey]);
  useEffect(() => { setAntKey(anthropicKey ?? ''); }, [anthropicKey]);

  const handleSave = () => {
    setGatewayUrl(gwUrl.trim() || null);
    setGatewayToken(gwToken.trim() || null);
    setConfigApiUrl(cfgUrl.trim() || null);  // also syncs configApi client immediately
    setOpenaiKey(oaiKey.trim() || null);
    setAnthropicKey(antKey.trim() || null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    // Test the config REST API endpoint (gives live health data)
    const testBase = (cfgUrl.trim() || configApiUrl || 'http://localhost:19002/api/v1')
      .replace(/\/+$/, '');
    try {
      const res = await fetch(`${testBase}/health`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({})) as Record<string, unknown>;
        const ver = data?.version ? ` (v${data.version})` : '';
        setTestResult({ ok: true, message: `Connected${ver}` });
        refreshHealth();
      } else {
        setTestResult({ ok: false, message: `Gateway returned HTTP ${res.status}` });
      }
    } catch (e) {
      const msg = (e as Error).message ?? 'Network error';
      setTestResult({ ok: false, message: msg.includes('abort') ? 'Timed out (4 s)' : msg });
    } finally {
      setTesting(false);
    }
  };

  const isHealthy = health?.ok === true || (health as Record<string, unknown>)?.status === 'ok';

  return (
    <div className="space-y-6">
      {/* ── Chat Gateway ─────────────────────────────────── */}
      <SettingsCard
        title="Chat Gateway"
        description="mawaDao Agent gateway for AI completions (port 19001). Changes apply to the next message — no restart needed."
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[13px] font-semibold text-foreground/80">Gateway URL</label>
            <Input
              value={gwUrl}
              onChange={(e) => setGwUrl(e.target.value)}
              placeholder="http://localhost:19001"
              className="h-11 rounded-xl font-mono text-sm border-border bg-background focus:ring-2 focus:ring-ring/20 focus:border-border transition-all"
            />
            <p className="text-[11px] text-muted-foreground">
              Default: <code className="bg-muted px-1 rounded">http://localhost:19001</code>. Blank = use server default.
            </p>
          </div>

          <SecretInput
            label="Gateway Token"
            value={gwToken}
            onChange={setGwToken}
            placeholder="dev-token-local"
            hint="Authentication token sent with every AI request. Default: dev-token-local"
          />
        </div>
      </SettingsCard>

      {/* ── Config REST API ──────────────────────────────── */}
      <SettingsCard
        title="Config REST API"
        description="Management API for sessions, models, and dashboard (port 19002). Used by the status dashboard below."
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[13px] font-semibold text-foreground/80">Config API URL</label>
            <Input
              value={cfgUrl}
              onChange={(e) => setCfgUrl(e.target.value)}
              placeholder="http://localhost:19002/api/v1"
              className="h-11 rounded-xl font-mono text-sm border-border bg-background focus:ring-2 focus:ring-ring/20 focus:border-border transition-all"
            />
            <p className="text-[11px] text-muted-foreground">
              Default: <code className="bg-muted px-1 rounded">http://localhost:19002/api/v1</code>. Blank = use server default.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Button
              onClick={handleTest}
              disabled={testing}
              variant="outline"
              className="gap-2 h-9 rounded-xl text-[13px]"
            >
              {testing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
              {testing ? 'Testing…' : 'Test Connection'}
            </Button>
            {testResult && (
              <span
                className={cn(
                  'flex items-center gap-1.5 text-[13px] font-medium',
                  testResult.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400',
                )}
              >
                {testResult.ok
                  ? <Check className="h-4 w-4" />
                  : <AlertTriangle className="h-4 w-4" />}
                {testResult.message}
              </span>
            )}
          </div>
        </div>
      </SettingsCard>

      {/* ── AI Provider Keys ─────────────────────────────── */}
      <SettingsCard
        title="AI Provider Keys"
        description="Optional overrides for server API keys. When set, these take priority over .env values — no restart needed."
      >
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 text-[12px] text-amber-700 dark:text-amber-400 flex items-start gap-2">
            <Key className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Keys are stored locally in your browser and sent only to your own chat endpoint. Leave blank to use the server&apos;s .env configuration.</span>
          </div>
          <SecretInput
            label="OpenAI API Key"
            value={oaiKey}
            onChange={setOaiKey}
            placeholder="sk-proj-…"
            hint="Used directly for GPT-4o, o3, o4-mini etc."
          />
          <SecretInput
            label="Anthropic API Key"
            value={antKey}
            onChange={setAntKey}
            placeholder="sk-ant-api03-…"
            hint="Used directly for Claude models."
          />
        </div>
      </SettingsCard>

      {/* ── Save button ──────────────────────────────────── */}
      <Button
        onClick={handleSave}
        className="gap-2 h-10 rounded-xl text-[13px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow-md transition-all duration-200"
      >
        {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
        {saved ? 'Saved!' : 'Save All Settings'}
      </Button>

      {/* ── Status Dashboard ─────────────────────────────── */}
      <SettingsCard title="System Status" description="Live status from your mawaDao Agent gateway.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatusCard
            icon={Activity}
            label="Gateway Health"
            loading={healthLoading}
            value={health ? (isHealthy ? 'Healthy' : 'Degraded') : 'Unavailable'}
            color={health ? (isHealthy ? 'emerald' : 'amber') : 'gray'}
            action={
              <button onClick={() => refreshHealth()} className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1">
                <RefreshCw className="h-3 w-3" /> Refresh
              </button>
            }
          />
          <StatusCard
            icon={Cpu}
            label="AI Models"
            loading={modelsLoading}
            value={models ? `${models.length} available` : 'Unavailable'}
            color={models && models.length > 0 ? 'blue' : 'gray'}
            detail={models?.slice(0, 3).map(m => m.name || m.id).join(', ')}
          />
          <StatusCard
            icon={Zap}
            label="Skills"
            loading={skillsLoading}
            value={skills ? `${skills.installed?.length ?? 0} installed` : 'Unavailable'}
            color={skills && (skills.installed?.length ?? 0) > 0 ? 'violet' : 'gray'}
          />
          <StatusCard
            icon={Radio}
            label="Channels"
            loading={channelsLoading}
            value={channels ? `${channels.length} connected` : 'Unavailable'}
            color={channels && channels.length > 0 ? 'indigo' : 'gray'}
            detail={channels?.slice(0, 3).map(c => c.name || c.type).join(', ')}
          />
        </div>
      </SettingsCard>
    </div>
  );
}

function StatusCard({
  icon: Icon,
  label,
  loading,
  value,
  color,
  detail,
  action,
}: {
  icon: React.ElementType;
  label: string;
  loading: boolean;
  value: string;
  color: 'emerald' | 'blue' | 'violet' | 'indigo' | 'amber' | 'gray';
  detail?: string;
  action?: React.ReactNode;
}) {
  const colorMap = {
    emerald: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/50',
    blue: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/50',
    violet: 'bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border-violet-100 dark:border-violet-900/50',
    indigo: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/50',
    amber: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/50',
    gray: 'bg-gray-50 dark:bg-gray-800/40 text-gray-400 border-gray-100 dark:border-gray-700/50',
  };
  const dotColor = {
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    violet: 'bg-violet-500',
    indigo: 'bg-indigo-500',
    amber: 'bg-amber-500',
    gray: 'bg-gray-300 dark:bg-gray-600',
  };

  return (
    <div className={cn('rounded-xl border p-4 transition-all', colorMap[color])}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <Icon className="h-4 w-4" />
          <span className="text-[12px] font-semibold uppercase tracking-wide opacity-70">{label}</span>
        </div>
        {action}
      </div>
      <div className="mt-3 flex items-center gap-2">
        {loading ? (
          <div className="h-4 w-24 bg-current/10 rounded animate-pulse" />
        ) : (
          <>
            <span className={cn('h-2 w-2 rounded-full', dotColor[color])} />
            <span className="text-sm font-semibold">{value}</span>
          </>
        )}
      </div>
      {detail && !loading && (
        <p className="text-[11px] mt-1.5 opacity-60 truncate">{detail}</p>
      )}
    </div>
  );
}

// =============================================================================
// Account
// =============================================================================
function AccountSettings({ agent, user, onLogout }: { agent: any; user: any; onLogout: () => void }) {
  const router = useRouter();
  const name = user?.username || agent?.name || '';
  const status = agent?.status || (user?.isActive ? 'active' : 'unknown');
  const email = user?.email || '';
  const createdAt = user?.createdAt || agent?.createdAt;

  const handleLogout = () => {
    onLogout();
    router.push('/');
  };

  return (
    <div className="space-y-6">
      <SettingsCard title="Account" description="Manage your account settings.">
        <div className="space-y-6">
          {/* Username */}
          <div className="space-y-2">
            <label className="text-[13px] font-semibold text-foreground/80">Username</label>
            <Input
              value={name}
              disabled
              className="h-11 rounded-xl border-border bg-muted text-muted-foreground"
            />
            <p className="text-[11px] text-muted-foreground">Usernames cannot be changed</p>
          </div>

          {/* Email (if user-based auth) */}
          {email && (
            <div className="space-y-2">
              <label className="text-[13px] font-semibold text-foreground/80">Email</label>
              <Input
                value={email}
                disabled
                className="h-11 rounded-xl border-border bg-muted text-muted-foreground"
              />
            </div>
          )}

          {/* Status */}
          <div className="space-y-2">
            <label className="text-[13px] font-semibold text-foreground/80">Account Status</label>
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  'h-2.5 w-2.5 rounded-full shadow-sm',
                  status === 'active' ? 'bg-emerald-500 shadow-emerald-500/30' : 'bg-amber-500 shadow-amber-500/30',
                )}
              />
              <span className="text-[13px] font-medium capitalize text-foreground/80">{status}</span>
            </div>
          </div>

          {/* Member since */}
          {createdAt && (
            <div className="space-y-2">
              <label className="text-[13px] font-semibold text-foreground/80">Member Since</label>
              <p className="text-[13px] text-muted-foreground">{new Date(createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
          )}

          <div className="h-px bg-border" />

          {/* Sign out */}
          <div className="space-y-2">
            <label className="text-[13px] font-semibold text-foreground/80">Session</label>
            <Button
              variant="outline"
              onClick={handleLogout}
              className="gap-2 h-10 rounded-xl text-[13px] font-semibold border-border hover:bg-muted transition-all duration-200"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </SettingsCard>

      {/* Danger Zone */}
      <div className="bg-red-50/60 dark:bg-red-950/30 backdrop-blur-xl rounded-2xl border border-red-200/40 dark:border-red-900/40 overflow-hidden">
        <div className="px-7 py-6">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <h2 className="text-[15px] font-bold text-red-900 dark:text-red-400">Danger Zone</h2>
          </div>
          <p className="text-[12px] text-red-600/70 dark:text-red-400/70 mb-4">Once you delete your account, there is no going back.</p>
          <Button
            variant="destructive"
            className="gap-2 h-10 rounded-xl text-[13px] font-semibold shadow-sm"
            disabled
          >
            <Trash2 className="h-4 w-4" />
            Delete Account
          </Button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Cloud Data Management
// =============================================================================
function CloudDataSettings() {
  const { subdomain } = useCloudStore();

  return (
    <SettingsCard title="Data Management" description="Import local mawaDao Agent data or export a backup of your cloud workspace.">
      <DataManagement hasWorkspace={!!subdomain} />
    </SettingsCard>
  );
}
