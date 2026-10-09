'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, Button, Input, Avatar, AvatarFallback } from '@/components/ui';
import { CHANNEL_TYPES, ROUTES } from '@/lib/constants';
import {
  ChevronRight,
  Check,
  Shield,
  ExternalLink,
  Bot,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Key,
  Eye,
  EyeOff,
  Globe,
  Trash2,
} from 'lucide-react';
import { SiDiscord, SiSlack, SiTelegram, SiWhatsapp } from 'react-icons/si';
import { FaMicrosoft } from 'react-icons/fa6';
import { cn } from '@/lib/utils';
import { useAuth, useChannels, useSavedChannels } from '@/hooks';
import { IntegrationSidebar, SidebarLayout } from '@/components/layout/sidebar';
import { configApi } from '@/lib/config-api';
import { api } from '@/lib/api';

// Get channel icon by ID
function getChannelIcon(channelId: string): JSX.Element {
  const iconMap: Record<string, JSX.Element> = {
    discord: <SiDiscord className="w-5 h-5 text-white" />,
    slack: <SiSlack className="w-5 h-5 text-white" />,
    telegram: <SiTelegram className="w-5 h-5 text-white" />,
    whatsapp: <SiWhatsapp className="w-5 h-5 text-white" />,
    teams: <FaMicrosoft className="w-5 h-5 text-white" />,
    web: <Globe className="w-5 h-5 text-white" />,
  };
  return iconMap[channelId] || <span className="text-lg font-bold text-white">{channelId.charAt(0).toUpperCase()}</span>;
}

// Channel credential requirements
const CHANNEL_FIELDS: Record<string, { key: string; label: string; placeholder: string; secret?: boolean; helpUrl?: string }[]> = {
  discord: [
    { key: 'token', label: 'Bot Token', placeholder: 'Paste your Discord bot token...', secret: true, helpUrl: 'https://discord.com/developers/applications' },
  ],
  telegram: [
    { key: 'botToken', label: 'Bot Token', placeholder: 'e.g. 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11', secret: true, helpUrl: 'https://t.me/BotFather' },
  ],
  slack: [
    { key: 'botToken', label: 'Bot Token (xoxb-...)', placeholder: 'xoxb-...', secret: true },
    { key: 'appToken', label: 'App Token (xapp-...)', placeholder: 'xapp-...', secret: true },
  ],
  teams: [
    { key: 'appId', label: 'Azure App ID', placeholder: 'Your Azure Bot App ID' },
    { key: 'appPassword', label: 'App Password', placeholder: 'Your Azure Bot App Password', secret: true },
    { key: 'tenantId', label: 'Tenant ID (optional)', placeholder: 'Azure AD Tenant ID' },
  ],
  whatsapp: [],
  web: [],
};

const CHANNEL_DOCS: Record<string, string> = {
  discord: 'Create a bot at discord.com/developers, add it to your server, and paste the bot token.',
  telegram: 'Talk to @BotFather on Telegram, create a bot with /newbot, and paste the token.',
  slack: 'Create a Slack app at api.slack.com, enable Socket Mode, and copy both tokens.',
  teams: 'Register a bot in Azure Portal, create an App Registration, and enter the credentials.',
  whatsapp: 'WhatsApp requires QR code pairing. Run "openclaw channels login whatsapp" in your terminal to scan the QR code.',
  web: 'Web chat is built-in and does not require configuration.',
};

// Step states
type StepState = 'pending' | 'active' | 'completed';

interface SetupStep {
  number: number;
  title: string;
  description: string;
  state: StepState;
}

