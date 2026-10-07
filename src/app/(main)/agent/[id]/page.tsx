'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store';
import { Button, Avatar, AvatarFallback, Skeleton } from '@/components/ui';
import { AgentDetailNav } from '@/components/layout/sidebar';
import { ROUTES, AGENT_CATEGORIES } from '@/lib/constants';
import { getInitials, formatScore } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  Star, Download, BadgeCheck, ArrowLeft, ExternalLink,
  Zap, Shield, Globe, Clock, Tag, User, Calendar, Layers,
  MessageSquare, Headphones, PenTool, Code, BarChart3,
  UserPlus, Coins, Settings, Scale, Palette, TrendingUp, Package,
  Users, Bot, Check,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface SocialAgent {
  id: string;
  name: string;
  display_name: string | null;
  description: string | null;
  karma: number;
  follower_count: number;
  following_count: number;
  is_claimed: boolean;
  status: string;
  created_at: string;
  last_active: string | null;
}

interface MarketplaceAgent {
  id: string;
  slug: string;
  name: string;
  description: string;
  short_description: string;
  category: string;
  developer: string;
  price: number;
  price_label: string;
  rating: number;
  review_count: number;
  total_installs: number;
  version: string;
  verified: boolean;
  icon_url: string | null;
  tags: string[];
  integrations: string[];
  capabilities: string[];
  key_benefits: Array<{ title: string; description: string }>;
  about: string;
  created_at: string;
  updated_at: string;
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'customer-support': Headphones,
  sales: TrendingUp,
  writing: PenTool,
  coding: Code,
  data: BarChart3,
  hr: UserPlus,
  finance: Coins,
  operations: Settings,
  legal: Scale,
  creative: Palette,
};

const INTEGRATION_ICONS: Record<string, string> = {
  Discord: '🎮',
  Slack: '💬',
  Telegram: '✈️',
  Zendesk: '🎫',
  Intercom: '💭',
  Salesforce: '☁️',
  HubSpot: '🟠',
  Gmail: '📧',
  Calendly: '📅',
  'Google Docs': '📄',
  WordPress: '🌐',
  Medium: '✍️',
  GitHub: '🐙',
  GitLab: '🦊',
  Jira: '📋',
  'VS Code': '💻',
  Notion: '📝',
  'Google Sheets': '📊',
  Tableau: '📈',
  BigQuery: '🗄️',
  LinkedIn: '💼',
  Greenhouse: '🌱',
  QuickBooks: '📒',
  Stripe: '💳',
  Xero: '📘',
  Asana: '✅',
  Monday: '📌',
  Zapier: '⚡',
  Figma: '🎨',
  'Adobe CC': '🎬',
  Canva: '🖼️',
  Instagram: '📷',
  Twitter: '🐦',
  Buffer: '📤',
  'Google Analytics': '📉',
  Ahrefs: '🔍',
  DeepL: '🌍',
  'Google Meet': '📹',
  Zoom: '🎥',
  Snyk: '🛡️',
  SonarQube: '🔎',
  'AWS Security Hub': '🏰',
  'Google Scholar': '🎓',
  PubMed: '🔬',
  'MS Teams': '👥',
  Dialogflow: '🤖',
  Twilio: '📞',
};

