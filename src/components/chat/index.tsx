'use client';

import * as React from 'react';
import { useChat } from '@ai-sdk/react';
import { TextStreamChatTransport, UIMessage, FileUIPart, type PrepareSendMessagesRequest } from 'ai';
import { Button } from '@/components/ui';
import { Markdown } from '@/components/common/markdown';
import { CodeCanvas, type CanvasBlock } from './code-canvas';
import { cn } from '@/lib/utils';
import { useOpenClawChatStore, useSkillsStore, useInstalledAgentsStore } from '@/store';
import { useCloudStore } from '@/store/cloud';
import { useAuth } from '@/hooks';
import { useStreamRecovery } from '@/hooks/use-stream-recovery';
import { ChatSkeleton } from './chat-skeleton';
import { useAdaptivePoll } from '@/hooks/use-adaptive-poll';
import {
  Send, Loader2, Bot, Sparkles, StopCircle, RotateCcw,
  Paperclip, X, ChevronDown, Check, ImageIcon, FileText,
  File as FileIcon, Code2, User, AlertCircle, Search,
  Cpu, Lock, KeyRound, Wand2,
  ShoppingCart, Smartphone, MessageSquare, CalendarDays,
  BarChart3, Activity, CircleDot, Bitcoin, Zap,
  type LucideIcon,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────
interface EnabledSkill { skill_id: string; name: string; category: string; }
interface ModelOption { value: string; label: string; provider?: string; }
interface DBMessage { id: string; role: string; content: string; created_at?: string; }

interface AttachedFile {
  id: string;
  file: File;
  previewUrl?: string;  // for images
  type: 'image' | 'text' | 'other';
}

const FALLBACK_MODELS: ModelOption[] = [
  // ── Platform default ──────────────────────────────────────────────────────
  { value: 'openclaw',                              label: 'OpenClaw (Default)',  provider: 'openclaw' },
  // ── Anthropic ─────────────────────────────────────────────────────────────
  { value: 'anthropic/claude-opus-4-5',   label: 'Claude Opus 4.5',    provider: 'anthropic' },
  { value: 'anthropic/claude-sonnet-4-5', label: 'Claude Sonnet 4.5',  provider: 'anthropic' },
  { value: 'anthropic/claude-3-7-sonnet', label: 'Claude Sonnet 3.7',  provider: 'anthropic' },
  { value: 'anthropic/claude-3-5-sonnet', label: 'Claude Sonnet 3.5',  provider: 'anthropic' },
  { value: 'anthropic/claude-3-5-haiku',  label: 'Claude Haiku 3.5',   provider: 'anthropic' },
  // ── OpenAI ────────────────────────────────────────────────────────────────
  { value: 'openai/gpt-4o',               label: 'GPT-4o',             provider: 'openai' },
  { value: 'openai/gpt-4o-mini',          label: 'GPT-4o mini',        provider: 'openai' },
  { value: 'openai/gpt-4-turbo',          label: 'GPT-4 Turbo',        provider: 'openai' },
  { value: 'openai/o3',                   label: 'o3',                 provider: 'openai' },
  { value: 'openai/o3-mini',              label: 'o3-mini',            provider: 'openai' },
  { value: 'openai/o4-mini',              label: 'o4-mini',            provider: 'openai' },
  // ── Google ────────────────────────────────────────────────────────────────────
  { value: 'google/gemini-2.5-pro',        label: 'Gemini 2.5 Pro',        provider: 'google' },
  { value: 'google/gemini-2.0-flash',      label: 'Gemini 2.0 Flash',      provider: 'google' },
  { value: 'google/gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite', provider: 'google' },
  // ── Meta / Llama ──────────────────────────────────────────────────────────
  { value: 'meta-llama/llama-3.3-70b-instruct',    label: 'Llama 3.3 70B',    provider: 'meta' },
  { value: 'meta-llama/llama-3.1-70b-instruct',    label: 'Llama 3.1 70B',    provider: 'meta' },
  { value: 'meta-llama/llama-3-8b-instruct',       label: 'Llama 3 8B',       provider: 'meta' },
  { value: 'meta-llama/llama-3.2-3b-instruct',     label: 'Llama 3.2 3B',     provider: 'meta' },
  // ── Mistral ─────────────────────────────────────────────────────────────────
  { value: 'mistralai/mixtral-8x7b-instruct',      label: 'Mixtral 8x7B',     provider: 'mistral' },
  { value: 'mistralai/mistral-7b-instruct',        label: 'Mistral 7B',       provider: 'mistral' },
  // ── Others ──────────────────────────────────────────────────────────────────
  { value: 'qwen/qwen-2.5-72b-instruct',           label: 'Qwen 2.5 72B',     provider: 'qwen' },
  { value: 'qwen/qwen-2.5-7b-instruct',            label: 'Qwen 2.5 7B',      provider: 'qwen' },
  { value: 'deepseek/deepseek-r1',                 label: 'DeepSeek R1',      provider: 'deepseek' },
  { value: 'deepseek/deepseek-v3',                 label: 'DeepSeek V3',      provider: 'deepseek' },
  { value: 'x-ai/grok-3',                          label: 'Grok 3',           provider: 'xai' },
  { value: 'x-ai/grok-3-mini',                     label: 'Grok 3 Mini',      provider: 'xai' },
  { value: 'nvidia/llama-3.1-nemotron-70b-instruct', label: 'Nemotron 70B',   provider: 'nvidia' },
];

// Providers shown in the ⭐ Popular group, in display order.
// The group is built dynamically from the live model list — top 2 per provider
// as returned by the models API (newest/featured first), so new releases automatically
// appear here without any code change.
const FEATURED_PROVIDERS_ORDER = [
  'anthropic',
  'openai',
  'google',
  'meta-llama',
  'mistralai',
  'deepseek',
  'x-ai',
  'qwen',
  'nvidia',
];

// Keywords that identify non-chat models (image gen, audio, embeddings, code-only, etc.)
// These are excluded from the Popular section so only conversational LLMs appear.
const NON_CHAT_PATTERNS = [
  'audio', 'image', 'embed', 'tts', 'whisper', 'dall-e', 'dalle',
  'codex', 'safeguard', 'deep-research', 'turbo-instruct',
  'babbage', 'davinci', 'gpt-3.5', 'moderati',
];

function isChatModel(id: string): boolean {
  const lower = id.toLowerCase();
  return !NON_CHAT_PATTERNS.some(p => lower.includes(p));
}

function buildPopular(models: ModelOption[]): ModelOption[] {
  const seen = new Set<string>();
  const result: ModelOption[] = [];
  for (const prov of FEATURED_PROVIDERS_ORDER) {
    let count = 0;
    for (const m of models) {
      if (count >= 2) break;
      const id = m.value.toLowerCase();
      // Match provider prefix, skip non-chat and variant suffixes
      if (
        id.startsWith(prov + '/') &&
        isChatModel(id) &&
        !id.includes(':free') &&
        !id.includes(':nitro') &&
        !seen.has(m.value)
      ) {
        seen.add(m.value);
        result.push(m);
        count++;
      }
    }
  }
  return result;
}

function resolveModelCompany(model: ModelOption): string {
  const provider = (model.provider ?? '').toLowerCase();
  const id = model.value.toLowerCase();
  const label = model.label.toLowerCase();
  const haystack = `${provider} ${id} ${label}`;

  if (haystack.includes('openclaw')) return 'OpenClaw';
  if (haystack.includes('anthropic') || haystack.includes('claude')) return 'Anthropic';
  if (haystack.includes('openai') || /(^|\W)(gpt|o1|o3|o4)(\W|$)/.test(haystack)) return 'OpenAI';
  if (haystack.includes('google') || haystack.includes('gemini')) return 'Google';
  if (haystack.includes('xai') || haystack.includes('grok')) return 'xAI';
  if (haystack.includes('meta') || haystack.includes('llama')) return 'Meta';
  if (haystack.includes('mistral')) return 'Mistral';
  if (haystack.includes('deepseek')) return 'DeepSeek';
  if (haystack.includes('cohere')) return 'Cohere';
  if (haystack.includes('qwen') || haystack.includes('alibaba')) return 'Alibaba';
  return 'Other';
}

async function fetchEnabledSkills(userId: string): Promise<EnabledSkill[]> {
  try {
    const res = await fetch('/api/skills?installed=true&limit=100', {
      headers: { 'x-user-id': userId },
    });
    const data = await res.json();
    return (data.data || [])
      .filter((s: { is_installed: boolean }) => s.is_installed)
      .map((s: { skill_id: string; name: string; category: string }) => ({
        skill_id: s.skill_id,
        name: s.name,
        category: s.category,
      }));
  } catch {
    return [];
  }
}

let idCounter = 0;
const uid = () => `f-${Date.now()}-${++idCounter}`;

// ── File helpers ────────────────────────────────────────────────────────────
function classifyFile(file: File): AttachedFile['type'] {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('text/') || /\.(md|txt|csv|json|js|ts|py|css|html|xml|yaml|yml|sh|sql)$/i.test(file.name)) return 'text';
  return 'other';
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function buildFileUIPart(f: AttachedFile): Promise<FileUIPart> {
  const url = f.previewUrl ?? await fileToDataUrl(f.file);
  return { type: 'file', filename: f.file.name, mediaType: f.file.type || 'application/octet-stream', url };
}

// ── Format file size ────────────────────────────────────────────────────────
function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Extract code blocks from assistant message text ────────────────────────
function extractCodeBlocks(text: string): CanvasBlock[] {
  const blocks: CanvasBlock[] = [];
  const re = /```([\w+#-]*)\n?([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const code = m[2]?.trimEnd() ?? '';
    if (code.trim()) {
      blocks.push({ id: uid(), language: m[1]?.toLowerCase() || 'plaintext', code });
    }
  }
  return blocks;
}

// ── Parse [API_KEYS_NEEDED] blocks from assistant message text ─────────────
interface ApiKeyField { name: string; description: string; }

function parseApiKeyBlocks(text: string): { segments: Array<{ type: 'text'; value: string } | { type: 'api_keys'; keys: ApiKeyField[] }> } | null {
  const re = /\[API_KEYS_NEEDED\]\s*\n([\s\S]*?)\n?\[\/API_KEYS_NEEDED\]/g;
  let match: RegExpExecArray | null;
  const segments: Array<{ type: 'text'; value: string } | { type: 'api_keys'; keys: ApiKeyField[] }> = [];
  let lastIndex = 0;
  let found = false;

  while ((match = re.exec(text)) !== null) {
    found = true;
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    const lines = match[1].split('\n').map(l => l.trim()).filter(Boolean);
    const keys: ApiKeyField[] = [];
    for (const line of lines) {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        keys.push({ name: line.slice(0, colonIdx).trim(), description: line.slice(colonIdx + 1).trim() });
      }
    }
    if (keys.length > 0) segments.push({ type: 'api_keys', keys });
    lastIndex = match.index + match[0].length;
  }

  if (!found) return null;
  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }
  return { segments };
}

// ── ApiKeyRequestBlock — renders secure input fields for API key requests ──
function ApiKeyRequestBlock({ keys, onSubmit }: { keys: ApiKeyField[]; onSubmit: (values: Record<string, string>) => void }) {
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [submitted, setSubmitted] = React.useState(false);

  const allFilled = keys.every(k => (values[k.name] ?? '').trim().length > 0);

  const handleSubmit = () => {
    if (!allFilled || submitted) return;
    setSubmitted(true);
    onSubmit(values);
  };

  return (
    <div className="my-3 rounded-xl border border-primary/30 bg-primary/5 dark:bg-primary/10 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-primary">
        <KeyRound className="h-4 w-4" />
        API Keys Required
      </div>
      {keys.map((k) => (
        <div key={k.name} className="space-y-1">
          <label className="text-xs font-medium text-foreground/80">{k.name}</label>
          <p className="text-[11px] text-muted-foreground">{k.description}</p>
          <div className="flex items-center gap-2">
            <input
              type="password"
              placeholder={`Paste your ${k.name}`}
              disabled={submitted}
              value={values[k.name] ?? ''}
              onChange={(e) => setValues(prev => ({ ...prev, [k.name]: e.target.value }))}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-60"
            />
          </div>
        </div>
      ))}
      <button
        onClick={handleSubmit}
        disabled={!allFilled || submitted}
        className={cn(
          'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors',
          submitted
            ? 'bg-green-500/20 text-green-600 dark:text-green-400 cursor-default'
            : allFilled
              ? 'bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
        )}
      >
        {submitted ? (
          <><Check className="h-3 w-3" /> Keys Sent</>
        ) : (
          <><Send className="h-3 w-3" /> Send Keys</>
        )}
      </button>
    </div>
  );
}

// ── Parse [CREATE_AGENT] blocks from assistant message text ────────────────
interface AgentCreateSpec {
  name: string;
  category: string;
  description: string;
  system_prompt: string;
  skills: string;
  tags: string;
}

function parseAgentCreateBlock(text: string): { segments: Array<{ type: 'text'; value: string } | { type: 'create_agent'; spec: AgentCreateSpec }> } | null {
  const re = /\[CREATE_AGENT\]\s*\n([\s\S]*?)\n?\[\/CREATE_AGENT\]/g;
  let match: RegExpExecArray | null;
  const segments: Array<{ type: 'text'; value: string } | { type: 'create_agent'; spec: AgentCreateSpec }> = [];
  let lastIndex = 0;
  let found = false;

  while ((match = re.exec(text)) !== null) {
    found = true;
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    const lines = match[1].split('\n').map(l => l.trim()).filter(Boolean);
    const fields: Record<string, string> = {};
    let currentKey = '';
    for (const line of lines) {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim().toLowerCase().replace(/\s+/g, '_');
        const val = line.slice(colonIdx + 1).trim();
        if (['name', 'category', 'description', 'system_prompt', 'skills', 'tags'].includes(key)) {
          currentKey = key;
          fields[key] = val;
        } else if (currentKey) {
          fields[currentKey] += ' ' + line;
        }
      } else if (currentKey) {
        fields[currentKey] += ' ' + line;
      }
    }
    if (fields.name) {
      segments.push({
        type: 'create_agent',
        spec: {
          name: fields.name || '',
          category: fields.category || 'operations',
          description: fields.description || '',
          system_prompt: fields.system_prompt || '',
          skills: fields.skills || '',
          tags: fields.tags || '',
        },
      });
    }
    lastIndex = match.index + match[0].length;
  }

  if (!found) return null;
  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }
  return { segments };
}

// ── AgentCreateBlock — renders agent preview + create button ───────────────
function AgentCreateBlock({ spec, userId }: { spec: AgentCreateSpec; userId: string }) {
  const [state, setState] = React.useState<'idle' | 'creating' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = React.useState('');
  const [createdName, setCreatedName] = React.useState('');

  const handleCreate = async () => {
    setState('creating');
    try {
      const prompt = [
        `Agent Name: ${spec.name}`,
        `Category: ${spec.category}`,
        `Description: ${spec.description}`,
        `System Prompt: ${spec.system_prompt}`,
        `Skills: ${spec.skills}`,
        `Tags: ${spec.tags}`,
      ].join('\n');

      const res = await fetch('/api/agents/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({ prompt, name: spec.name, category: spec.category }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as Record<string, unknown>;
        throw new Error((body.error as string) || (body.message as string) || `Failed (${res.status})`);
      }

      const data = await res.json() as { agent?: { name?: string } };
      setCreatedName(data.agent?.name || spec.name);
      setState('done');

      // Refresh installed agents list
      useInstalledAgentsStore.getState().loadAgents(userId);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create agent');
      setState('error');
    }
  };

  const skillList = spec.skills.split(',').map(s => s.trim()).filter(Boolean);
  const tagList = spec.tags.split(',').map(s => s.trim()).filter(Boolean);

  return (
    <div className="my-3 rounded-xl border border-violet-500/30 bg-violet-500/5 dark:bg-violet-500/10 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-violet-600 dark:text-violet-400">
        <Wand2 className="h-4 w-4" />
        Agent Ready to Create
      </div>
      <div className="space-y-2">
        <div>
          <span className="text-xs font-medium text-foreground/70">Name: </span>
          <span className="text-sm font-semibold">{spec.name}</span>
        </div>
        <div>
          <span className="text-xs font-medium text-foreground/70">Category: </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 font-medium">{spec.category}</span>
        </div>
        <div>
          <span className="text-xs font-medium text-foreground/70">Description: </span>
          <span className="text-xs text-muted-foreground">{spec.description}</span>
        </div>
        {skillList.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <span className="text-xs font-medium text-foreground/70">Skills: </span>
            {skillList.map((s) => (
              <span key={s} className="text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{s}</span>
            ))}
          </div>
        )}
        {tagList.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <span className="text-xs font-medium text-foreground/70">Tags: </span>
            {tagList.map((t) => (
              <span key={t} className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{t}</span>
            ))}
          </div>
        )}
      </div>

      {state === 'idle' && (
        <button
          onClick={handleCreate}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700 transition-colors cursor-pointer"
        >
          <Wand2 className="h-3 w-3" /> Create Agent
        </button>
      )}
      {state === 'creating' && (
        <div className="flex items-center gap-2 text-xs text-violet-600 dark:text-violet-400">
          <Loader2 className="h-3 w-3 animate-spin" /> Creating agent…
        </div>
      )}
      {state === 'done' && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-green-500/20 text-green-600 dark:text-green-400">
          <Check className="h-3 w-3" /> Agent &ldquo;{createdName}&rdquo; created &amp; installed!
        </div>
      )}
      {state === 'error' && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-red-500">
            <AlertCircle className="h-3 w-3" /> {errorMsg}
          </div>
          <button
            onClick={handleCreate}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700 transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" /> Retry
          </button>
        </div>
      )}
    </div>
  );
}

// ── Suggestion chips ──────────────────────────────────────────────────────
const SUGGESTIONS: { label: string; icon: LucideIcon; prompt: string; guide: string }[] = [
  {
    label: 'E-Commerce Agent',
    icon: ShoppingCart,
    prompt: 'I want to build an e-commerce automation agent — help me set up competitor price monitoring, abandoned cart recovery, or inventory restock alerts.',
    guide: [
      '## Use-Case Guide: E-Commerce Automation Agent',
      '',
      '### What to implement',
      '- **Competitor Price Monitor**: Scrape 5–10 competitor product pages every 4 hours, compare to the user\'s Shopify/WooCommerce catalog, auto-adjust prices within a floor/ceiling range, send nightly Slack digest.',
      '- **Abandoned Cart Recovery**: Monitor abandoned checkouts via webhook, generate personalised recovery messages, send sequenced outreach (Email T+1h → WhatsApp T+24h → SMS T+72h), adapt tone by cart value.',
      '- **Inventory Restock Alerts**: Poll inventory levels every 2 hours, detect SKUs below threshold, draft supplier PO, email supplier, Slack-alert with projected revenue loss.',
      '',
      '### Skills / MCP servers to install',
      'Firecrawl MCP (web scraping), Shopify MCP or WooCommerce REST, Slack Messaging Skill, Google Sheets MCP (change log), Mailchimp/Klaviyo (email sequences), WhatsApp Skill, Stripe MCP (payment confirmation to halt recovery sequence).',
      '',
      '### Documentation / APIs to reference',
      'Shopify Admin API (products, orders, abandoned checkouts), WooCommerce REST API v3, Firecrawl docs (structured extraction), Zernio API for multi-channel messaging, Stripe Webhooks.',
      '',
      '### Data to collect from the user',
      '1. Which e-commerce platform? (Shopify / WooCommerce / other)',
      '2. Store URL and API credentials (API key or OAuth token)',
      '3. Competitor URLs to monitor (list of product pages)',
      '4. Price floor/ceiling rules (min margin %, max discount %)',
      '5. Notification channel preference (Slack workspace + channel, email, Telegram)',
      '6. Inventory restock thresholds per SKU or global minimum',
      '7. Supplier email addresses for automated PO',
    ].join('\n'),
  },
  {
    label: 'Social Media Agent',
    icon: Smartphone,
    prompt: 'I want to build a social media automation agent that repurposes content and posts across multiple platforms like Instagram, TikTok, X, LinkedIn.',
    guide: [
      '## Use-Case Guide: Social Media Multi-Platform Agent',
      '',
      '### What to implement',
      '- **Content Repurposing Pipeline**: User drops a YouTube URL or blog post → agent extracts transcript/text, generates platform-optimised variants (Twitter thread, LinkedIn article, Instagram caption, TikTok script, 5 social posts), schedules via Zernio API, saves drafts to Notion for review.',
      '- **Multi-Channel Publishing**: Trigger from RSS/CMS webhook or manual input → auto-generate channel-specific copy with character limits, tone, hashtags → schedule with timezone-optimised posting times → daily performance digest to Slack.',
      '',
      '### Skills / MCP servers to install',
      'Zernio API (supports 14 platforms: Instagram, TikTok, X, LinkedIn, Facebook, YouTube, Threads, Reddit, Pinterest, Bluesky, Telegram, Snapchat), TranscriptAPI Skill, Notion MCP, Slack Skill, Tavily MCP (trending hashtags research), Gmail Skill (newsletter via Mailchimp MCP).',
      '',
      '### Documentation / APIs to reference',
      'Zernio API docs (post scheduling, bulk CSV upload, cross-platform analytics, first-comment automation, Stories/Reels/Carousels), YouTube Data API (transcripts), Notion API, Buffer/Ayrshare as alternatives.',
      '',
      '### Data to collect from the user',
      '1. Which platforms to post on? (pick from 14 supported)',
      '2. Zernio API key (or preferred social scheduling provider)',
      '3. Content source — YouTube channel URL, blog RSS feed, manual trigger?',
      '4. Brand voice / tone guidelines (formal, casual, witty, etc.)',
      '5. Posting schedule preferences (times, frequency, timezone)',
      '6. Notion workspace for draft review (optional)',
      '7. Slack channel for performance digests',
    ].join('\n'),
  },
  {
    label: 'Lead & Sales Agent',
    icon: MessageSquare,
    prompt: 'I want to build a lead qualification agent that monitors inbound inquiries across WhatsApp, email, and web, qualifies leads, and pushes warm ones to my CRM.',
    guide: [
      '## Use-Case Guide: Lead Qualification & Sales Agent',
      '',
      '### What to implement',
      '- **24/7 Inbound Response**: Monitor all inbound channels, respond to initial inquiries within 60 seconds with AI-generated personalised responses.',
      '- **Conversational Qualification**: Qualify leads by budget/timeline/location via conversational follow-up, score them in CRM.',
      '- **Smart Escalation**: Only escalate warm leads to the human sales rep with full context summary via Telegram/Slack.',
      '- **Churn Risk Detection** (SaaS variant): Monitor engagement data daily, identify users with >50% drop over 14 days, auto-draft outreach, create churn-risk tasks.',
      '',
      '### Skills / MCP servers to install',
      'WhatsApp Skill, Gmail Skill, Facebook Messenger API, HubSpot MCP (or Salesforce/Pipedrive/Zoho CRM via Unified.to MCP), Telegram Skill, Slack Skill, Tavily MCP (company research for lead enrichment).',
      '',
      '### Documentation / APIs to reference',
      'HubSpot CRM API (contacts, deals, sequences), Salesforce REST API, Unified.to MCP docs (416 integrations), WhatsApp Business API, Mixpanel/Posthog API (for churn detection variant).',
      '',
      '### Data to collect from the user',
      '1. Which CRM platform? (HubSpot, Salesforce, Pipedrive, Zoho, other)',
      '2. CRM API credentials',
      '3. Inbound channels to monitor (WhatsApp, email, web form, Facebook Messenger)',
      '4. Lead qualification criteria (budget range, timeline, location, industry)',
      '5. Scoring rubric — what makes a "warm" vs "cold" lead?',
      '6. Escalation channel (Telegram bot token, Slack channel)',
      '7. Business context — what product/service are they selling?',
    ].join('\n'),
  },
  {
    label: 'Scheduling Agent',
    icon: CalendarDays,
    prompt: 'I want to build an appointment reminder and scheduling agent for my clinic or service business — reduce no-shows and collect post-visit reviews.',
    guide: [
      '## Use-Case Guide: Appointment & Scheduling Agent',
      '',
      '### What to implement',
      '- **Appointment Reminders**: Trigger on new Calendly/Google Calendar bookings → WhatsApp confirmation immediately → reminder 48h before → final reminder 2h before with preparation instructions. If no confirmation after 3 touchpoints, voice call via ElevenLabs and flag for reallocation.',
      '- **Post-Visit Follow-Up**: 24h after consultation marked complete → WhatsApp check-in → if sentiment positive, request Google review → log complaints to Notion for practitioner review.',
      '- **Event Lifecycle** (variant): Registration webhook → instant confirmation → pre-event reminders → day-of announcements → post-event feedback forms → testimonial requests for high-NPS respondents.',
      '',
      '### Skills / MCP servers to install',
      'Google Calendar MCP, WhatsApp Skill, Telegram Skill, Gmail Skill, ElevenLabs Agent Skill (voice calls), Google Sheets MCP (patient/client database), Notion MCP (complaint tracker), Slack Skill (staff alerts), Calendly API webhook, Eventbrite/Luma webhook (for events).',
      '',
      '### Documentation / APIs to reference',
      'Google Calendar API, Calendly Webhooks, WhatsApp Business API, ElevenLabs Conversational AI docs, Google Business Profile API (review links), Eventbrite API.',
      '',
      '### Data to collect from the user',
      '1. Scheduling platform? (Google Calendar, Calendly, Outlook, custom)',
      '2. Business type (clinic, salon, coaching, events)',
      '3. Reminder timing preferences (how many hours/days before)',
      '4. Communication channels (WhatsApp, SMS, email, voice call)',
      '5. Google Business Profile URL (for review collection)',
      '6. Staff notification channel (Slack, Telegram)',
      '7. Patient/client database location (Google Sheets, Notion, custom DB)',
    ].join('\n'),
  },
  {
    label: 'Reporting Agent',
    icon: BarChart3,
    prompt: 'I want to build an automated reporting agent that pulls data from tools like Stripe, analytics, and CRM — then delivers weekly reports via Slack or email.',
    guide: [
      '## Use-Case Guide: Automated Analytics & Reporting Agent',
      '',
      '### What to implement',
      '- **Financial Reporting**: On the 1st of each month pull transaction data from Stripe + Xero, consolidate across entities, calculate MRR/churn/gross margin/runway, generate formatted Google Doc, email to board distribution list with anomaly commentary.',
      '- **KPI Dashboard Digest**: Daily pull from Google Analytics 4 / Mixpanel / Posthog, detect anomalies in traffic or conversion, deliver executive digest email.',
      '- **Portfolio Alerts** (finance variant): Poll CoinGecko/CoinMarketCap every 15 min 24/7, detect price movements beyond threshold, fire Telegram alert with position size and suggested action.',
      '',
      '### Skills / MCP servers to install',
      'Stripe MCP, Google Analytics 4 MCP, Mixpanel/Posthog MCP, Google Drive MCP (report generation), Google Sheets MCP (data logs), Gmail Skill (delivery), Slack Skill (digests), Notion MCP (archive), Xero API connector, CoinGecko REST API (crypto variant).',
      '',
      '### Documentation / APIs to reference',
      'Stripe API (charges, subscriptions, balance transactions), GA4 Data API, Mixpanel Export API, Xero Accounting API, CoinGecko API v3, Google Docs API (report generation).',
      '',
      '### Data to collect from the user',
      '1. Data sources to pull from (Stripe, GA4, Mixpanel, Xero, CoinGecko, etc.)',
      '2. API credentials for each data source',
      '3. Report frequency (daily, weekly, monthly)',
      '4. Key metrics to track (MRR, churn rate, conversion rate, traffic, custom)',
      '5. Delivery method (email to whom, Slack channel, Google Drive folder)',
      '6. Anomaly thresholds (e.g. >15% drop triggers alert)',
      '7. Report format preference (Google Doc, PDF, Slack message, Notion page)',
    ].join('\n'),
  },
  {
    label: 'Monitoring Agent',
    icon: Activity,
    prompt: 'I want to build a 24/7 monitoring agent — for competitor tracking, regulatory compliance, content changes, or price alerts.',
    guide: [
      '## Use-Case Guide: 24/7 Monitoring & Alerts Agent',
      '',
      '### What to implement',
      '- **Competitor / Content Monitor**: Run Firecrawl on target URLs every 4–6 hours, detect content changes via diff comparison, summarise what changed, send priority-ranked briefing to Slack.',
      '- **Regulatory Compliance Watch**: Monitor 5–10 government/regulatory portal URLs, detect policy changes, map to affected internal policies in Notion, alert compliance team.',
      '- **User Feedback Aggregation** (SaaS variant): Scrape G2/Capterra reviews, monitor Reddit/Discord mentions, pull Intercom conversations, cluster feedback by theme, create weekly Linear ticket per feature cluster.',
      '- **Contract Deadline Monitor**: Read contract PDFs from Google Drive, extract renewal dates and notice periods, sync to calendar, send alerts at 60/30/7 days before each deadline.',
      '',
      '### Skills / MCP servers to install',
      'Firecrawl MCP (full-site crawling + structured extraction), Tavily MCP (AI-optimised web search), BlogWatcher Skill (content change detection), Slack Skill, Telegram Skill, Gmail Skill, Notion MCP, Google Sheets MCP, Google Drive MCP, PDF Extraction MCP, Linear API, Discord Skill, Intercom MCP.',
      '',
      '### Documentation / APIs to reference',
      'Firecrawl API docs (crawl, scrape, extract), Tavily Search API, G2/Capterra review feeds, Google Drive API, PDF parsing libraries, Linear GraphQL API.',
      '',
      '### Data to collect from the user',
      '1. What to monitor? (competitor sites, regulatory portals, review platforms, contracts)',
      '2. Target URLs to watch (list)',
      '3. Check frequency (every 2h, 4h, 6h, daily)',
      '4. Alert channel (Slack, Telegram, email)',
      '5. Keywords or topics of interest (for filtering relevance)',
      '6. Internal policy/document location (Notion, Google Drive) for cross-referencing',
      '7. Escalation rules (what severity triggers immediate alert vs. weekly digest)',
    ].join('\n'),
  },
  {
    label: 'HubSpot CRM Agent',
    icon: CircleDot,
    prompt: 'I want to connect HubSpot to my OpenClaw assistant — help me set up CRM lookup, deal pipeline management, meeting briefings, or activity logging.',
    guide: [
      '## Use-Case Guide: HubSpot CRM Agent — Guided Onboarding',
      '',
      'Your job is to help the user successfully activate and configure a HubSpot use case inside their personal OpenClaw environment.',
      'This is NOT a one-shot answer task. This is a guided onboarding and setup workflow.',
      '',
      '### Your responsibilities',
      '1. Understand what the user wants to do with HubSpot.',
      '2. Convert that goal into a concrete, implementable use case.',
      '3. Guide the user step by step without overwhelming them.',
      '4. Ask only for information that is still missing.',
      '5. Help the user gather prerequisites in the correct order.',
      '6. Once enough info is collected, install the required skills/plugins/integrations.',
      '7. Configure secrets, environment variables, and defaults.',
      '8. Validate the setup with a real test.',
      '9. Continue asking focused questions until the use case is fully operational.',
      '10. After setup, teach the user how to use the new capability with examples.',
      '',
      '### Core behavior rules',
      '- Never dump all instructions at once. Break setup into clear stages.',
      '- Ask for a small, logical batch of details each turn.',
      '- Always explain why you are asking for each input.',
      '- When the user is blocked, give exact next actions (where to click, what to copy).',
      '- If the user gives partial info, keep moving forward.',
      '- Maintain an internal setup checklist: what is complete, missing, optional, deferrable.',
      '- Prefer least-privilege access — recommend minimum HubSpot scopes first.',
      '- Default to safe rollout: first read-only, then optional write/update, then automations.',
      '- Before enabling write actions or automations, explicitly confirm with the user.',
      '- Adapt the flow to the user\'s real goal — do not force a generic setup.',
      '',
      '### Supported HubSpot use case categories',
      'If the user hasn\'t defined their use case, help them choose:',
      'A. **CRM Lookup Assistant** — search contacts, companies, deals; summarize associated records.',
      'B. **Deal Pipeline Assistant** — list deals by stage, move deals, inspect pipeline health, update deal properties.',
      'C. **Pre-Call / Pre-Meeting Briefing** — summarize a company, contact, open deals, and latest activity before calls.',
      'D. **CRM Logging Assistant** — log notes, create follow-up tasks, attach context to deals/contacts.',
      'E. **Lead Qualification Assistant** — check if a lead exists, inspect company/contact context, update status and ownership.',
      'F. **Workflow / Automation Trigger Assistant** — trigger follow-ups, route records, launch downstream actions.',
      'If the user is unsure, recommend starting with CRM Lookup + Deal Pipeline (easiest and safest).',
      '',
      '### Onboarding flow (follow these stages)',
      '',
      '**STAGE 0 — Detect Existing Setup**',
      'Ask: Do you already have a HubSpot account connected? Have you created a Private App or access token? Do you want read-only, or also update/automation capability?',
      '',
      '**STAGE 1 — Clarify the Intended Use Case**',
      'Narrow the use case before asking for credentials. Offer templates: "Brief me before sales calls", "Show and update my deals by stage", "Look up contacts/companies", "Log follow-up notes/tasks".',
      'Summarize the chosen use case back in one short paragraph and confirm.',
      '',
      '**STAGE 2 — Recommend Minimal Viable Configuration**',
      'Based on use case, explain minimum setup:',
      '- Lookup only: contacts read, companies read, deals read, owners read',
      '- Pipeline updates: + deals write',
      '- Notes/tasks/logging: + relevant write permissions for notes/tasks + associations',
      'Separate: required setup, recommended extras, optional advanced features.',
      '',
      '**STAGE 3 — Guided HubSpot Setup**',
      'Walk through Private App creation one step at a time:',
      '1. Go to HubSpot Settings → Integrations → Private Apps',
      '2. Create new app, name it "OpenClaw Personal Assistant"',
      '3. Enable the scopes needed for selected use case',
      '4. Generate the access token, copy it securely',
      'Wait until user finishes each milestone before proceeding.',
      '',
      '**STAGE 4 — Collect Required Configuration Inputs**',
      'Gather: access token, desired objects, read-only vs write, default pipeline name, default deal stages, sample contact/deal for testing, automation preferences.',
      'For write use cases: ask which pipeline, stage labels, confirmation-every-time preference.',
      '',
      '**STAGE 5 — Install and Configure OpenClaw Skills**',
      'Install/enable HubSpot-related skills, configure secrets/tokens/env vars, set defaults.',
      'Use the [API_KEYS_NEEDED] block format when requesting the HubSpot access token.',
      '',
      '**STAGE 6 — Validate the Setup**',
      'Run real validation: connectivity test, object access test, one realistic query.',
      'Examples: find a known contact, list deals, show pipeline stage for a sample deal.',
      'If validation fails: explain what failed, identify likely cause (scope, token, pipeline mismatch), ask the next corrective question.',
      '',
      '**STAGE 7 — Optional Write Test**',
      'If write capability was requested, get explicit confirmation before the first write.',
      'Perform one safe minimal write: update a low-risk property, create a note/task.',
      'Never perform high-impact updates silently.',
      '',
      '**STAGE 8 — Teach the User**',
      'Give practical example prompts:',
      '- "Find my latest deals in negotiation"',
      '- "Brief me on Acme Corp before my meeting"',
      '- "Show all contacts at Contoso"',
      '- "Move the Zenith deal to Proposal Sent"',
      '- "Create a follow-up task for Sarah next Friday"',
      '',
      '**STAGE 9 — Refine**',
      'Ask: Stay read-only? Require approval for writes? Daily summaries? Calendar/email integration? Speed vs safety vs completeness?',
      '',
      '### Skills / MCP servers to install',
      'HubSpot MCP (CRM read/write), Slack Skill (deal alerts/digests), Gmail Skill (meeting follow-ups), Google Calendar MCP (pre-call briefing trigger), Notion MCP (deal notes archive), Tavily MCP (company research enrichment).',
      '',
      '### Documentation / APIs to reference',
      'HubSpot CRM API v3 (contacts, companies, deals, owners, tasks, notes, tickets, custom objects), HubSpot Private Apps docs, HubSpot Scopes reference, HubSpot Search API, HubSpot Associations API, HubSpot Pipelines API.',
      '',
      '### Data to collect from the user',
      '1. HubSpot account status (connected? Private App exists?)',
      '2. Intended use case category (A–F above, or custom)',
      '3. Read-only vs write/update vs automation',
      '4. HubSpot Private App access token (use [API_KEYS_NEEDED] block)',
      '5. Which CRM objects matter (contacts, companies, deals, tasks, notes, tickets, custom)',
      '6. Default pipeline and stage labels (for deal workflows)',
      '7. Sample contact/company/deal name for validation testing',
      '8. Alert/notification channel (Slack, Telegram, email)',
      '',
      '### First message behavior',
      'Start with: "I can help you set up a HubSpot-powered assistant. We can start with CRM lookup, deal pipeline management, pre-meeting briefings, activity logging, or a custom flow. Which one do you want first, and do you already have a HubSpot Private App or access token ready?"',
      '',
      '### Success criteria',
      'Onboarding is only complete when: use case is defined, credentials collected, skills installed, configuration applied, integration validated with real test, user has example commands, optional improvements are clearly separated from working baseline.',
    ].join('\n'),
  },
  {
    label: 'Crypto Trading Agent',
    icon: Bitcoin,
    prompt: 'I want to build a daily crypto intelligence and trading agent — help me set up fresh news monitoring, signal analysis, trade planning, and Bankr execution.',
    guide: [
      '## Use-Case Guide: Fresh Crypto Intelligence, Trade Planning & Bankr Execution Agent — Guided Onboarding',
      '',
      'You are a specialized crypto intelligence, trade planning, and execution agent inside a per-user OpenClaw environment.',
      'Your mission: help the user build and run a daily crypto workflow that monitors only fresh information, filters and validates market-moving signals, builds a high-confidence daily trade plan, and converts approved plans into orders via Bankr.',
      'This is a guided onboarding + ongoing execution workflow, NOT a one-shot answer task.',
      '',
      '### Core behavior rules',
      '- Never dump all instructions at once. Break setup into clear stages — use a staged wizard approach.',
      '- Ask for a small, logical batch of details each turn and explain why each input matters.',
      '- Maintain an internal setup checklist: what is complete, missing, optional, deferrable.',
      '- When the user is blocked, give exact next actions.',
      '- If the user gives partial info, keep moving forward.',
      '- Default to safe rollout: paper mode first, read-only by default, live only with explicit approval.',
      '- Never rely on stale content, hype alone, or unverified rumors.',
      '',
      '### Critical date & freshness rules (MANDATORY)',
      '- ALWAYS use current UTC date/time as source of truth. Normalize all timestamps to UTC before ranking.',
      '- NEVER analyze items outside allowed freshness windows unless user explicitly asks for historical analysis.',
      '- If a source has no parseable timestamp, treat it as unusable.',
      '- If a post references an old article, use the ORIGINAL publication timestamp, not the repost timestamp.',
      '- Sort all candidate inputs by timestamp descending before analysis.',
      '- When in doubt, prefer a smaller but fresher dataset.',
      '- Default freshness windows:',
      '  - Breaking news/newsroom articles: last 24h',
      '  - X posts: last 6h preferred, max 12h',
      '  - Reddit posts/comments: last 12h',
      '  - On-chain dashboards/fast analytics: last 24h',
      '  - Research/newsletters: last 72h max, lower priority than same-day news',
      '  - Macro/regulatory calendars: upcoming 7 days + all same-day official releases',
      '- If insufficient fresh data, output: "Insufficient fresh data" or "No high-confidence trade today."',
      '',
      '### Default source universe (tiered trust model)',
      '**TIER 0 — Official / Regulatory / Macro** (highest trust): SEC crypto newsroom, Federal Reserve FOMC calendars, CFTC digital asset updates, official protocol/foundation announcements.',
      '**TIER 1 — Major Crypto Newsrooms**: CoinDesk, The Block, Decrypt, Bankless, Bitcoin Magazine.',
      '**TIER 2 — On-Chain / Research**: Glassnode Insights, Nansen Research, Bankr Signals (if available).',
      '**TIER 3 — Fast X Signals** (discovery, not execution): @CoinDesk, @TheBlockCo, @DecryptMedia, @Bankless, @whale_alert, @glassnode, @EricBalchunas.',
      '**TIER 4 — Reddit Sentiment**: r/CryptoCurrency, r/CryptoMarkets, r/BitcoinMarkets, r/ethfinance, r/defi, r/solana.',
      '',
      '**Source reliability rules:**',
      '- Tier 0-2 preferred for trade confirmation. X or Reddit alone must NOT trigger a live trade.',
      '- If a claim appears only on X/Reddit and nowhere else: mark as "Unconfirmed social signal — not tradable yet."',
      '',
      '### Bankr execution & skill strategy',
      'Use Bankr as the execution and wallet infrastructure layer.',
      '**Minimum viable skill set:** bankr (wallet/portfolio/swaps/execution), bankr-signals (transaction-verified signals), quicknode (on-chain balances/gas/confirmations).',
      '**Optional:** helixa (agent identity/reputation context), neynar (Farcaster social source).',
      'Install skills when enough setup info is available. Ask before installing optional skills.',
      '',
      '### Bankr safety rules (MANDATORY)',
      '- Default to paper mode until user explicitly requests live trading.',
      '- Recommend: dedicated Bankr account, dedicated agent wallet, IP allowlisting, recipient allowlisting.',
      '- For live trading collect: max daily loss, max position size, max concurrent positions, allowed tokens/chains, leverage (default: no), slippage tolerance, approval policy.',
      '- If no risk profile is configured, do NOT enable live execution.',
      '- If write access is not explicitly enabled, remain read-only / paper mode.',
      '- Never send funds to new external addresses without explicit user approval.',
      '- If a trade fails risk checks, reject it even if sentiment is bullish.',
      '- For full automation: still require one-time explicit confirmation of live trading risk.',
      '',
      '### Onboarding flow (follow these stages)',
      '',
      '**STAGE 0 — Detect Existing Setup**',
      'Determine: whether Bankr is already connected, whether user has a Bankr API key, whether LLM credits are configured, paper vs live mode preference, which skills are already installed.',
      '',
      '**STAGE 1 — Clarify Trading Workflow**',
      'Ask in logical batches (not all at once):',
      '- Which assets? (BTC, ETH, SOL, etc.)',
      '- Spot only or derivatives too?',
      '- Which chains should Bankr use?',
      '- Time horizon: intraday / swing / event-driven / mixed?',
      '- Output: ideas only, paper trades, or live trades?',
      '- Goal: news-driven / narrative momentum / on-chain confirmation / macro+crypto / hybrid?',
      '',
      '**STAGE 2 — Configure Source Universe**',
      'Help user choose: X watchlist, Reddit watchlist, news sites, on-chain research sources, optional asset-specific official sources. If unsure, start with the defaults above.',
      '',
      '**STAGE 3 — Configure Risk Policy**',
      'Collect: execution mode (research-only/paper/live), account size, max risk per trade (% and absolute), max daily drawdown, max trades/day, weekend trading, avoid major events, stablecoin base (default USDC), token blacklist, leverage policy, approval policy (always confirm / threshold / automatic). Defaults: paper mode, no leverage, user confirmation required.',
      '',
      '**STAGE 4 — Technical Configuration**',
      'Install bankr, bankr-signals, quicknode (+ optional helixa, neynar). Configure API keys using [API_KEYS_NEEDED] block format. Enable only needed permissions. For live mode verify write-capable Bankr key; for paper keep write disabled.',
      '',
      '**STAGE 5 — Validation** (layered)',
      '1. Connectivity test, 2. Balances/portfolio test, 3. Read-only intelligence test, 4. Paper trade simulation, 5. Optional live small-size test (only with explicit approval).',
      'Never claim setup is complete without validation.',
      '',
      '### Daily workflow logic (for each run)',
      '',
      '**PHASE A — Fresh Collection**: Fetch only fresh items from configured sources. Capture title, summary, source, URL, published_at_utc, author, mentioned assets/tickers, mentioned events. Reject items missing timestamps or outside freshness windows. Deduplicate.',
      '',
      '**PHASE B — Event Extraction**: For each item extract: asset(s), event type (regulatory / macro / ETF / protocol / exchange / exploit / unlock / whale / governance / narrative / sentiment / technical), directionality, urgency, confidence, whether likely market-moving in next 24h.',
      '',
      '**PHASE C — Cross-Source Validation**: Check at least one higher-tier source confirms each event. Mark as: confirmed / partially confirmed / unconfirmed. Only confirmed or strongly partially confirmed events can feed live trades.',
      '',
      '**PHASE D — Signal Scoring**: Weighted model — recency (25%), credibility (20%), confirmation (20%), impact (15%), actionability (10%), on-chain confirmation (5%), sentiment quality (5%). Subtract penalties for: rumor-only, influencer-only, low-liquidity token, contradictory sources, stale repost, obvious hype/shill.',
      '',
      '**PHASE E — Market Context Overlay**: Check same-day macro calendar, imminent Fed/regulatory/ETF catalyst risk, risk-on vs risk-off tape, on-chain/flow data support. If story and tape conflict sharply, reduce confidence or reject.',
      '',
      '**PHASE F — Trade Plan Generation**: Each trade idea must include: asset, direction, thesis, catalyst summary, freshness proof, supporting sources, entry logic, execution trigger, invalidation condition, stop logic, target logic, holding horizon, confidence score, position size recommendation, order type, expiry/cancellation condition. If no valid setups: "No high-confidence trade today."',
      '',
      '**PHASE G — Order Conversion**: Research-only: plan only. Paper: simulated orders. Live: check approval policy, verify risk limits/allowed tokens/chains/balance/no duplicate position, place smallest valid order if first time, record metadata.',
      '',
      '### Order policy',
      '- Prefer limit orders unless urgency/liquidity justify market execution.',
      '- Use stop/stop-limit only for breakout/breakdown confirmation theses.',
      '- Use DCA/TWAP for larger allocations or accumulation mode.',
      '- Every order must have: symbol, side, size, chain/venue, trigger, risk note, timestamp UTC, thesis reference.',
      '- If slippage/liquidity/gas conditions are poor, reduce size or skip.',
      '- If news is fresh but contradictory, wait — do not force a trade.',
      '',
      '### Mandatory no-trade conditions',
      'Do NOT create a live trade if: catalyst is stale, timestamp missing, thesis depends on unconfirmed rumor, violates user risk settings, asset not on whitelist, insufficient liquidity, exceeds daily risk budget, too close to major macro release (if user chose to avoid), system cannot explain the edge, user approval not granted.',
      '',
      '### Daily report output format',
      '1. Date/time (UTC), 2. Freshness summary (collected/rejected/used), 3. Top validated narratives, 4. Market regime/risk context, 5. Daily trade plan, 6. Execution recommendations, 7. Orders created/paper/none, 8. Risk notes, 9. Source appendix with timestamps.',
      '',
      '### Skills / MCP servers to install',
      'Bankr Skill (wallet, portfolio, swaps, execution routing), Bankr Signals Skill (transaction-verified signal feed), QuickNode Skill (on-chain balances, gas, confirmations), Firecrawl MCP (news scraping), Tavily MCP (search/research), Slack Skill (alerts/digests), Notion MCP (trade journal), Google Sheets MCP (position tracking). Optional: Helixa (agent reputation), Neynar (Farcaster).',
      '',
      '### Documentation / APIs to reference',
      'Bankr API docs (wallet management, order creation, signal feeds, risk controls), QuickNode API (multi-chain RPC, balance queries), CoinDesk API, The Block API, Glassnode API, Reddit API (subreddit fetching), Twitter/X API (timeline/search), SEC EDGAR RSS feeds, FOMC calendar.',
      '',
      '### Data to collect from the user',
      '1. Bankr account status (connected? API key ready?)',
      '2. Execution mode (research-only / paper / live)',
      '3. Target assets (BTC, ETH, SOL, etc.)',
      '4. Spot or derivatives',
      '5. Preferred chains (Ethereum, Solana, Base, etc.)',
      '6. Time horizon (intraday / swing / event-driven / mixed)',
      '7. Risk parameters (max loss, position size, drawdown, leverage)',
      '8. Source preferences (X accounts, subreddits, news sites)',
      '9. Notification channel (Slack, Telegram, email)',
      '10. Bankr API key (use [API_KEYS_NEEDED] block)',
      '11. QuickNode API key (use [API_KEYS_NEEDED] block)',
      '',
      '### First message behavior',
      'Start with: "I can help you set up a daily crypto intelligence workflow that monitors only fresh information and turns validated signals into paper or live trade plans via Bankr."',
      'Then offer 4 templates: 1) News-driven crypto trading, 2) On-chain confirmed trading, 3) Macro + crypto event trading, 4) Hybrid multi-source daily trade planner.',
      'Ask: research-only, paper, or live? Is Bankr already connected / do you have a Bankr API key? What assets to focus on (BTC/ETH/SOL)?',
      '',
      '### Success criteria',
      'Onboarding is only complete when: trading objective is clear, source universe configured, freshness rules active, required Bankr skills installed, API keys/secrets configured, paper or live mode selected, risk limits configured, validation succeeded, and a same-day test run produced either a valid no-trade conclusion, a valid trade plan, or a paper/live order per user settings. If incomplete, continue guiding — do not end with generic advice.',
    ].join('\n'),
  },
];

const PROVISION_LOGS = [
  'Allocating one (1) metric tonne of RAM...',
  'Bribing the deployment algorithm with CPU cycles...',
  'Herding AI hamsters into the inference pipeline...',
  'Defragmenting the imagination drive...',
  'Teaching the model some basic manners...',
  'Untangling 47 layers of neural spaghetti...',
  'Negotiating uptime with hostile cloud servers...',
  'Installing questionable life choices.exe...',
  'Running final boss battle against null pointers...',
  'Convincing cold GPUs to think warm thoughts...',
  'Synchronising consciousness with the mothership...',
  'Assembling IKEA furniture of the mind...',
  'Warming up neurons — please blow on them...',
  'Resolving merge conflict between brain and deployment...',
  'Last step: pretending this was always the plan...',
];

// ═══════════════════════════════════════════════════════════════════════════════
// ChatPanelInner — the actual chat UI, receives initialMessages
// ═══════════════════════════════════════════════════════════════════════════════
interface ChatPanelInnerProps {
  apiKey: string | null;
  conversationId?: string;
  initialMessages: UIMessage[];
  userId: string;
  onConversationCreated?: (id: string) => void;
  isStreamRecovery?: boolean;
}

function ChatPanelInner({ apiKey, conversationId, initialMessages, userId, onConversationCreated, isStreamRecovery }: ChatPanelInnerProps) {
  const { gatewayToken, gatewayUrl, openaiKey, anthropicKey } = useOpenClawChatStore();
  const authToken = gatewayToken ?? apiKey ?? '';

  // ── Backend Readiness ─────────────────────────────────────────────────────
  const { tenantStatus, isCloudMode, setTenantStatus } = useCloudStore();
  // isCloudMode is not persisted in the store, so also check hostname directly
  const isCloud = isCloudMode || (typeof window !== 'undefined' && window.location.hostname.endsWith('barrsa.com'));
  const backendReady = !isCloud || tenantStatus === 'active';

  // Adaptive polling for provision status — backs off when unchanged
  useAdaptivePoll(
    async () => {
      const res = await fetch('/api/setup/provision/status', { credentials: 'include' });
      if (!res.ok) return { status: 'unknown' };
      return await res.json();
    },
    (data) => {
      const d = data as { status?: string };
      if (d.status === 'active') setTenantStatus('active');
    },
    {
      enabled: !backendReady,
      baseInterval: 5_000,
      maxInterval: 30_000,
      backoffFactor: 1.5,
      shouldStop: (data) => (data as { status?: string }).status === 'active',
    },
  );

  // ── Provision animation (progress bar + cycling logs) ─────────────────────
  const [provisionPercent, setProvisionPercent] = React.useState(3);
  const [provisionLogIdx, setProvisionLogIdx] = React.useState(0);

  React.useEffect(() => {
    if (backendReady) {
      setProvisionPercent(100);
      return;
    }
    const id = setInterval(() => {
      setProvisionLogIdx(i => (i + 1) % PROVISION_LOGS.length);
      setProvisionPercent(p => Math.min(p + Math.floor(Math.random() * 4 + 2), 85));
    }, 2500);
    return () => clearInterval(id);
  }, [backendReady]);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const dropZoneRef = React.useRef<HTMLDivElement>(null);
  const modelRef = React.useRef('openclaw');
  const convRef = React.useRef(conversationId);
  const convCreatingRef = React.useRef(false);
  const skillsRef = React.useRef<EnabledSkill[]>([]);
  const authRef = React.useRef(authToken);
  const skillsUserRef = React.useRef<string | null>(null);
  // Settings overrides — refs so prepareSendMessagesRequest (memoised) always reads latest values
  const gwUrlRef = React.useRef(gatewayUrl);
  const gwTokenRef = React.useRef(gatewayToken);
  const oaiKeyRef = React.useRef(openaiKey);
  const antKeyRef = React.useRef(anthropicKey);
  const useCaseGuideRef = React.useRef<string | undefined>(undefined);

  // ── Sync refs ──────────────────────────────────────────────────────────────
  convRef.current = conversationId;
  authRef.current = authToken;
  gwUrlRef.current = gatewayUrl;
  gwTokenRef.current = gatewayToken;
  oaiKeyRef.current = openaiKey;
  antKeyRef.current = anthropicKey;

  // ── State ──────────────────────────────────────────────────────────────────
  const [input, setInput] = React.useState('');
  const [attachedFiles, setAttachedFiles] = React.useState<AttachedFile[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);
  const [selectedModel, setSelectedModel] = React.useState('openclaw');
  const [modelDropdownOpen, setModelDropdownOpen] = React.useState(false);
  const [modelSearchQuery, setModelSearchQuery] = React.useState('');
  const [modelSaving, setModelSaving] = React.useState(false);
  const { enabledSkills, loaded: skillsLoaded, setEnabledSkills } = useSkillsStore();
  const { agents: installedAgents, selectedAgentId, loaded: agentsLoaded, loadAgents, selectAgent } = useInstalledAgentsStore();
  const [models, setModels] = React.useState<ModelOption[]>(FALLBACK_MODELS);
  const [modelsLoading, setModelsLoading] = React.useState(false);
  const [canvas, setCanvas] = React.useState<{ blocks: CanvasBlock[]; activeId?: string } | null>(null);
  const [agentDropdownOpen, setAgentDropdownOpen] = React.useState(false);
  const agentDropdownRef = React.useRef<HTMLDivElement>(null);
  const agentIdRef = React.useRef<string | null>(selectedAgentId);
  const agentsUserRef = React.useRef<string>('');

  // Sync mutable refs with state
  modelRef.current = selectedModel;
  skillsRef.current = enabledSkills;
  agentIdRef.current = selectedAgentId;

  // ── Transport (created once, uses refs for dynamic values) ─────────────────
  const prepareSendMessagesRequest: PrepareSendMessagesRequest<UIMessage> = React.useCallback(
    ({ messages }) => {
      const guide = useCaseGuideRef.current;
      useCaseGuideRef.current = undefined; // consume once
      return {
      body: {
        messages,
        model: modelRef.current,
        conversationId: convRef.current,
        skills: skillsRef.current.map(s => s.skill_id),
        agentId: agentIdRef.current || undefined,
        useCaseGuide: guide || undefined,
        // Settings overrides — allow UI config to take effect without server restart
        overrideGatewayUrl:    gwUrlRef.current    || undefined,
        overrideGatewayToken:  gwTokenRef.current  || undefined,
        overrideOpenaiKey:     oaiKeyRef.current   || undefined,
        overrideAnthropicKey:  antKeyRef.current   || undefined,
      },
      headers: {
        Authorization: `Bearer ${authRef.current}`,
      },
    };},
    []
  );

  const transport = React.useMemo(
    () => new TextStreamChatTransport({ api: '/api/chat', prepareSendMessagesRequest }),
    [prepareSendMessagesRequest]
  );

  // ── useChat ────────────────────────────────────────────────────────────────
  const { messages, setMessages, sendMessage, status, stop, clearError } = useChat({
    transport,
    messages: initialMessages,
  });

  const isLoading = status === 'streaming' || status === 'submitted';

  // ── Stream recovery: SSE or polling based on feature flag ──────────────────
  const { recovering, setRecovering } = useStreamRecovery(conversationId, setMessages, !!isStreamRecovery);

  // ── Load models ────────────────────────────────────────────────────────────
  React.useEffect(() => {
    setModelsLoading(true);
    fetch('/api/models')
      .then(r => r.json())
      .then(data => {
        const list = (data.models || []) as Array<{ id: string; name: string; provider?: string }>;
        if (list.length > 0) {
          const seen = new Set<string>();
          const deduped = list.filter((m) => {
            if (!m?.id || seen.has(m.id)) return false;
            seen.add(m.id);
            return true;
          });
          setModels(deduped.map(m => ({ value: m.id, label: m.name || m.id, provider: m.provider })));
        }
      })
      .catch(() => {})
      .finally(() => setModelsLoading(false));
  }, []);

  // Load persisted per-user model preference
  React.useEffect(() => {
    fetch('/api/chat/model', { headers: { 'x-user-id': userId } })
      .then(r => r.json())
      .then((data: { model?: string }) => {
        if (data.model && typeof data.model === 'string') {
          setSelectedModel(data.model);
        }
      })
      .catch(() => {});
  }, [userId]);

  // ── Load skills ────────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!skillsLoaded || skillsUserRef.current !== userId) {
      skillsUserRef.current = userId;
      fetchEnabledSkills(userId).then(setEnabledSkills);
    }
  }, [skillsLoaded, userId, setEnabledSkills]);

  // ── Load installed agents ──────────────────────────────────────────────────
  React.useEffect(() => {
    if (!agentsLoaded || agentsUserRef.current !== userId) {
      agentsUserRef.current = userId;
      loadAgents(userId);
    }
  }, [agentsLoaded, userId, loadAgents]);

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  React.useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  // ── Auto-open canvas when assistant sends HTML code blocks ─────────────────
  const lastCanvasCheckRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (status !== 'ready' || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== 'assistant' || lastMsg.id === lastCanvasCheckRef.current) return;
    lastCanvasCheckRef.current = lastMsg.id;
    const text = lastMsg.parts
      ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map(p => p.text)
      .join('') ?? '';
    const blocks = extractCodeBlocks(text);
    // Only auto-open canvas for HTML blocks — other languages stay collapsed
    const htmlBlocks = blocks.filter(b => b.language === 'html');
    if (htmlBlocks.length > 0) {
      setCanvas({ blocks: htmlBlocks, activeId: htmlBlocks[0].id });
    }
  }, [messages, status]);

  // ── Focus input ───────────────────────────────────────────────────────────
  React.useEffect(() => { inputRef.current?.focus(); }, []);

  // ── Close model dropdown on outside click ─────────────────────────────────
  const modelDropdownRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!modelDropdownOpen) return;
    const h = (e: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [modelDropdownOpen]);

  React.useEffect(() => {
    if (!modelDropdownOpen) {
      setModelSearchQuery('');
    }
  }, [modelDropdownOpen]);

  // ── Close agent dropdown on outside click ──────────────────────────────────
  React.useEffect(() => {
    if (!agentDropdownOpen) return;
    const h = (e: MouseEvent) => {
      if (agentDropdownRef.current && !agentDropdownRef.current.contains(e.target as Node)) {
        setAgentDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [agentDropdownOpen]);

  const chooseModel = React.useCallback(async (model: string) => {
    setSelectedModel(model);
    setModelDropdownOpen(false);
    setModelSaving(true);
    try {
      await fetch('/api/chat/model', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({ model }),
      });
    } catch {
      // Ignore persistence failures; local selection still works for the session.
    } finally {
      setModelSaving(false);
    }
  }, [userId]);

  // ── Handle file selection ──────────────────────────────────────────────────
  const addFiles = React.useCallback(async (newFiles: File[]) => {
    const toAdd: AttachedFile[] = await Promise.all(
      newFiles.map(async f => {
        const type = classifyFile(f);
        const previewUrl = type === 'image' ? await fileToDataUrl(f) : undefined;
        return { id: uid(), file: f, previewUrl, type };
      })
    );
    setAttachedFiles(prev => [...prev, ...toAdd]);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) addFiles(files);
    e.target.value = '';
  };

  const removeFile = (id: string) => setAttachedFiles(prev => prev.filter(f => f.id !== id));

  // ── Drag & drop ────────────────────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) addFiles(files);
  };

  // ── Paste images ───────────────────────────────────────────────────────────
  const handlePaste = React.useCallback((e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter(it => it.kind === 'file' && it.type.startsWith('image/'));
    if (imageItems.length === 0) return;
    e.preventDefault();
    const files = imageItems.map(it => it.getAsFile()).filter((f): f is File => f !== null);
    addFiles(files);
  }, [addFiles]);

  // ── Send ───────────────────────────────────────────────────────────────────
  const handleSend = React.useCallback(async () => {
    const text = input.trim();
    if (!text && attachedFiles.length === 0) return;
    if (isLoading) return;
    if (!backendReady) return;

    clearError();
    setInput('');

    if (attachedFiles.length === 0) {
      sendMessage({ text });
    } else {
      const fileParts = await Promise.all(attachedFiles.map(buildFileUIPart));
      setAttachedFiles([]);
      sendMessage({ text: text || undefined, files: fileParts });
    }

    // Auto-create a conversation on first message if none is active
    if (!convRef.current && !convCreatingRef.current) {
      convCreatingRef.current = true;
      fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({ title: text.slice(0, 60) || 'New Chat' }),
      })
        .then((res) => res.json() as Promise<{ conversation?: { id: string } }>)
        .then((data) => {
          if (data.conversation?.id) {
            convRef.current = data.conversation.id;
            onConversationCreated?.(data.conversation.id);
          }
        })
        .catch(() => { /* proceed even without a saved conversation */ })
        .finally(() => { convCreatingRef.current = false; });
    }
  }, [input, attachedFiles, isLoading, sendMessage, clearError, userId, onConversationCreated]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // ── Auto-resize textarea ───────────────────────────────────────────────────
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
  };

  // ── Canvas ─────────────────────────────────────────────────────────────────
  const handleCodeOpen = React.useCallback((code: string, language: string) => {
    setCanvas({ blocks: [{ id: uid(), code, language }] });
  }, []);

  const handleOpenAllCanvasBlocks = React.useCallback((msgText: string) => {
    const blocks = extractCodeBlocks(msgText);
    if (blocks.length > 0) setCanvas({ blocks, activeId: blocks[0].id });
  }, []);

  // ── Render message parts ───────────────────────────────────────────────────
  const renderMessageParts = React.useCallback((msg: UIMessage) => {
    if (!msg.parts || msg.parts.length === 0) {
      return <p className="text-sm whitespace-pre-wrap leading-relaxed">{String((msg as { content?: unknown }).content ?? '')}</p>;
    }

    return (
      <React.Fragment>
        {msg.parts.map((part, i) => {
          if (part.type === 'text') {
            if (msg.role === 'assistant') {
              const text = part.text;
              const codeBlocks = extractCodeBlocks(text);
              const agentCreateParsed = parseAgentCreateBlock(text);
              const apiKeyParsed = parseApiKeyBlocks(text);

              // If the message contains [CREATE_AGENT] blocks, split and render them inline
              if (agentCreateParsed) {
                return (
                  <div key={i}>
                    {agentCreateParsed.segments.map((seg, si) => {
                      if (seg.type === 'text') {
                        // Within text segments, also check for API key blocks
                        const innerApi = parseApiKeyBlocks(seg.value);
                        if (innerApi) {
                          return (
                            <React.Fragment key={si}>
                              {innerApi.segments.map((iseg, isi) =>
                                iseg.type === 'text'
                                  ? <Markdown key={isi} content={iseg.value || '…'} onCodeBlockOpen={handleCodeOpen} />
                                  : <ApiKeyRequestBlock key={isi} keys={iseg.keys} onSubmit={(vals) => {
                                      const t = Object.entries(vals).map(([k, v]) => `${k}: ${v}`).join('\n');
                                      sendMessage({ text: `Here are the requested API keys:\n${t}` });
                                    }} />
                              )}
                            </React.Fragment>
                          );
                        }
                        return <Markdown key={si} content={seg.value || '…'} onCodeBlockOpen={handleCodeOpen} />;
                      }
                      return <AgentCreateBlock key={si} spec={seg.spec} userId={userId} />;
                    })}
                    {codeBlocks.length > 1 && (
                      <button
                        onClick={() => handleOpenAllCanvasBlocks(text)}
                        className="mt-2 flex items-center gap-1.5 px-3 py-1 rounded-lg border border-primary/30 text-primary text-xs hover:bg-primary/10 transition-colors"
                      >
                        <Code2 className="h-3 w-3" />
                        Open {codeBlocks.length} blocks in Canvas
                      </button>
                    )}
                  </div>
                );
              }

              // If the message contains [API_KEYS_NEEDED] blocks, split and render them inline
              if (apiKeyParsed) {
                return (
                  <div key={i}>
                    {apiKeyParsed.segments.map((seg, si) => {
                      if (seg.type === 'text') {
                        return <Markdown key={si} content={seg.value || '…'} onCodeBlockOpen={handleCodeOpen} />;
                      }
                      return (
                        <ApiKeyRequestBlock
                          key={si}
                          keys={seg.keys}
                          onSubmit={(vals) => {
                            const text = Object.entries(vals).map(([k, v]) => `${k}: ${v}`).join('\n');
                            sendMessage({ text: `Here are the requested API keys:\n${text}` });
                          }}
                        />
                      );
                    })}
                    {codeBlocks.length > 1 && (
                      <button
                        onClick={() => handleOpenAllCanvasBlocks(text)}
                        className="mt-2 flex items-center gap-1.5 px-3 py-1 rounded-lg border border-primary/30 text-primary text-xs hover:bg-primary/10 transition-colors"
                      >
                        <Code2 className="h-3 w-3" />
                        Open {codeBlocks.length} blocks in Canvas
                      </button>
                    )}
                  </div>
                );
              }

              return (
                <div key={i}>
                  <Markdown
                    content={text || '…'}
                    onCodeBlockOpen={handleCodeOpen}
                  />
                  {codeBlocks.length > 1 && (
                    <button
                      onClick={() => handleOpenAllCanvasBlocks(text)}
                      className="mt-2 flex items-center gap-1.5 px-3 py-1 rounded-lg border border-primary/30 text-primary text-xs hover:bg-primary/10 transition-colors"
                    >
                      <Code2 className="h-3 w-3" />
                      Open {codeBlocks.length} blocks in Canvas
                    </button>
                  )}
                </div>
              );
            }
            return <p key={i} className="text-sm whitespace-pre-wrap leading-relaxed">{part.text}</p>;
          }

          if (part.type === 'file') {
            const fp = part as { type: 'file'; url: string; mediaType: string; filename?: string };
            if (fp.mediaType?.startsWith('image/')) {
              return (
                <div key={i} className="mt-2 max-w-xs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={fp.url}
                    alt={fp.filename ?? 'image'}
                    className="rounded-lg max-h-64 object-contain border border-border/50 shadow-sm"
                  />
                  {fp.filename && <p className="text-[10px] text-muted-foreground mt-1">{fp.filename}</p>}
                </div>
              );
            }
            return (
              <div key={i} className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-background/40 border border-border/50 max-w-xs">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{fp.filename ?? 'File'}</p>
                  <p className="text-[10px] text-muted-foreground">{fp.mediaType}</p>
                </div>
              </div>
            );
          }

          return null;
        })}
      </React.Fragment>
    );
  }, [handleCodeOpen, handleOpenAllCanvasBlocks, sendMessage, userId]);

  const currentModelLabel = models.find(m => m.value === selectedModel)?.label ?? selectedModel;
  const selectedAgent = installedAgents.find(a => a.agent_id === selectedAgentId);
  const modelGroups = React.useMemo(() => {
    const q = modelSearchQuery.trim().toLowerCase();
    const filtered = q
      ? models.filter((m) => {
          const company = resolveModelCompany(m).toLowerCase();
          return (
            m.label.toLowerCase().includes(q) ||
            m.value.toLowerCase().includes(q) ||
            (m.provider ?? '').toLowerCase().includes(q) ||
            company.includes(q)
          );
        })
      : models;

    // When searching, show a flat list under matching company groups
    const groups = new Map<string, ModelOption[]>();
    for (const model of filtered) {
      const company = resolveModelCompany(model);
      if (!groups.has(company)) groups.set(company, []);
      groups.get(company)!.push(model);
    }

    const sorted = Array.from(groups.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([company, items]) => ({ company, items }));

    // Prepend a Popular group when not searching
    if (!q) {
      const popular = buildPopular(models);
      if (popular.length > 0) {
        return [{ company: '⭐ Popular', items: popular }, ...sorted];
      }
    }

    return sorted;
  }, [models, modelSearchQuery]);
  const hasMessages = messages.length > 0;
  const agentLocked = hasMessages;

  return (
    <div
      className="flex h-full min-h-0 bg-background overflow-hidden"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* ── Main chat column ── */}
      <div className={cn('flex flex-col h-full min-h-0 flex-1 min-w-0 overflow-hidden transition-all duration-300', canvas && 'hidden md:flex')}>

        {/* ── Header ── */}
        <div className="px-5 py-3 border-b border-border/50 bg-background/95 backdrop-blur-sm flex items-center gap-3 shrink-0">
          <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center shrink-0 shadow-md', selectedAgent ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-primary via-primary/90 to-violet-600')}>
            {selectedAgent ? <Cpu className="h-4.5 w-4.5 text-white" /> : <Zap className="h-4.5 w-4.5 text-white" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-foreground leading-tight">
              {selectedAgent ? selectedAgent.name : 'Barrsa Assistant'}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={cn('h-1.5 w-1.5 rounded-full', isLoading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400')} />
              <p className="text-[11px] text-muted-foreground">
                {recovering ? 'Resuming…' : isLoading ? 'Thinking…' : selectedAgent ? selectedAgent.category || 'Agent' : 'Online'}
              </p>
            </div>
          </div>

          {/* Skills badge */}
          {enabledSkills.length > 0 && (
            <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 text-xs font-medium">
              <Sparkles className="h-3.5 w-3.5" />
              <span>{enabledSkills.length}</span>
            </div>
          )}
        </div>

        {/* ── Messages ── */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

            {/* Empty state / provisioning loading screen */}
            {!hasMessages && (
              !backendReady ? (
                <div className="flex flex-col items-center justify-center min-h-[55vh] px-4">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                    <Cpu className="h-8 w-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold text-foreground mb-1.5 tracking-tight">
                    Your backend is warming up
                  </h2>
                  <p className="text-sm text-muted-foreground mb-8 text-center max-w-xs leading-relaxed">
                    We are deploying your personal AI backend. This usually takes 2&ndash;5 minutes on first launch.
                  </p>
                  <div className="w-full max-w-sm space-y-3">
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
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center min-h-[55vh] text-center px-4">
                  <div className="relative mb-6">
                    <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10 flex items-center justify-center">
                      <Zap className="h-10 w-10 text-primary" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-emerald-400 border-2 border-background flex items-center justify-center">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mb-2 tracking-tight">What agent do you want to build?</h2>
                  <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
                    Pick a use case below, or describe your own — I'll guide you through the setup, skills, and integrations.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-8 w-full max-w-xl">
                    {SUGGESTIONS.map(s => {
                      const Icon = s.icon;
                      return (
                        <button
                          key={s.label}
                          type="button"
                          onClick={() => { useCaseGuideRef.current = s.guide; setInput(s.prompt); inputRef.current?.focus(); }}
                          className="group/chip px-3.5 py-3 rounded-xl border border-border/60 bg-card hover:bg-primary/5 hover:border-primary/30 text-xs text-muted-foreground hover:text-foreground transition-all text-left leading-snug flex items-center gap-2.5"
                        >
                          <div className="h-7 w-7 rounded-lg bg-primary/8 group-hover/chip:bg-primary/15 flex items-center justify-center shrink-0 transition-colors">
                            <Icon className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <span className="font-medium">{s.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )
            )}

            {/* Messages */}
            {messages.map(msg => (
              <div key={msg.id} className={cn('flex gap-3 group', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                {msg.role === 'assistant' && (
                  <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary/15 to-violet-500/10 flex items-center justify-center shrink-0 mt-0.5 border border-primary/15">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}

                <div className={cn(
                  'max-w-[85%] rounded-2xl px-4 py-3 shadow-sm',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-muted/50 dark:bg-muted/30 border border-border/50 rounded-bl-sm',
                )}>
                  {msg.role === 'assistant' ? (
                    <div className="text-sm leading-relaxed [&_.markdown-prose]:text-foreground [&_.prose-text]:text-foreground/90 [&_.md-p]:mb-2 [&_.md-h1]:text-xl [&_.md-h1]:font-bold [&_.md-h1]:mb-3 [&_.md-h2]:text-lg [&_.md-h2]:font-semibold [&_.md-h2]:mb-2 [&_.md-h3]:text-base [&_.md-h3]:font-semibold [&_.md-h3]:mb-1.5 [&_.md-ul]:list-disc [&_.md-ul]:pl-5 [&_.md-ul]:mb-2 [&_.md-ol]:list-decimal [&_.md-ol]:pl-5 [&_.md-ol]:mb-2 [&_.md-uli]:mb-1 [&_.md-oli]:mb-1 [&_.md-link]:text-primary [&_.md-link]:underline [&_.md-blockquote]:border-l-4 [&_.md-blockquote]:border-primary/40 [&_.md-blockquote]:pl-3 [&_.md-blockquote]:italic [&_.md-blockquote]:text-muted-foreground [&_.inline-code]:bg-muted [&_.inline-code]:px-1.5 [&_.inline-code]:py-0.5 [&_.inline-code]:rounded [&_.inline-code]:font-mono [&_.inline-code]:text-[11px] [&_.inline-code]:text-primary">
                      {renderMessageParts(msg)}
                    </div>
                  ) : (
                    <div className="text-sm">
                      {renderMessageParts(msg)}
                    </div>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 border border-primary/20">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                )}
              </div>
            ))}

            {/* Streaming typing indicator (when submitted but no messages yet from assistant) */}
            {(status === 'submitted' || recovering) && (
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary/15 to-violet-500/10 flex items-center justify-center shrink-0 border border-primary/15">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="rounded-2xl px-4 py-3 bg-muted/50 dark:bg-muted/30 border border-border/50 rounded-bl-sm">
                  <div className="flex items-center gap-1.5 h-5">
                    <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                    {recovering && <span className="ml-2 text-xs text-muted-foreground">Still generating…</span>}
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {status === 'error' && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200/60 dark:border-red-900/30 text-red-600 dark:text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="text-sm flex-1">Something went wrong. Please try again.</span>
                <button
                  onClick={() => { clearError(); }}
                  className="flex items-center gap-1 text-xs font-medium hover:underline shrink-0"
                >
                  <RotateCcw className="h-3 w-3" />
                  Dismiss
                </button>
              </div>
            )}

            <div ref={scrollRef} />
          </div>
        </div>

        {/* ── Drag overlay ── */}
        {isDragging && (
          <div className="absolute inset-0 z-40 bg-primary/5 border-2 border-dashed border-primary/40 rounded-lg flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <FileIcon className="h-12 w-12 text-primary/60 mx-auto mb-2" />
              <p className="text-primary font-semibold text-sm">Drop files to attach</p>
            </div>
          </div>
        )}

        {/* ── Input Area ── */}
        <div className="border-t border-border/50 bg-background/95 backdrop-blur-sm px-4 py-3 shrink-0">
          <div className="max-w-3xl mx-auto">

            {/* Composer toolbar: model selector + agent selector */}
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="flex items-center gap-2">
                {/* Model selector */}
                <div className="relative" ref={modelDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setModelDropdownOpen(o => !o)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs text-foreground transition-colors max-w-[220px]"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="truncate">{currentModelLabel}</span>
                    {modelSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
                    <ChevronDown className={cn('h-3 w-3 text-muted-foreground shrink-0 transition-transform', modelDropdownOpen && 'rotate-180')} />
                  </button>
                {modelDropdownOpen && (
                  <div className="absolute left-0 bottom-full mb-1.5 w-80 rounded-xl border border-border bg-card shadow-xl z-50 max-h-96 overflow-hidden">
                    {modelsLoading ? (
                      <div className="flex items-center justify-center py-5">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <>
                        <div className="p-2 border-b border-border/60">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <input
                              value={modelSearchQuery}
                              onChange={(e) => setModelSearchQuery(e.target.value)}
                              placeholder="Search models or provider..."
                              className="w-full pl-8 pr-3 py-2 rounded-lg border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                          </div>
                        </div>

                        <div className="max-h-80 overflow-y-auto py-1.5">
                          {modelGroups.length === 0 ? (
                            <p className="px-3.5 py-3 text-xs text-muted-foreground">No models match your search.</p>
                          ) : (
                            modelGroups.map((group) => (
                              <div key={group.company} className="py-1">
                                <p className="px-3.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80">
                                  {group.company}
                                </p>
                                {group.items.map((m) => (
                                  <button
                                    key={m.value}
                                    type="button"
                                    onClick={() => { void chooseModel(m.value); }}
                                    className={cn(
                                      'flex items-center gap-2.5 w-full px-3.5 py-2.5 text-sm transition-colors text-left',
                                      selectedModel === m.value ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted',
                                    )}
                                  >
                                    <div className="w-4 shrink-0 flex items-center justify-center">
                                      {selectedModel === m.value && <Check className="h-3.5 w-3.5" />}
                                    </div>
                                    <div className="flex flex-col min-w-0 flex-1">
                                      <span className="truncate text-sm">{m.label}</span>
                                      <span className="text-[10px] text-muted-foreground capitalize">
                                        {m.provider || group.company}
                                      </span>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Agent selector */}
              <div className="relative" ref={agentDropdownRef}>
                <button
                  type="button"
                  onClick={() => !agentLocked && setAgentDropdownOpen(o => !o)}
                  disabled={agentLocked}
                  title={agentLocked ? 'Start a new chat to change agent' : undefined}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-colors max-w-[200px]',
                    agentLocked
                      ? 'border-border/40 bg-card/50 text-muted-foreground cursor-not-allowed opacity-60'
                      : selectedAgent
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20'
                        : 'border-border bg-card hover:bg-muted text-foreground',
                  )}
                >
                  {agentLocked
                    ? <Lock className="h-3.5 w-3.5 shrink-0" />
                    : <Cpu className="h-3.5 w-3.5 shrink-0" />}
                  <span className="truncate">{selectedAgent ? selectedAgent.name : 'No agent'}</span>
                  {!agentLocked && <ChevronDown className={cn('h-3 w-3 text-muted-foreground shrink-0 transition-transform', agentDropdownOpen && 'rotate-180')} />}
                </button>
                {agentDropdownOpen && !agentLocked && (
                  <div className="absolute left-0 bottom-full mb-1.5 w-72 rounded-xl border border-border bg-card shadow-xl z-50 max-h-80 overflow-hidden">
                    <div className="max-h-72 overflow-y-auto py-1.5">
                      {/* None option */}
                      <button
                        type="button"
                        onClick={() => { selectAgent(null); setAgentDropdownOpen(false); }}
                        className={cn(
                          'flex items-center gap-2.5 w-full px-3.5 py-2.5 text-sm transition-colors text-left',
                          !selectedAgentId ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted',
                        )}
                      >
                        <div className="w-4 shrink-0 flex items-center justify-center">
                          {!selectedAgentId && <Check className="h-3.5 w-3.5" />}
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-sm">Default OpenClaw</span>
                          <span className="text-[10px] text-muted-foreground">No agent personality</span>
                        </div>
                      </button>

                      {installedAgents.length === 0 ? (
                        <p className="px-3.5 py-3 text-xs text-muted-foreground">
                          No agents installed. Visit Agent Builder or Marketplace to add agents.
                        </p>
                      ) : (
                        installedAgents.map(a => (
                          <button
                            key={a.agent_id}
                            type="button"
                            onClick={() => { selectAgent(a.agent_id); setAgentDropdownOpen(false); }}
                            className={cn(
                              'flex items-center gap-2.5 w-full px-3.5 py-2.5 text-sm transition-colors text-left',
                              selectedAgentId === a.agent_id ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted',
                            )}
                          >
                            <div className="w-4 shrink-0 flex items-center justify-center">
                              {selectedAgentId === a.agent_id && <Check className="h-3.5 w-3.5" />}
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="truncate text-sm">{a.name}</span>
                              <span className="text-[10px] text-muted-foreground capitalize">{a.category || 'General'}</span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              </div>

              {enabledSkills.length > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-400 text-[11px] font-medium">
                  <Sparkles className="h-3 w-3" />
                  <span>{enabledSkills.length} skills</span>
                </div>
              )}
            </div>

            {/* File previews */}
            {attachedFiles.length > 0 && (
              <div className="flex gap-2 mb-2.5 flex-wrap">
                {attachedFiles.map(af => (
                  <div key={af.id} className="relative group">
                    {af.type === 'image' && af.previewUrl ? (
                      <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={af.previewUrl} alt={af.file.name} className="h-16 w-16 object-cover rounded-lg border border-border shadow-sm" />
                        <button
                          type="button"
                          onClick={() => removeFile(af.id)}
                          className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-foreground text-background flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 rounded-b-lg px-1 py-0.5">
                          <p className="text-[9px] text-white truncate">{fmtSize(af.file.size)}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 bg-muted rounded-lg pl-2.5 pr-1 py-1.5 text-xs max-w-[150px] border border-border">
                        {af.type === 'text' ? (
                          <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                        ) : (
                          <FileIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                        <span className="truncate">{af.file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeFile(af.id)}
                          className="text-muted-foreground hover:text-foreground transition-colors shrink-0 ml-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2 rounded-2xl border border-border bg-muted/30 dark:bg-muted/20 px-3 py-2.5 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/40 transition-all">
              {/* Attach button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Attach file (or drag & drop / paste image)"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,text/*,.pdf,.doc,.docx,.xls,.xlsx,.json,.yaml,.yml,.md,.csv,.sql"
                onChange={handleFileInput}
                className="hidden"
              />

              {/* Textarea */}
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="Message OpenClaw… (⌘+Enter or Shift+Enter for newline)"
                rows={1}
                disabled={isLoading || !backendReady}
                className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none resize-none leading-relaxed min-h-[28px] max-h-32 disabled:opacity-50"
                style={{ paddingTop: '2px', paddingBottom: '2px' }}
              />

              {/* Hint: paste images */}
              {input.length === 0 && attachedFiles.length === 0 && (
                <div className="flex items-center gap-1 text-muted-foreground/40 shrink-0">
                  <ImageIcon className="h-3.5 w-3.5" />
                </div>
              )}

              {/* Send / Stop */}
              {isLoading ? (
                <button
                  type="button"
                  onClick={stop}
                  className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                >
                  <StopCircle className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={(!input.trim() && attachedFiles.length === 0) || !backendReady}
                  className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between mt-1.5 px-1">
              <p className="text-[10px] text-muted-foreground/60">
                Drag & drop files · paste images · Shift+Enter for newline
              </p>
              <p className="text-[10px] text-muted-foreground/40">
                May produce errors
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Code Canvas panel ── */}
      {canvas && (
        <div className="w-full md:w-[45%] md:min-w-[380px] md:max-w-[600px] h-full border-l border-border/50 flex flex-col overflow-hidden">
          <CodeCanvas
            blocks={canvas.blocks}
            activeId={canvas.activeId}
            onClose={() => setCanvas(null)}
          />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ChatPanel — outer wrapper that loads history then renders inner
// ═══════════════════════════════════════════════════════════════════════════════
export function ChatPanel({ apiKey, conversationId, onConversationCreated }: Readonly<{ apiKey: string | null; conversationId?: string; onConversationCreated?: (id: string) => void }>) {
  const { user, agent } = useAuth();
  const userId = user?.id || agent?.id || 'anonymous';
  const [initialMessages, setInitialMessages] = React.useState<UIMessage[]>([]);
  const [historyLoading, setHistoryLoading] = React.useState(!!conversationId);
  const [streamRecovery, setStreamRecovery] = React.useState(false);

  React.useEffect(() => {
    // Capture the conversationId at mount time only.
    // When a conversation is auto-created (undefined→id) we do NOT re-fetch — the
    // ChatPanelInner is already live with the correct messages in useChat state.
    const initialConvId = conversationId;
    if (!initialConvId) { setHistoryLoading(false); setInitialMessages([]); return; }
    let cancelled = false;
    setHistoryLoading(true);
    fetch(`/api/conversations/${initialConvId}/messages`)
      .then(r => r.json())
      .then((data: { messages?: DBMessage[]; isStreaming?: boolean }) => {
        if (cancelled) return;
        const msgs: UIMessage[] = (data.messages ?? []).map(m => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          parts: [{ type: 'text' as const, text: m.content }],
        }));
        setInitialMessages(msgs);
        if (data.isStreaming) { setStreamRecovery(true); }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — only run on mount with the initial conversationId

  if (historyLoading) {
    return <ChatSkeleton />;
  }

  return (
    <ChatPanelInner
      apiKey={apiKey}
      conversationId={conversationId}
      initialMessages={initialMessages}
      userId={userId}
      onConversationCreated={onConversationCreated}
      isStreamRecovery={streamRecovery}
    />
  );
}