// Live Preview — Discord chat mockup
function LivePreview({ channelName }: { channelName: string }) {
  return (
    <Card className="border border-border shadow-sm overflow-hidden bg-card">
      <div className="bg-gray-900 dark:bg-black px-4 py-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Live Preview
        </span>
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      </div>

      {/* Discord-like header */}
      <div className="bg-[#36393f] px-4 py-3 border-b border-[#2f3136] flex items-center gap-2">
        <span className="text-gray-400 text-sm">#</span>
        <span className="text-white text-sm font-medium">general</span>
        <span className="text-gray-500 text-xs ml-2">Main conversation channel</span>
      </div>

      {/* Messages area */}
      <div className="bg-[#36393f] p-4 space-y-4 min-h-[240px]">
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
            U
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium text-white">User</span>
              <span className="text-[11px] text-gray-500">Today at 2:14 PM</span>
            </div>
            <p className="text-sm text-gray-300 mt-0.5">
              Hey agent, can you help me with my order?
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium text-primary">maava</span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/20 text-primary">
                BOT
              </span>
              <span className="text-[11px] text-gray-500">Today at 2:14 PM</span>
            </div>
            <p className="text-sm text-gray-300 mt-0.5">
              Of course! I&apos;d be happy to help you with your order. Could you please share your order number?
            </p>
          </div>
        </div>

        <div className="flex gap-3 items-center">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
            <Bot className="h-4 w-4" />
          </div>
          <div className="flex gap-1">
            <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>

      <div className="bg-[#40444b] px-4 py-3">
        <div className="bg-[#4f545c] rounded-lg px-4 py-2.5 text-sm text-gray-400">
          Message #{channelName.toLowerCase()}-general
        </div>
      </div>
    </Card>
  );
}

// Step indicator
function StepIndicator({ step }: { step: SetupStep }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 transition-all',
          step.state === 'completed' && 'bg-emerald-500 text-white',
          step.state === 'active' && 'bg-primary text-white',
          step.state === 'pending' && 'bg-muted text-muted-foreground'
        )}
      >
        {step.state === 'completed' ? <Check className="h-4 w-4" /> : step.number}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-sm font-medium',
            step.state === 'active' ? 'text-foreground' : 'text-muted-foreground'
          )}
        >
          {step.title}
        </p>
        <p className="text-xs text-muted-foreground">{step.description}</p>
      </div>
    </div>
  );
}