export default function AgentDetailPage() {
  const params = useParams();
  const slug = params.id as string;
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [agent, setAgent] = useState<MarketplaceAgent | null>(null);
  const [socialAgent, setSocialAgent] = useState<SocialAgent | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'capabilities' | 'reviews'>('overview');
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setLoading(true);
    // Try marketplace agent first
    fetch(`/api/marketplace-agents/${slug}`)
      .then((res) => {
        if (res.ok) return res.json();
        // Not a marketplace agent — try social agent
        return fetch(`/api/agents/${slug}`)
          .then((r) => r.json())
          .then((d) => {
            if (d.agent) setSocialAgent(d.agent);
            return null;
          })
          .catch(() => null);
      })
      .then((data) => {
        if (data?.agent) {
          const a = data.agent;
          a.price = Number(a.price) || 0;
          a.rating = Number(a.rating) || 0;
          a.review_count = Number(a.review_count) || 0;
          a.total_installs = Number(a.total_installs) || 0;
          setAgent(a);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  // Check real install state from DB
  useEffect(() => {
    if (!user?.id || !agent?.id) return;
    fetch('/api/agents/installed', {
      headers: { 'x-user-id': user.id },
    })
      .then((r) => r.json())
      .then((data: { agents?: Array<{ id: string }> }) => {
        const isInstalled = (data.agents || []).some((a) => a.id === agent.id);
        setInstalled(isInstalled);
      })
      .catch(() => {});
  }, [user?.id, agent?.id]);

  const handleInstall = async () => {
    if (!user?.id) {
      router.push('/auth/login');
      return;
    }
    if (!agent) return;
    setInstalling(true);
    try {
      const method = installed ? 'DELETE' : 'POST';
      const res = await fetch('/api/agents/installed', {
        method,
        headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
        body: JSON.stringify({ agent_id: agent.id }),
      });
      if (res.ok) {
        setInstalled(!installed);
      }
    } catch (err) {
      console.error('[agent install] error:', err);
    } finally {
      setInstalling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <AgentDetailNav />
        <div className="max-w-6xl mx-auto px-6 py-10">
          <Skeleton className="h-8 w-48 mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-40 w-full rounded-2xl" />
              <Skeleton className="h-60 w-full rounded-2xl" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-64 w-full rounded-2xl" />
              <Skeleton className="h-40 w-full rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!agent && !socialAgent) {
    return (
      <div className="min-h-screen bg-background">
        <AgentDetailNav />
        <div className="max-w-6xl mx-auto px-6 py-20 text-center">
          <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-5">
            <Package className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Agent Not Found</h1>
          <p className="text-muted-foreground mb-6">The agent you&apos;re looking for doesn&apos;t exist or has been removed.</p>
          <Link href={ROUTES.MARKETPLACE}>
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Marketplace
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Social agent profile view
  if (socialAgent && !agent) {
    const sa = socialAgent;
    return (
      <div className="min-h-screen bg-background">
        <AgentDetailNav />
        <div className="border-b border-border/50 bg-muted/30">
          <div className="max-w-4xl mx-auto px-6 py-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/explore" className="hover:text-foreground transition-colors">Explore</Link>
            <span>/</span>
            <span className="text-foreground font-medium">{sa.display_name || sa.name}</span>
          </div>
        </div>
        <div className="max-w-4xl mx-auto px-6 py-10">
          <div className="bg-card rounded-2xl border border-border/60 p-8 mb-6">
            <div className="flex flex-col sm:flex-row items-start gap-6">
              <Avatar className="h-20 w-20 rounded-2xl shrink-0 ring-4 ring-muted shadow-lg">
                <AvatarFallback className="rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-2xl font-bold">
                  {getInitials(sa.display_name || sa.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-bold">{sa.display_name || sa.name}</h1>
                  {sa.is_claimed && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 text-blue-600 dark:text-blue-400 text-[11px] font-semibold">
                      <BadgeCheck className="h-3 w-3" />
                      Claimed
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-4">@{sa.name}</p>
                {sa.description && (
                  <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{sa.description}</p>
                )}
                <div className="flex flex-wrap items-center gap-5 text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                    <span className="font-semibold text-foreground">{formatScore(sa.karma)}</span>
                    karma
                  </span>
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span className="font-semibold text-foreground">{sa.follower_count.toLocaleString()}</span>
                    followers
                  </span>
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Bot className="h-4 w-4" />
                    <span className="font-semibold text-foreground">{sa.following_count.toLocaleString()}</span>
                    following
                  </span>
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    Joined {new Date(sa.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Link href="/explore">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Explore
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const CatIcon = CATEGORY_ICONS[agent!.category] || Package;
  const categoryLabel = AGENT_CATEGORIES.find((c) => c.value === agent!.category)?.label || agent!.category;

  return (
    <div className="min-h-screen bg-background">
      <AgentDetailNav />

      {/* Breadcrumb */}
      <div className="border-b border-border/50 bg-muted/30">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href={ROUTES.MARKETPLACE} className="hover:text-foreground transition-colors">Marketplace</Link>
          <span>/</span>
          <span className="text-foreground font-medium">{agent.name}</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Agent Header */}
        <div className="flex flex-col md:flex-row md:items-start gap-6 mb-10">
          <Avatar className="h-20 w-20 rounded-2xl shrink-0 ring-4 ring-muted shadow-lg">
            <AvatarFallback className="rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-2xl font-bold">
              {getInitials(agent.name)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1.5">
              <h1 className="text-3xl font-bold text-foreground">{agent.name}</h1>
              {agent.verified && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 text-blue-600 dark:text-blue-400 text-[11px] font-semibold">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  Verified
                </span>
              )}
            </div>
            <p className="text-[15px] text-muted-foreground mb-4 max-w-2xl leading-relaxed">
              {agent.short_description}
            </p>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-amber-500">
                <Star className="h-4 w-4 fill-current" />
                <span className="font-bold">{agent.rating.toFixed(1)}</span>
                <span className="text-muted-foreground">({agent.review_count.toLocaleString()} reviews)</span>
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Download className="h-4 w-4" />
                <span className="font-semibold text-foreground">{agent.total_installs.toLocaleString()}</span> installs
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Layers className="h-4 w-4" />
                v{agent.version}
              </span>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column — Main content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Tabs */}
            <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-xl w-fit">
              {(['overview', 'capabilities', 'reviews'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'px-5 py-2.5 rounded-lg text-[13px] font-semibold transition-all duration-200 capitalize',
                    activeTab === tab
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
              <div className="space-y-8">
                {/* About */}
                <section className="bg-card rounded-2xl border border-border/60 p-6">
                  <h2 className="text-lg font-bold text-foreground mb-4">About</h2>
                  <p className="text-[14px] text-muted-foreground leading-relaxed whitespace-pre-line">
                    {agent.about || agent.description}
                  </p>
                </section>

                {/* Key Benefits */}
                {agent.key_benefits && agent.key_benefits.length > 0 && (
                  <section>
                    <h2 className="text-lg font-bold text-foreground mb-4">Key Benefits</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {agent.key_benefits.map((benefit, i) => (
                        <div
                          key={i}
                          className="bg-card rounded-2xl border border-border/60 p-5 hover:border-primary/20 hover:shadow-sm transition-all"
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                              <Zap className="h-4 w-4 text-primary" />
                            </div>
                            <h3 className="font-semibold text-[14px] text-foreground">{benefit.title}</h3>
                          </div>
                          <p className="text-[13px] text-muted-foreground leading-relaxed pl-12">
                            {benefit.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Integrations */}
                {agent.integrations && agent.integrations.length > 0 && (
                  <section className="bg-card rounded-2xl border border-border/60 p-6">
                    <h2 className="text-lg font-bold text-foreground mb-4">Integrations</h2>
                    <div className="flex flex-wrap gap-3">
                      {agent.integrations.map((integration) => (
                        <div
                          key={integration}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted/60 border border-border/60 text-sm font-medium text-foreground hover:border-primary/30 hover:bg-primary/5 transition-all cursor-default"
                        >
                          <span className="text-lg">{INTEGRATION_ICONS[integration] || '🔗'}</span>
                          {integration}
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}

            {activeTab === 'capabilities' && (
              <div className="space-y-4">
                <section className="bg-card rounded-2xl border border-border/60 p-6">
                  <h2 className="text-lg font-bold text-foreground mb-4">Capabilities</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {agent.capabilities.map((cap, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 p-4 rounded-xl bg-muted/40 border border-border/40"
                      >
                        <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                          <Shield className="h-4 w-4 text-emerald-500" />
                        </div>
                        <span className="text-[14px] font-medium text-foreground">{cap}</span>
                      </div>
                    ))}
                  </div>
                </section>

                {agent.tags && agent.tags.length > 0 && (
                  <section className="bg-card rounded-2xl border border-border/60 p-6">
                    <h2 className="text-lg font-bold text-foreground mb-4">Tags</h2>
                    <div className="flex flex-wrap gap-2">
                      {agent.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-muted text-[12px] font-medium text-muted-foreground"
                        >
                          <Tag className="h-3 w-3" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}

            {activeTab === 'reviews' && (
              <section className="bg-card rounded-2xl border border-border/60 p-6">
                <h2 className="text-lg font-bold text-foreground mb-4">Reviews</h2>
                <div className="flex flex-col items-center py-12 text-center">
                  <div className="flex items-center gap-1 mb-4">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={cn(
                          'h-8 w-8',
                          s <= Math.round(agent.rating)
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-muted-foreground/20'
                        )}
                      />
                    ))}
                  </div>
                  <p className="text-4xl font-bold text-foreground mb-1">{agent.rating.toFixed(1)}</p>
                  <p className="text-sm text-muted-foreground mb-6">
                    Based on {agent.review_count.toLocaleString()} reviews
                  </p>
                  <div className="w-full max-w-xs space-y-2">
                    {[5, 4, 3, 2, 1].map((star) => {
                      // Simulate review distribution
                      const pct = star === 5 ? 68 : star === 4 ? 22 : star === 3 ? 6 : star === 2 ? 3 : 1;
                      return (
                        <div key={star} className="flex items-center gap-2 text-sm">
                          <span className="w-3 text-muted-foreground">{star}</span>
                          <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-400 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-8 text-right text-muted-foreground">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* Right Column — Sidebar */}
          <div className="space-y-6">
            {/* Pricing Card */}
            <div className="bg-card rounded-2xl border border-border/60 p-6 shadow-sm sticky top-24">
              <div className="text-center mb-6">
                <p className="text-3xl font-bold text-foreground mb-1">
                  {agent.price > 0 ? agent.price_label : 'Free'}
                </p>
                {agent.price > 0 && (
                  <p className="text-sm text-muted-foreground">per month, billed monthly</p>
                )}
              </div>
              <div className="space-y-3">
                <Button
                  className="w-full h-12 text-[14px] font-semibold rounded-xl"
                  onClick={handleInstall}
                  disabled={installing}
                  variant={installed ? 'outline' : 'default'}
                >
                  {installing ? (
                    <>
                      <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                      {installed ? 'Uninstalling...' : 'Installing...'}
                    </>
                  ) : installed ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Installed
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Install Agent
                    </>
                  )}
                </Button>
                <Button variant="outline" className="w-full h-12 text-[14px] font-semibold rounded-xl">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Demo
                </Button>
              </div>
            </div>

            {/* Information */}
            <div className="bg-card rounded-2xl border border-border/60 p-6">
              <h3 className="font-bold text-foreground mb-4">Information</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    Developer
                  </span>
                  <span className="text-sm font-medium text-foreground">{agent.developer}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Download className="h-4 w-4" />
                    Total Installs
                  </span>
                  <span className="text-sm font-medium text-foreground">{agent.total_installs.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    Last Updated
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {new Date(agent.updated_at || agent.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CatIcon className="h-4 w-4" />
                    Category
                  </span>
                  <span className="text-sm font-medium text-foreground">{categoryLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Layers className="h-4 w-4" />
                    Version
                  </span>
                  <span className="text-sm font-medium text-foreground">v{agent.version}</span>
                </div>
              </div>

              {/* Tags */}
              {agent.tags && agent.tags.length > 0 && (
                <div className="mt-5 pt-5 border-t border-border/60">
                  <p className="text-sm text-muted-foreground mb-3 flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Tags
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {agent.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 rounded-md bg-muted text-[11px] font-medium text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Similar Agents placeholder */}
            <div className="bg-card rounded-2xl border border-border/60 p-6">
              <h3 className="font-bold text-foreground mb-4">Similar Agents</h3>
              <p className="text-sm text-muted-foreground text-center py-4">
                More agents in the <strong>{categoryLabel}</strong> category coming soon.
              </p>
              <Link href={ROUTES.MARKETPLACE}>
                <Button variant="outline" className="w-full rounded-xl text-sm">
                  Browse Marketplace
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
