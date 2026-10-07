'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, Badge, Skeleton, Button } from '@/components/ui';
import { useGatewayHealth, useGatewayStatus, useChannels, useSessions, useSkills, useModels, useConfig } from '@/hooks';
import {
  Activity, Wifi, WifiOff, MessageSquare, Cpu, Zap, Radio, AlertCircle,
  Settings, Bot, ArrowRight, CheckCircle2, XCircle,
  Sparkles, BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { configApi } from '@/lib/config-api';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Stat card (enhanced)
// ---------------------------------------------------------------------------

function StatCard({ title, value, description, icon: Icon, status, isLoading, href }: {
  title: string; value: string | number; description?: string;
  icon: React.ElementType; status?: 'ok' | 'warning' | 'error'; isLoading?: boolean; href?: string;
}) {
  const statusColors = { ok: 'text-green-500', warning: 'text-yellow-500', error: 'text-red-500' };
  const statusBg = { ok: 'bg-green-500/10', warning: 'bg-yellow-500/10', error: 'bg-red-500/10' };

  const content = (
    <Card className={cn('transition-colors', href && 'hover:border-primary/30 cursor-pointer')}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg', status ? statusBg[status] : 'bg-muted')}>
          <Icon className={cn('h-4 w-4', status ? statusColors[status] : 'text-muted-foreground')} />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-7 w-20" /> : <div className="text-2xl font-bold">{value}</div>}
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  );

  if (href) return <Link href={href}>{content}</Link>;
  return content;
}

// ---------------------------------------------------------------------------
// Quick action card
// ---------------------------------------------------------------------------

function QuickAction({ title, desc, icon: Icon, href }: {
  title: string; desc: string; icon: React.ElementType; href: string;
}) {
  return (
    <Link href={href}>
      <Card className="hover:border-primary/30 transition-colors cursor-pointer h-full">
        <CardContent className="pt-5 pb-4 flex items-start gap-3">
          <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10 shrink-0">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
        </CardContent>
      </Card>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Setup checklist
// ---------------------------------------------------------------------------

function SetupChecklist({ items }: { items: { label: string; done: boolean; href?: string }[] }) {
  const completed = items.filter((i) => i.done).length;
  const total = items.length;
  const allDone = completed === total;

  if (allDone) return null;

  return (
    <Card className="border-primary/20 bg-primary/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              Getting Started
            </CardTitle>
            <CardDescription className="mt-0.5">Complete these steps to get your agent up and running</CardDescription>
          </div>
          <Badge variant="secondary" className="text-xs">{completed}/{total}</Badge>
        </div>
        {/* Progress bar */}
        <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${(completed / total) * 100}%` }} />
        </div>
      </CardHeader>
      <CardContent className="space-y-1 pt-0">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2.5 py-1.5">
            {item.done ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" /> : <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />}
            {item.href && !item.done ? (
              <Link href={item.href} className="text-sm hover:text-primary transition-colors">{item.label}</Link>
            ) : (
              <span className={cn('text-sm', item.done && 'text-muted-foreground line-through')}>{item.label}</span>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Channel list (enhanced)
// ---------------------------------------------------------------------------

function ChannelList() {
  const { data: channels, isLoading, error } = useChannels();

  if (isLoading) return <Card><CardContent className="space-y-3 py-6">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</CardContent></Card>;

  const channelList = Array.isArray(channels) ? channels : [];
  if (error && !channels) return <Card><CardContent className="py-6"><div className="flex items-center gap-2 text-sm text-muted-foreground"><AlertCircle className="h-4 w-4" /> Unable to load channels</div></CardContent></Card>;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Radio className="h-4 w-4" /> Channels</CardTitle>
        <CardDescription>{channelList.length} channel{channelList.length !== 1 ? 's' : ''} configured</CardDescription>
      </CardHeader>
      <CardContent>
        {channelList.length === 0 ? (
          <div className="text-center py-6">
            <Radio className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No channels configured yet.</p>
            <Link href="/dashboard/config">
              <Button variant="outline" size="sm" className="mt-3"><Settings className="h-3.5 w-3.5 mr-1.5" /> Configure Channels</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {channelList.map((ch) => (
              <div key={ch.name} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg', ch.connected ? 'bg-green-500/10' : 'bg-muted')}>
                    {ch.connected ? <Wifi className="h-3.5 w-3.5 text-green-500" /> : <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />}
                  </div>
                  <div>
                    <span className="text-sm font-medium">{ch.name}</span>
                    <Badge variant="secondary" className="text-xs ml-2">{ch.type}</Badge>
                  </div>
                </div>
                <Badge variant={ch.connected ? 'default' : 'outline'} className={cn('text-xs', ch.connected && 'bg-green-500/10 text-green-500 border-green-500/20')}>
                  {ch.connected ? 'Connected' : 'Disconnected'}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Skills list (enhanced)
// ---------------------------------------------------------------------------

function SkillsList() {
  const { data: skills, isLoading, error } = useSkills();

  if (isLoading) return <Card><CardContent className="space-y-2 py-6">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</CardContent></Card>;
  if (error || !skills) return <Card><CardContent className="py-6"><div className="flex items-center gap-2 text-sm text-muted-foreground"><AlertCircle className="h-4 w-4" /> Unable to load skills</div></CardContent></Card>;

  const installed = skills.installed || [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4" /> Skills</CardTitle>
        <CardDescription>{installed.length} skill{installed.length !== 1 ? 's' : ''} installed</CardDescription>
      </CardHeader>
      <CardContent>
        {installed.length === 0 ? (
          <div className="text-center py-6">
            <Zap className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No skills installed.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {installed.map((skill) => (
              <div key={skill.name} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center justify-center h-7 w-7 rounded-md bg-primary/10">
                    <Zap className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="text-sm font-medium">{skill.name}</span>
                  {skill.version && <span className="text-xs text-muted-foreground">v{skill.version}</span>}
                </div>
                <Badge variant={skill.enabled !== false ? 'default' : 'outline'} className={cn('text-xs', skill.enabled !== false && 'bg-green-500/10 text-green-500 border-green-500/20')}>
                  {skill.enabled !== false ? 'Active' : 'Disabled'}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main overview
// ---------------------------------------------------------------------------

export function DashboardOverview() {
  const gatewayUnavailable = configApi.isUnavailable();
  const { data: health, isLoading: healthLoading } = useGatewayHealth();
  const { data: config } = useConfig();
  const { data: sessions, isLoading: sessionsLoading } = useSessions();
  const { data: models, isLoading: modelsLoading } = useModels();
  const { data: channels } = useChannels();

  const channelList = Array.isArray(channels) ? channels : [];
  const gatewayOk = health?.ok ?? false;
  const connectedChannels = channelList.filter((c) => c.connected).length;
  const totalChannels = channelList.length;
  const sessionCount = Array.isArray(sessions) ? sessions.length : 0;
  const modelCount = Array.isArray(models) ? models.length : 0;

  // Setup checklist
  const hasModel = !!config?.parsed && !!(config.parsed as Record<string, unknown>).agents;
  const setupItems = [
    { label: 'Gateway is running', done: gatewayOk },
    { label: 'Connect a channel (Discord, WhatsApp, etc.)', done: totalChannels > 0, href: '/dashboard/config' },
    { label: 'Set up your AI model', done: hasModel || modelCount > 0, href: '/dashboard/agent' },
    { label: 'Write a system prompt', done: !!config?.parsed && !!(config.parsed as Record<string, unknown>).systemPrompt, href: '/dashboard/agent' },
  ];

  return (
    <div className="space-y-6">
      {/* Gateway not configured banner */}
      {gatewayUnavailable && (
        <Card className="border-yellow-500/40 bg-yellow-500/5">
          <CardContent className="py-4 flex items-start gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-yellow-500/10 shrink-0 mt-0.5">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">OpenClaw Gateway Not Configured</p>
              <p className="text-xs text-muted-foreground mt-1">
                The dashboard cannot connect to your OpenClaw gateway because no URL has been set.
                Go to <strong>Settings → OpenClaw Gateway</strong> and enter the URL of your running gateway instance.
              </p>
              <Link href="/settings">
                <Button variant="outline" size="sm" className="mt-3">
                  <Settings className="h-3.5 w-3.5 mr-1.5" /> Open Settings
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
      {/* Setup checklist (hidden once all done) */}
      <SetupChecklist items={setupItems} />

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Gateway" value={gatewayOk ? 'Online' : 'Offline'}
          description={health?.version ? `v${health.version}` : undefined}
          icon={Activity} status={gatewayOk ? 'ok' : 'error'} isLoading={healthLoading} />
        <StatCard title="Channels" value={`${connectedChannels}/${totalChannels}`}
          description="Connected channels" icon={Radio}
          status={connectedChannels > 0 ? 'ok' : totalChannels > 0 ? 'warning' : undefined}
          isLoading={healthLoading} href="/dashboard/config" />
        <StatCard title="Sessions" value={sessionCount}
          description="Active chat sessions" icon={MessageSquare}
          isLoading={sessionsLoading} href="/dashboard/sessions" />
        <StatCard title="Models" value={modelCount}
          description="Available LLM models" icon={Cpu}
          isLoading={modelsLoading} href="/dashboard/agent" />
      </div>

      {/* Quick actions */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <QuickAction title="Configure Settings" desc="Adjust gateway, tools, and session behavior" icon={Settings} href="/dashboard/config" />
          <QuickAction title="Agent Setup" desc="Model, system prompt, and identity" icon={Bot} href="/dashboard/agent" />
          <QuickAction title="View Sessions" desc="Browse and manage chat sessions" icon={MessageSquare} href="/dashboard/sessions" />
        </div>
      </div>

      {/* Detail panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChannelList />
        <SkillsList />
      </div>
    </div>
  );
}