// Credential input field with show/hide
function CredentialField({
  label,
  placeholder,
  value,
  onChange,
  secret,
  helpUrl,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  secret?: boolean;
  helpUrl?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">{label}</label>
        {helpUrl && (
          <a href={helpUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:text-primary/80 flex items-center gap-1">
            Get token <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      <div className="relative">
        <Input
          type={secret && !visible ? 'password' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-11 rounded-xl border-border bg-background text-foreground font-mono text-sm pr-10 focus:ring-2 focus:ring-ring/20"
        />
        {secret && (
          <button
            type="button"
            onClick={() => setVisible(!visible)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

export default function IntegrationSetupPage() {
  const params = useParams();
  const router = useRouter();
  const channelId = params.channel as string;
  const { user, agent } = useAuth();
  const { mutate: refreshGatewayChannels } = useChannels();
  const { data: savedChannels, mutate: refreshSavedChannels } = useSavedChannels();

  const channelType = CHANNEL_TYPES.find((c) => c.id === channelId);
  const channelName = channelType?.label || channelId.charAt(0).toUpperCase() + channelId.slice(1);
  const channelColor = channelType?.color || '#6366f1';
  const fields = CHANNEL_FIELDS[channelId] || [];
  const docs = CHANNEL_DOCS[channelId] || '';

  // Find the existing saved record for this channel
  const existingSaved = savedChannels?.find((c) => c.channelType === channelId);
  const alreadyConnected = existingSaved?.isActive === true;

  // Credential state
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [deploying, setDeploying] = useState(false);
  const [deployed, setDeployed] = useState(alreadyConnected);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update deployed state when saved data loads
  useEffect(() => {
    if (alreadyConnected) setDeployed(true);
  }, [alreadyConnected]);

  // Steps
  const hasCredentials = fields.length > 0 && fields.every((f) => f.key !== 'tenantId' ? !!credentials[f.key]?.trim() : true);
  const currentStep = deployed ? 3 : hasCredentials ? 2 : 1;

  const steps: SetupStep[] = [
    {
      number: 1,
      title: 'Enter Credentials',
      description: `Provide your ${channelName} bot credentials`,
      state: hasCredentials ? 'completed' : 'active',
    },
    {
      number: 2,
      title: 'Deploy Channel',
      description: `Connect ${channelName} to your maava gateway`,
      state: deployed ? 'completed' : hasCredentials ? 'active' : 'pending',
    },
    {
      number: 3,
      title: 'Verify Connection',
      description: 'Confirm your channel is live',
      state: deployed ? 'completed' : 'pending',
    },
  ];

  const handleDeploy = useCallback(async () => {
    setDeploying(true);
    setError(null);
    try {
      // Build the config patch for this channel
      const channelConfig: Record<string, unknown> = { enabled: true };
      const credsTrimmed: Record<string, string> = {};
      for (const field of fields) {
        if (credentials[field.key]?.trim()) {
          channelConfig[field.key] = credentials[field.key].trim();
          credsTrimmed[field.key] = credentials[field.key].trim();
        }
      }

      // 1. Push credentials to maava gateway (live activation)
      const currentConfig = await configApi.configGet();
      const baseHash = currentConfig.hash;
      await configApi.configPatch(
        { channels: { [channelId]: channelConfig } },
        baseHash || undefined
      );

      // 2. Persist credentials to DB (survives gateway restarts)
      await api.saveChannel({
        channelType: channelId,
        credentials: credsTrimmed,
        channelName: channelName,
        agentId: agent?.id,
        metadata: { deployedAt: new Date().toISOString() },
      });

      setDeployed(true);
      refreshGatewayChannels();
      refreshSavedChannels();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to deploy channel';
      setError(msg);
    } finally {
      setDeploying(false);
    }
  }, [channelId, channelName, credentials, fields, agent, refreshGatewayChannels, refreshSavedChannels]);

  const handleDisconnect = useCallback(async () => {
    setDisconnecting(true);
    setError(null);
    try {
      // Remove from gateway config
      const currentConfig = await configApi.configGet();
      const baseHash = currentConfig.hash;
      await configApi.configPatch(
        { channels: { [channelId]: { enabled: false } } },
        baseHash || undefined
      );
      // Remove from DB
      await api.deleteChannel(channelId);
      setDeployed(false);
      setCredentials({});
      refreshGatewayChannels();
      refreshSavedChannels();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to disconnect';
      setError(msg);
    } finally {
      setDisconnecting(false);
    }
  }, [channelId, refreshGatewayChannels, refreshSavedChannels]);

  const setField = useCallback((key: string, value: string) => {
    setCredentials(prev => ({ ...prev, [key]: value }));
  }, []);

  const displayName = user?.displayName || user?.username || agent?.displayName || agent?.name || 'User';
  const avatarInitials = displayName.slice(0, 2).toUpperCase();

  // Special case: WhatsApp and Web don't have token-based setup
  const isQrBased = channelId === 'whatsapp';
  const isBuiltIn = channelId === 'web';

  return (
    <SidebarLayout sidebar={<IntegrationSidebar />}>
      <div className="p-6 md:p-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href={ROUTES.CHANNELS} className="hover:text-foreground transition-colors">
            Integrations
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">{channelName} Setup</span>
        </div>

        {/* Back link */}
        <Link
          href={ROUTES.CHANNELS}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Integrations
        </Link>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl">
          {/* Left column — Setup Steps */}
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: channelColor }}
              >
                {getChannelIcon(channelId)}
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  Connect {channelName} to maavaDao
                </h1>
                <p className="text-sm text-muted-foreground">
                  {docs}
                </p>
              </div>
            </div>

            {/* QR/Built-in special pages */}
            {isQrBased && (
              <Card className="border border-border shadow-sm p-6 bg-card">
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50">
                    <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">QR Code Required</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                      WhatsApp uses QR code authentication. Run the command below in your terminal where maava is installed:
                    </p>
                  </div>
                  <div className="bg-muted rounded-xl p-4 font-mono text-sm text-foreground">
                    openclaw channels login whatsapp
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This will display a QR code in your terminal. Scan it with WhatsApp on your phone to link the account.
                  </p>
                  <Button variant="outline" onClick={() => router.push(ROUTES.CHANNELS)} className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Channels
                  </Button>
                </div>
              </Card>
            )}

            {isBuiltIn && (
              <Card className="border border-border shadow-sm p-6 bg-card">
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50">
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium text-sm">
                      <Check className="h-4 w-4" />
                      Already Active
                    </div>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400/80 mt-1">
                      Web chat is built into maavaDao. Go to the Chat page to use it.
                    </p>
                  </div>
                  <Button onClick={() => router.push(ROUTES.CHAT)} className="gap-2">
                    Open Chat
                  </Button>
                </div>
              </Card>
            )}

            {/* Token-based setup flow */}
            {!isQrBased && !isBuiltIn && (
              <>
                <Card className="border border-border shadow-sm p-6 space-y-6 bg-card">
                  {/* Step indicators */}
                  <div className="space-y-4">
                    {steps.map((step, i) => (
                      <div key={step.number}>
                        <StepIndicator step={step} />
                        {i < steps.length - 1 && (
                          <div className="ml-4 mt-2 mb-2 border-l-2 border-border h-4" />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Active step content */}
                  <div className="border-t border-border pt-6">
                    {/* Step 1: Credentials */}
                    {currentStep === 1 && (
                      <div className="space-y-4">
                        {fields.map((field) => (
                          <CredentialField
                            key={field.key}
                            label={field.label}
                            placeholder={field.placeholder}
                            value={credentials[field.key] || ''}
                            onChange={(v) => setField(field.key, v)}
                            secret={field.secret}
                            helpUrl={field.helpUrl}
                          />
                        ))}
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          Credentials are sent directly to your maava gateway — never stored elsewhere
                        </p>
                      </div>
                    )}

                    {/* Step 2: Deploy */}
                    {currentStep === 2 && !deployed && (
                      <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                          Your credentials are ready. Click below to configure {channelName} on your maava gateway.
                        </p>
                        {error && (
                          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                          </div>
                        )}
                        <Button
                          onClick={handleDeploy}
                          disabled={deploying}
                          className="gap-2 w-full"
                          style={{ backgroundColor: deploying ? undefined : channelColor }}
                        >
                          {deploying ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Key className="h-4 w-4" />
                          )}
                          {deploying ? 'Deploying...' : `Deploy ${channelName}`}
                        </Button>
                      </div>
                    )}

                    {/* Step 3: Done */}
                    {deployed && (
                      <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50">
                          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium text-sm">
                            <Check className="h-4 w-4" />
                            Channel connected &amp; saved!
                          </div>
                          <p className="text-xs text-emerald-600 dark:text-emerald-400/80 mt-1">
                            Your {channelName} integration is active and saved to your account. Credentials survive gateway restarts.
                          </p>
                          {existingSaved?.connectedAt && (
                            <p className="text-xs text-emerald-600/70 dark:text-emerald-400/60 mt-0.5">
                              Connected {new Date(existingSaved.connectedAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={() => router.push(ROUTES.CHANNELS)} className="flex-1">
                            Back to Channels
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => { setDeployed(false); setCredentials({}); }}
                            className="gap-2 text-sm"
                          >
                            Re-configure
                          </Button>
                          <Button
                            variant="outline"
                            onClick={handleDisconnect}
                            disabled={disconnecting}
                            className="gap-2 text-sm text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                          >
                            {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            Disconnect
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Security badge + docs link */}
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Shield className="h-3.5 w-3.5" />
                    Secure Connection — AES-256 Encrypted
                  </span>
                  <Link
                    href="/docs/channels"
                    className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                  >
                    Read Integration Guide
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </>
            )}

            {/* User info */}
            <div className="flex items-center gap-3 pt-4 border-t border-border">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                  {avatarInitials}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium text-foreground">{displayName}</p>
                <p className="text-xs text-muted-foreground">
                  {user?.email || 'agent@maavadao.com'}
                </p>
              </div>
            </div>
          </div>

          {/* Right column — Live Preview */}
          <div className="space-y-4">
            <LivePreview channelName={channelName} />

          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
