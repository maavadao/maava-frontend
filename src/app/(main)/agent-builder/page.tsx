'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks';
import { PageContainer } from '@/components/layout';
import { Button } from '@/components/ui';
import { ROUTES, AGENT_CATEGORIES } from '@/lib/constants';
import Link from 'next/link';
import {
  Bot, Sparkles, Loader2, ArrowLeft, Wand2, CheckCircle2,
  Brain, Zap, Clock, Radio, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const TEMPLATES = [
  {
    label: 'Customer Support Bot',
    prompt: 'Create an AI agent that handles customer support inquiries. It should be friendly, patient, and able to answer FAQs, route complex issues to humans, and follow up on tickets. It should work 24/7 and support multiple languages.',
    category: 'customer-support',
  },
  {
    label: 'Code Review Assistant',
    prompt: 'Create an AI coding assistant that reviews code for bugs, security issues, and best practices. It should understand TypeScript, Python, and Go. It should provide detailed explanations and suggest fixes.',
    category: 'coding',
  },
  {
    label: 'Content Writer',
    prompt: 'Create an AI content writing agent that creates blog posts, social media content, and marketing copy. It should match brand voice, optimize for SEO, and suggest engaging headlines.',
    category: 'writing',
  },
  {
    label: 'Data Analyst',
    prompt: 'Create an AI data analysis agent that helps interpret datasets, create visualizations descriptions, identify trends, and generate reports. It should explain findings in plain language.',
    category: 'data',
  },
  {
    label: 'DevOps Monitor',
    prompt: 'Create a DevOps monitoring agent that checks server health, monitors CI/CD pipelines, and alerts about failures. It should run on a heartbeat schedule every 5 minutes and provide actionable alerts.',
    category: 'operations',
  },
  {
    label: 'Sales Outreach Agent',
    prompt: 'Create a sales outreach AI agent that qualifies leads, drafts personalized outreach emails, follows up on conversations, and tracks pipeline metrics. It should be persuasive but not pushy.',
    category: 'sales',
  },
];

export default function AgentBuilderPage() {
  const router = useRouter();
  const { isAuthenticated, user, agent, apiKey } = useAuth();
  const userId = user?.id || agent?.id;

  const [prompt, setPrompt] = useState('');
  const [agentName, setAgentName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedAgent, setGeneratedAgent] = useState<Record<string, unknown> | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim() || prompt.trim().length < 10) {
      setError('Please describe your agent in at least 10 characters.');
      return;
    }
    setIsGenerating(true);
    setError(null);
    setGeneratedAgent(null);

    try {
      const gatewayToken = typeof window !== 'undefined'
        ? JSON.parse(localStorage.getItem('mawadao-openclaw-chat') || '{}')?.state?.gatewayToken
        : null;
      const token = gatewayToken || apiKey;

      const res = await fetch('/api/agents/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId || 'anonymous',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          name: agentName.trim() || undefined,
          category: selectedCategory || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate agent');
      }

      setGeneratedAgent(data.agent);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate agent');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUseTemplate = (template: typeof TEMPLATES[0]) => {
    setPrompt(template.prompt);
    setSelectedCategory(template.category);
  };

  if (!isAuthenticated) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <Bot className="h-12 w-12 text-primary mb-4" />
          <h1 className="text-xl font-bold mb-2">Sign in to create agents</h1>
          <p className="text-muted-foreground mb-6 max-w-sm">
            Log in to build custom AI agents with the SOUL/SKILL/HEARTBEAT architecture.
          </p>
          <Link href={ROUTES.LOGIN}><Button size="lg">Sign in</Button></Link>
        </div>
      </PageContainer>
    );
  }

  if (generatedAgent) {
    const soul = (generatedAgent.soul_config || {}) as Record<string, unknown>;
    const skills = (generatedAgent.skills_config || []) as Array<Record<string, string>>;
    const heartbeat = (generatedAgent.heartbeat_config || {}) as Record<string, unknown>;
    const channels = (generatedAgent.channels_config || {}) as Record<string, { enabled: boolean }>;

    return (
      <PageContainer>
        <div className="max-w-3xl mx-auto py-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
              <CheckCircle2 className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Agent Created!</h1>
              <p className="text-muted-foreground">
                {String(generatedAgent.name)} is ready to use.
              </p>
            </div>
          </div>

          {/* SOUL */}
          <div className="bg-card border border-border rounded-xl p-5 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="h-5 w-5 text-violet-500" />
              <h3 className="font-semibold">SOUL — Personality</h3>
            </div>
            <div className="space-y-2 text-sm text-muted-foreground">
              {soul.identity ? <p><span className="font-medium text-foreground">Identity:</span> {String(soul.identity)}</p> : null}
              {soul.purpose ? <p><span className="font-medium text-foreground">Purpose:</span> {String(soul.purpose)}</p> : null}
              {soul.communication_style ? <p><span className="font-medium text-foreground">Style:</span> {String(soul.communication_style)}</p> : null}
              {Array.isArray(soul.principles) && (
                <div>
                  <span className="font-medium text-foreground">Principles:</span>
                  <ul className="list-disc list-inside ml-2 mt-1">
                    {(soul.principles as string[]).map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* SKILLS */}
          {Array.isArray(skills) && skills.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="h-5 w-5 text-amber-500" />
                <h3 className="font-semibold">SKILLS — Capabilities ({skills.length})</h3>
              </div>
              <div className="space-y-3">
                {skills.map((skill, i) => (
                  <div key={i} className="bg-muted/30 rounded-lg p-3">
                    <p className="font-medium text-sm">{skill.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{skill.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* HEARTBEAT */}
          <div className="bg-card border border-border rounded-xl p-5 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-5 w-5 text-rose-500" />
              <h3 className="font-semibold">HEARTBEAT — Proactive Monitoring</h3>
            </div>
            <div className="text-sm text-muted-foreground">
              {heartbeat.enabled ? (
                <div className="space-y-1">
                  <p><span className="font-medium text-foreground">Interval:</span> Every {String(heartbeat.interval || '30m')}</p>
                  <p><span className="font-medium text-foreground">Active hours:</span> {String(heartbeat.active_hours || 'Always')}</p>
                  {Array.isArray(heartbeat.checks) && (
                    <div>
                      <span className="font-medium text-foreground">Checks:</span>
                      <ul className="list-disc list-inside ml-2 mt-1">
                        {(heartbeat.checks as string[]).map((c, i) => <li key={i}>{c}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <p>On-demand only (no automatic monitoring)</p>
              )}
            </div>
          </div>

          {/* CHANNELS */}
          <div className="bg-card border border-border rounded-xl p-5 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Radio className="h-5 w-5 text-blue-500" />
              <h3 className="font-semibold">CHANNELS — Communication</h3>
            </div>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(channels).map(([ch, cfg]) => (
                <span
                  key={ch}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium',
                    cfg?.enabled
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500'
                  )}
                >
                  {ch} {cfg?.enabled ? '✓' : '✗'}
                </span>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={() => router.push(ROUTES.CHAT)} className="flex-1">
              <Sparkles className="h-4 w-4 mr-2" />
              Start chatting with this agent
            </Button>
            <Button variant="outline" onClick={() => { setGeneratedAgent(null); setPrompt(''); }}>
              Create another
            </Button>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="max-w-3xl mx-auto py-8">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <Link href={ROUTES.MARKETPLACE} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="text-sm text-muted-foreground">Back to Marketplace</span>
        </div>

        <div className="flex items-center gap-4 mb-8">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Wand2 className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Agent Builder</h1>
            <p className="text-muted-foreground">
              Describe what you need and AI will generate a fully configured agent
            </p>
          </div>
        </div>

        {/* Architecture legend */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { icon: Brain, color: 'text-violet-500', bg: 'bg-violet-500/10', label: 'SOUL', desc: 'Personality & identity' },
            { icon: Zap, color: 'text-amber-500', bg: 'bg-amber-500/10', label: 'SKILL', desc: 'Capabilities & tools' },
            { icon: Clock, color: 'text-rose-500', bg: 'bg-rose-500/10', label: 'HEARTBEAT', desc: 'Proactive monitoring' },
            { icon: Radio, color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'CHANNEL', desc: 'Communication' },
          ].map(item => (
            <div key={item.label} className={cn('flex items-center gap-2.5 rounded-xl p-3 border border-border', item.bg)}>
              <item.icon className={cn('h-5 w-5 shrink-0', item.color)} />
              <div>
                <p className="text-xs font-semibold">{item.label}</p>
                <p className="text-[10px] text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Templates */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Quick templates</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {TEMPLATES.map(t => (
              <button
                key={t.label}
                type="button"
                onClick={() => handleUseTemplate(t)}
                className="text-left px-3 py-2.5 rounded-xl border border-border bg-card hover:bg-muted hover:border-primary/30 text-xs text-muted-foreground hover:text-foreground transition-all"
              >
                <span className="font-medium">{t.label}</span>
                <ChevronRight className="inline h-3 w-3 ml-1" />
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* Agent name (optional) */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Agent Name <span className="text-muted-foreground font-normal">(optional)</span></label>
            <input
              type="text"
              value={agentName}
              onChange={e => setAgentName(e.target.value)}
              placeholder="e.g. My Support Bot"
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
            />
          </div>

          {/* Category (optional) */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Category <span className="text-muted-foreground font-normal">(optional)</span></label>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
            >
              <option value="">Auto-detect from prompt</option>
              {AGENT_CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Prompt */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Describe your agent <span className="text-red-500">*</span>
            </label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Describe what your AI agent should do, its personality, skills, and whether it should monitor things proactively...&#10;&#10;Example: Create a DevOps monitoring agent that checks server health every 5 minutes, alerts about failures via web chat, and provides actionable suggestions. It should be concise, technical, and proactive."
              rows={6}
              className="w-full px-4 py-3 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 resize-none"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              {prompt.length}/2000 characters · Be specific about skills, personality, and monitoring needs
            </p>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200/60 dark:border-red-900/30 rounded-xl px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <Button
            onClick={handleGenerate}
            disabled={isGenerating || prompt.trim().length < 10}
            size="lg"
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating agent configuration...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Agent
              </>
            )}
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
