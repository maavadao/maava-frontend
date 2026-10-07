'use client';

import * as React from 'react';
import {
  Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter,
  Button, Input, Textarea, Badge, Skeleton, Switch, Separator,
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui';
import { useConfig, useModels } from '@/hooks';
import { configApi } from '@/lib/config-api';
import {
  Save, Settings, Bot, Wrench, MessageSquare,
  AlertCircle, CheckCircle2, HelpCircle,
  ChevronDown, ChevronRight, Brain, Clock, FileCode,
  RotateCcw, Eye, EyeOff, Terminal, Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getVal(obj: Record<string, unknown> | undefined, path: string): unknown {
  if (!obj) return undefined;
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function deepSet(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const result = { ...obj };
  const parts = path.split('.');
  if (parts.length === 1) { result[parts[0]] = value; return result; }
  const key = parts[0];
  const rest = parts.slice(1).join('.');
  const child = (typeof result[key] === 'object' && result[key] !== null && !Array.isArray(result[key]))
    ? { ...(result[key] as Record<string, unknown>) }
    : {};
  result[key] = deepSet(child, rest, value);
  return result;
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const sv = source[key];
    const tv = result[key];
    if (sv && typeof sv === 'object' && !Array.isArray(sv) && tv && typeof tv === 'object' && !Array.isArray(tv)) {
      result[key] = deepMerge(tv as Record<string, unknown>, sv as Record<string, unknown>);
    } else {
      result[key] = sv;
    }
  }
  return result;
}

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

// ---------------------------------------------------------------------------
// Reusable form primitives
// ---------------------------------------------------------------------------

function HelpTip({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help shrink-0" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[260px]"><p className="text-xs">{text}</p></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function FormRow({ label, hint, desc, children }: { label: string; hint?: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <label className="text-sm font-medium">{label}</label>
        {hint && <HelpTip text={hint} />}
      </div>
      {children}
      {desc && <p className="text-[13px] text-muted-foreground leading-snug">{desc}</p>}
    </div>
  );
}

function ToggleRow({ label, hint, desc, checked, onChange }: {
  label: string; hint?: string; desc?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium">{label}</span>
          {hint && <HelpTip text={hint} />}
        </div>
        {desc && <p className="text-[13px] text-muted-foreground leading-snug">{desc}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function SelectRow({ label, hint, desc, value, options, onChange }: {
  label: string; hint?: string; desc?: string; value: string;
  options: { value: string; label: string }[]; onChange: (v: string) => void;
}) {
  return (
    <FormRow label={label} hint={hint} desc={desc}>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="flex h-9 w-full rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </FormRow>
  );
}

function PasswordRow({ label, hint, desc, value, onChange, placeholder }: {
  label: string; hint?: string; desc?: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [show, setShow] = React.useState(false);
  return (
    <FormRow label={label} hint={hint} desc={desc}>
      <div className="relative">
        <Input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pr-10" />
        <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1">
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </FormRow>
  );
}

// ---------------------------------------------------------------------------
// Collapsible section wrapper
// ---------------------------------------------------------------------------

function Section({ title, desc, icon: Icon, children, open: controlledOpen, onToggle }: {
  title: string; desc: string; icon: React.ElementType; children: React.ReactNode;
  open: boolean; onToggle: () => void;
}) {
  return (
    <Card>
      <button type="button" onClick={onToggle} className="w-full text-left">
        <CardHeader className="hover:bg-muted/30 transition-colors rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10 shrink-0">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-[15px]">{title}</CardTitle>
                <CardDescription className="text-[13px] mt-0.5">{desc}</CardDescription>
              </div>
            </div>
            {controlledOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        </CardHeader>
      </button>
      {controlledOpen && (
        <CardContent className="pt-2 space-y-5 pb-6">
          <Separator />
          {children}
        </CardContent>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main ConfigEditor
// ---------------------------------------------------------------------------

export function ConfigEditor() {
  const { data: config, isLoading: configLoading, error: configError, mutate: mutateConfig } = useConfig();
  const { data: models } = useModels();

  // Mode: 'visual' (form) or 'yaml' (raw editor)
  const [mode, setMode] = React.useState<'visual' | 'yaml'>('visual');

  // YAML mode state
  const [yamlDraft, setYamlDraft] = React.useState('');
  const [baseHash, setBaseHash] = React.useState<string | undefined>();

  // Visual mode state — accumulated patches
  const [changes, setChanges] = React.useState<Record<string, unknown>>({});

  // Section open state
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({ general: true });

  // Save state
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = React.useState('');

  const parsed = config?.parsed as Record<string, unknown> | undefined;
  // Merge original parsed config with local changes for display
  const current = React.useMemo(() => {
    if (!parsed) return changes;
    return deepMerge(parsed, changes);
  }, [parsed, changes]);

  const hasChanges = Object.keys(changes).length > 0;
  const yamlDirty = yamlDraft !== (config?.raw ?? '');

  // Always keep baseHash in sync with the freshest config
  React.useEffect(() => {
    if (config) {
      setBaseHash(config.hash ?? config.baseHash);
    }
  }, [config]);

  // Sync YAML draft — set on first load and after save (when draft matches old raw)
  React.useEffect(() => {
    if (config?.raw) {
      setYamlDraft((prev) => (!prev || prev === config.raw) ? config.raw : prev);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.raw]);

  // Read a value from the merged current config
  const val = React.useCallback((path: string, def?: unknown): unknown => {
    return getVal(current, path) ?? def;
  }, [current]);

  // Update a nested path
  const set = React.useCallback((path: string, value: unknown) => {
    setChanges((prev) => deepSet(prev, path, value));
    if (saveStatus !== 'idle') setSaveStatus('idle');
  }, [saveStatus]);

  const toggleSection = (name: string) => setOpenSections((prev) => ({ ...prev, [name]: !prev[name] }));

  // Save all pending changes
  const handleSave = async () => {
    setSaveStatus('saving');
    setErrorMessage('');
    try {
      if (mode === 'yaml') {
        await configApi.configSet(yamlDraft, baseHash);
      } else {
        await configApi.configPatch(changes, baseHash);
      }
      setSaveStatus('success');
      setChanges({});
      const fresh = await mutateConfig();
      if (fresh?.raw) setYamlDraft(fresh.raw);
      if (fresh?.hash ?? fresh?.baseHash) setBaseHash(fresh?.hash ?? fresh?.baseHash);
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err: unknown) {
      setSaveStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save configuration');
    }
  };

  const handleReset = () => {
    if (mode === 'yaml') {
      setYamlDraft(config?.raw ?? '');
      setBaseHash(config?.hash ?? config?.baseHash);
    } else {
      setChanges({});
    }
    setSaveStatus('idle');
    setErrorMessage('');
  };

  // Model dropdown options
  const modelOptions = React.useMemo(() => {
    const list = Array.isArray(models) ? models : [];
    return [
      { value: '', label: 'Select a model...' },
      ...list.map((m) => ({ value: m.id, label: `${m.name}${m.provider ? ` (${m.provider})` : ''}${m.isDefault ? ' ★' : ''}` })),
    ];
  }, [models]);

  if (configLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    );
  }

  if (configError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Configuration Unavailable
          </CardTitle>
          <CardDescription>
            Could not load the agent configuration. Make sure the OpenClaw gateway is running and your agent is properly connected.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const isDirty = mode === 'yaml' ? yamlDirty : hasChanges;

  return (
    <div className="space-y-4">
      {/* Top bar: mode toggle + save actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Mode toggle */}
        <div className="inline-flex rounded-lg border bg-muted/30 p-1">
          <button type="button" onClick={() => setMode('visual')}
            className={cn('px-4 py-1.5 text-sm font-medium rounded-md transition-colors', mode === 'visual' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            <Settings className="h-4 w-4 inline mr-1.5 -mt-0.5" />Visual Editor
          </button>
          <button type="button" onClick={() => setMode('yaml')}
            className={cn('px-4 py-1.5 text-sm font-medium rounded-md transition-colors', mode === 'yaml' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            <FileCode className="h-4 w-4 inline mr-1.5 -mt-0.5" />YAML Editor
          </button>
        </div>

        {/* Save actions */}
        <div className="flex items-center gap-2">
          {isDirty && <Badge variant="outline" className="text-xs">Unsaved changes</Badge>}
          {saveStatus === 'success' && (
            <Badge className="text-xs bg-green-500/10 text-green-500 border-green-500/20">
              <CheckCircle2 className="h-3 w-3 mr-1" />Saved
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={handleReset} disabled={!isDirty || saveStatus === 'saving'}>
            <RotateCcw className="h-4 w-4 mr-1.5" />Reset
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!isDirty || saveStatus === 'saving'} isLoading={saveStatus === 'saving'}>
            <Save className="h-4 w-4 mr-1.5" />Save Changes
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {saveStatus === 'error' && errorMessage && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/5 p-3">
          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <p className="text-sm text-destructive">{errorMessage}</p>
        </div>
      )}

      {/* ================================================================ */}
      {/* YAML Mode */}
      {/* ================================================================ */}
      {mode === 'yaml' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileCode className="h-5 w-5" /> Raw Configuration
            </CardTitle>
            <CardDescription>
              Edit the YAML directly. For advanced users who prefer full control over every setting.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea value={yamlDraft} onChange={(e) => setYamlDraft(e.target.value)}
              placeholder="# Your agent configuration (YAML)..."
              className="font-mono text-sm min-h-[500px] resize-y bg-muted/30" spellCheck={false} />
          </CardContent>
        </Card>
      )}

      {/* ================================================================ */}
      {/* Visual Mode — Form Sections */}
      {/* ================================================================ */}
      {mode === 'visual' && (
        <div className="space-y-3">

          {/* General & Gateway */}
          <Section title="General Settings" desc="Gateway, authentication, and UI preferences" icon={Settings}
            open={!!openSections.general} onToggle={() => toggleSection('general')}>
            <FormRow label="Assistant Name" hint="The display name your agent uses when responding" desc="Shown in the chat UI and messages.">
              <Input value={String(val('ui.assistant.name', '') ?? '')} onChange={(e) => set('ui.assistant.name', e.target.value)} placeholder="My AI Assistant" />
            </FormRow>
            <FormRow label="Gateway Port" hint="The network port the gateway listens on" desc="Default is 3000. Change if you have port conflicts.">
              <Input type="number" value={String(val('gateway.port', '') ?? '')} onChange={(e) => set('gateway.port', Number(e.target.value) || undefined)} placeholder="3000" />
            </FormRow>
            <SelectRow label="Authentication Mode" hint="How the gateway authenticates incoming requests"
              value={String(val('gateway.auth.mode', 'token') ?? 'token')}
              options={[{ value: 'token', label: 'Token' }, { value: 'password', label: 'Password' }]}
              onChange={(v) => set('gateway.auth.mode', v)} />
            <PasswordRow label="Auth Token" hint="Secret token for authenticating with the gateway"
              value={String(val('gateway.auth.token', '') ?? '')} onChange={(v) => set('gateway.auth.token', v)} placeholder="Enter your auth token" />
            <SelectRow label="Config Reload" hint="How the gateway reloads after config changes"
              desc="'Hot' reloads without restart. 'Restart' does a full restart. 'Off' requires manual restart."
              value={String(val('gateway.reload.mode', 'hot') ?? 'hot')}
              options={[
                { value: 'hot', label: 'Hot Reload (recommended)' },
                { value: 'hybrid', label: 'Hybrid' },
                { value: 'restart', label: 'Full Restart' },
                { value: 'off', label: 'Off (manual)' },
              ]}
              onChange={(v) => set('gateway.reload.mode', v)} />
            <FormRow label="Accent Color" hint="Theme accent color for the chat UI">
              <Input value={String(val('ui.seamColor', '') ?? '')} onChange={(e) => set('ui.seamColor', e.target.value)} placeholder="#6366f1" />
            </FormRow>
          </Section>

          {/* AI Model & Agent */}
          <Section title="AI Model & Agent" desc="Model selection, behavior, and response settings" icon={Brain}
            open={!!openSections.agent} onToggle={() => toggleSection('agent')}>
            <SelectRow label="Default AI Model" hint="The primary LLM model your agent uses for generating responses"
              desc="Choose the model that best fits your use case. Models marked with ★ are your current default."
              value={String(val('agents.defaults.model', '') ?? '')} options={modelOptions}
              onChange={(v) => set('agents.defaults.model', v)} />
            <ToggleRow label="Thinking Mode" hint="When enabled, the agent shows its reasoning process"
              desc="Displays step-by-step reasoning before the final answer."
              checked={!!val('agents.defaults.thinkingDefault', false)} onChange={(v) => set('agents.defaults.thinkingDefault', v)} />
            <FormRow label="Context Window" hint="Maximum number of tokens from conversation history to include"
              desc="Higher values give the agent more context but use more tokens. Typical range: 4000-128000.">
              <Input type="number" value={String(val('agents.defaults.contextTokens', '') ?? '')}
                onChange={(e) => set('agents.defaults.contextTokens', Number(e.target.value) || undefined)} placeholder="16000" />
            </FormRow>
            <FormRow label="Response Timeout" hint="Maximum seconds the agent waits for a model response"
              desc="Increase for complex queries that take longer to process.">
              <Input type="number" value={String(val('agents.defaults.timeoutSeconds', '') ?? '')}
                onChange={(e) => set('agents.defaults.timeoutSeconds', Number(e.target.value) || undefined)} placeholder="120" />
            </FormRow>
            <FormRow label="Human-like Delay" hint="Simulated typing delay in milliseconds before sending responses"
              desc="Makes the agent feel more natural. Set to 0 for instant responses.">
              <Input type="number" value={String(val('agents.defaults.humanDelay', '') ?? '')}
                onChange={(e) => set('agents.defaults.humanDelay', Number(e.target.value) || undefined)} placeholder="0" />
            </FormRow>
            <FormRow label="Agent Identity — Name" hint="Display name of the default agent">
              <Input value={String(val('agents.defaults.identity.name', '') ?? '')}
                onChange={(e) => set('agents.defaults.identity.name', e.target.value)} placeholder="Agent name" />
            </FormRow>
            <FormRow label="Agent Identity — Emoji" hint="Emoji shown alongside agent messages">
              <Input value={String(val('agents.defaults.identity.emoji', '') ?? '')}
                onChange={(e) => set('agents.defaults.identity.emoji', e.target.value)} placeholder="🤖" className="w-24" />
            </FormRow>
          </Section>

          {/* Tools */}
          <Section title="Tools & Capabilities" desc="Control what your agent can do — web, code, media" icon={Wrench}
            open={!!openSections.tools} onToggle={() => toggleSection('tools')}>
            <SelectRow label="Tool Profile" hint="Preset tool profiles control which tools are available by default"
              desc="'Full' enables everything. 'Minimal' restricts to basic text. 'Coding' adds dev tools."
              value={String(val('tools.profile', 'full') ?? 'full')}
              options={[
                { value: 'minimal', label: 'Minimal — text only' },
                { value: 'coding', label: 'Coding — dev tools + text' },
                { value: 'messaging', label: 'Messaging — chat optimized' },
                { value: 'full', label: 'Full — all tools enabled' },
              ]}
              onChange={(v) => set('tools.profile', v)} />
            <Separator />
            <ToggleRow label="Web Search" hint="Allow the agent to search the web for information"
              desc="Uses configured search providers (Brave, Perplexity, etc.)"
              checked={val('tools.web.search', true) !== false} onChange={(v) => set('tools.web.search', v)} />
            <ToggleRow label="Web Fetch" hint="Allow the agent to fetch and read web pages"
              desc="Enables the agent to read URLs shared in conversation."
              checked={val('tools.web.fetch', true) !== false} onChange={(v) => set('tools.web.fetch', v)} />
            <ToggleRow label="Media Understanding" hint="Allow the agent to analyze images, audio, and video"
              checked={val('tools.media', undefined) !== false} onChange={(v) => set('tools.media.enabled', v)} />
            <ToggleRow label="Code Execution" hint="Allow the agent to run code in a sandbox"
              desc="Enabled by default in 'coding' and 'full' profiles."
              checked={!!val('tools.exec.host', false)} onChange={(v) => set('tools.exec.host', v)} />
            <ToggleRow label="Elevated Access" hint="Allow the agent to perform privileged actions when requested"
              checked={!!val('tools.elevated.enabled', false)} onChange={(v) => set('tools.elevated.enabled', v)} />
          </Section>

          {/* Sessions & Messages */}
          <Section title="Sessions & Messages" desc="Chat session behavior, scope, and message settings" icon={MessageSquare}
            open={!!openSections.sessions} onToggle={() => toggleSection('sessions')}>
            <SelectRow label="Session Scope" hint="Determines whether each user gets their own session or everyone shares one"
              desc="'Per sender' is recommended for most chatbots. 'Global' shares one session for all users."
              value={String(val('session.scope', 'per-sender') ?? 'per-sender')}
              options={[
                { value: 'per-sender', label: 'Per Sender (each user has their own)' },
                { value: 'global', label: 'Global (shared for everyone)' },
              ]}
              onChange={(v) => set('session.scope', v)} />
            <SelectRow label="DM Scope" hint="How direct message sessions are scoped"
              value={String(val('session.dmScope', 'main') ?? 'main')}
              options={[
                { value: 'main', label: 'Main (single DM session)' },
                { value: 'per-peer', label: 'Per Peer' },
                { value: 'per-channel-peer', label: 'Per Channel + Peer' },
                { value: 'per-account-channel-peer', label: 'Per Account + Channel + Peer' },
              ]}
              onChange={(v) => set('session.dmScope', v)} />
            <SelectRow label="Auto Reset" hint="Automatically reset session memory on a schedule"
              desc="'Daily' clears memory each day. 'Idle' clears after inactivity. 'Off' keeps memory forever."
              value={String(val('session.reset.mode', 'off') ?? 'off')}
              options={[
                { value: 'off', label: 'Off (manual only)' },
                { value: 'daily', label: 'Daily' },
                { value: 'idle', label: 'After Idle Period' },
              ]}
              onChange={(v) => set('session.reset.mode', v)} />
            <FormRow label="Idle Timeout (minutes)" hint="Minutes of inactivity before the session auto-resets"
              desc="Only applies when auto-reset is set to 'Idle'.">
              <Input type="number" value={String(val('session.idleMinutes', '') ?? '')}
                onChange={(e) => set('session.idleMinutes', Number(e.target.value) || undefined)} placeholder="30" />
            </FormRow>
            <Separator />
            <FormRow label="Message Prefix" hint="Text prepended to every user message before sending to the model">
              <Input value={String(val('messages.messagePrefix', '') ?? '')}
                onChange={(e) => set('messages.messagePrefix', e.target.value)} placeholder="Optional prefix..." />
            </FormRow>
            <FormRow label="Response Prefix" hint="Text prepended to every agent response">
              <Input value={String(val('messages.responsePrefix', '') ?? '')}
                onChange={(e) => set('messages.responsePrefix', e.target.value)} placeholder="Optional prefix..." />
            </FormRow>
          </Section>

          {/* Logging */}
          <Section title="Logging & Diagnostics" desc="Log levels, output formatting, and privacy settings" icon={Terminal}
            open={!!openSections.logging} onToggle={() => toggleSection('logging')}>
            <SelectRow label="Log Level" hint="Controls how verbose logging output is"
              desc="'Info' is recommended. 'Debug' provides detailed output for troubleshooting."
              value={String(val('logging.level', 'info') ?? 'info')}
              options={[
                { value: 'error', label: 'Error — critical issues only' },
                { value: 'warn', label: 'Warning — issues & warnings' },
                { value: 'info', label: 'Info — standard (recommended)' },
                { value: 'debug', label: 'Debug — verbose' },
                { value: 'trace', label: 'Trace — maximum detail' },
              ]}
              onChange={(v) => set('logging.level', v)} />
            <SelectRow label="Console Style" hint="Visual style of log output in the terminal"
              value={String(val('logging.consoleStyle', 'pretty') ?? 'pretty')}
              options={[
                { value: 'pretty', label: 'Pretty (colored)' },
                { value: 'json', label: 'JSON (structured)' },
                { value: 'plain', label: 'Plain text' },
              ]}
              onChange={(v) => set('logging.consoleStyle', v)} />
            <ToggleRow label="Redact Sensitive Data" hint="Mask API keys, tokens, and other sensitive values in logs"
              desc="Strongly recommended for production environments."
              checked={val('logging.redactSensitive', true) !== false} onChange={(v) => set('logging.redactSensitive', v)} />
            <ToggleRow label="Enable Diagnostics" hint="Collect diagnostic data (OpenTelemetry traces & metrics)"
              checked={!!val('diagnostics.enabled', false)} onChange={(v) => set('diagnostics.enabled', v)} />
          </Section>

          {/* Memory */}
          <Section title="Memory" desc="How the agent remembers information across sessions" icon={Globe}
            open={!!openSections.memory} onToggle={() => toggleSection('memory')}>
            <SelectRow label="Memory Backend" hint="Storage engine for long-term agent memory"
              desc="'Builtin' uses the default file-based storage. 'QMD' uses the QMD vector store."
              value={String(val('memory.backend', 'builtin') ?? 'builtin')}
              options={[
                { value: 'builtin', label: 'Builtin (default)' },
                { value: 'qmd', label: 'QMD (vector store)' },
              ]}
              onChange={(v) => set('memory.backend', v)} />
            <SelectRow label="Citations" hint="Whether the agent cites memory sources in responses"
              value={String(val('memory.citations', 'auto') ?? 'auto')}
              options={[
                { value: 'auto', label: 'Auto' },
                { value: 'on', label: 'Always show' },
                { value: 'off', label: 'Never show' },
              ]}
              onChange={(v) => set('memory.citations', v)} />
          </Section>

        </div>
      )}
    </div>
  );
}
