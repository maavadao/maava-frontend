'use client';

import Link from 'next/link';
import {
  useGatewayHealth,
  useGatewayStatus,
  useModels,
  useChannels,
  useSkills,
  useSessions,
  useCronJobs,
  useAuth,
} from '@/hooks';
import { PageContainer } from '@/components/layout';
import { AppSidebar, SidebarLayout } from '@/components/layout/sidebar';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
  Skeleton,
} from '@/components/ui';
import {
  Code2,
  Activity,
  Cpu,
  Radio,
  Zap,
  Clock,
  MessageSquare,
  Server,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GATEWAY_UI_URL, getUserChatUrl, MEMBER_SPACE_HOST } from '@/lib/constants';

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={cn(
        'inline-block h-2 w-2 rounded-full',
        ok ? 'bg-emerald-500' : 'bg-red-500'
      )}
    />
  );
}

export default function GatewayPage() {
  const { isAuthenticated, user, agent } = useAuth();
  const { data: health, isLoading: healthLoading, mutate: refreshHealth } = useGatewayHealth();
  const { data: status, isLoading: statusLoading } = useGatewayStatus();
  const { data: models, isLoading: modelsLoading } = useModels();
  const { data: channels, isLoading: channelsLoading } = useChannels();
  const { data: skills, isLoading: skillsLoading } = useSkills();
  const { data: sessions, isLoading: sessionsLoading } = useSessions();
  const { data: cronJobs, isLoading: cronLoading } = useCronJobs();

  const isGatewayReachable = !!health;
  const gatewayOk = health?.ok ?? false;

  const username = user?.username || (agent as any)?.name;
  const gatewayChatUrl = getUserChatUrl(username);
  const isExternalChat = gatewayChatUrl.startsWith('https://');

  return (
    <SidebarLayout sidebar={<AppSidebar />}>
      <PageContainer>
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Code2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">mawaDao Agent</h1>
                <p className="text-sm text-muted-foreground">
                  Gateway status, models, channels, and agent management
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refreshHealth()}
                className="gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </Button>
              <Link href={GATEWAY_UI_URL} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5" />
                  mawaDao Agent Docs
                </Button>
              </Link>
            </div>
          </div>

          {/* Your Chat Page */}
          {isAuthenticated && username && (
            <Card className="mb-8 overflow-hidden border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5">
              <div className="flex items-center justify-between p-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-primary/15 flex items-center justify-center">
                    <MessageSquare className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Your Chat Page</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Share this link so people can chat with your AI agent
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <code className="text-sm font-mono bg-background/80 border rounded-md px-3 py-1 text-primary">
                        {isExternalChat ? gatewayChatUrl.replace('https://', '') : `${MEMBER_SPACE_HOST}/${username}`}
                      </code>
                    </div>
                  </div>
                </div>
                <a
                  href={gatewayChatUrl}
                  target={isExternalChat ? '_blank' : undefined}
                  rel={isExternalChat ? 'noopener noreferrer' : undefined}
                >
                  <Button className="gap-2">
                    Open Chat
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </a>
              </div>
            </Card>
          )}

          {/* Overview Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">Gateway</span>
                <Server className="h-4 w-4 text-muted-foreground" />
              </div>
              {healthLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="flex items-center gap-2">
                  <StatusDot ok={gatewayOk} />
                  <span className="text-lg font-bold">
                    {gatewayOk ? 'Online' : isGatewayReachable ? 'Degraded' : 'Offline'}
                  </span>
                </div>
              )}
              {health?.version && (
                <p className="text-xs text-muted-foreground mt-1">v{health.version}</p>
              )}
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">Models</span>
                <Cpu className="h-4 w-4 text-muted-foreground" />
              </div>
              {modelsLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <span className="text-lg font-bold">{models?.length ?? 0}</span>
              )}
              <p className="text-xs text-muted-foreground mt-1">Available models</p>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">Channels</span>
                <Radio className="h-4 w-4 text-muted-foreground" />
              </div>
              {channelsLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">
                    {channels?.filter((c) => c.connected).length ?? 0}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    / {channels?.length ?? 0}
                  </span>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Connected</p>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">Sessions</span>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </div>
              {sessionsLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <span className="text-lg font-bold">{sessions?.length ?? 0}</span>
              )}
              <p className="text-xs text-muted-foreground mt-1">Active sessions</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Models */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Cpu className="h-4 w-4" />
                  Models
                </CardTitle>
                <CardDescription>Available AI models on the gateway</CardDescription>
              </CardHeader>
              <CardContent>
                {modelsLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full rounded-lg" />
                    ))}
                  </div>
                ) : models && models.length > 0 ? (
                  <div className="space-y-2">
                    {models.map((model) => (
                      <div
                        key={model.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                      >
                        <div>
                          <p className="text-sm font-medium">{model.name || model.id}</p>
                          {model.provider && (
                            <p className="text-xs text-muted-foreground">{model.provider}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {model.isDefault && (
                            <Badge variant="secondary" className="text-xs">
                              Default
                            </Badge>
                          )}
                          {model.contextLength && (
                            <span className="text-xs text-muted-foreground">
                              {(model.contextLength / 1000).toFixed(0)}k ctx
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {isGatewayReachable ? 'No models found' : 'Gateway not reachable'}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Channels */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Radio className="h-4 w-4" />
                  Channels
                </CardTitle>
                <CardDescription>Connected messaging channels</CardDescription>
              </CardHeader>
              <CardContent>
                {channelsLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full rounded-lg" />
                    ))}
                  </div>
                ) : channels && channels.length > 0 ? (
                  <div className="space-y-2">
                    {channels.map((channel) => (
                      <div
                        key={channel.name}
                        className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                      >
                        <div className="flex items-center gap-3">
                          <StatusDot ok={channel.connected} />
                          <div>
                            <p className="text-sm font-medium">{channel.name}</p>
                            <p className="text-xs text-muted-foreground">{channel.type}</p>
                          </div>
                        </div>
                        <Badge
                          variant={channel.connected ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {channel.connected ? 'Connected' : 'Disconnected'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {isGatewayReachable ? 'No channels configured' : 'Gateway not reachable'}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Skills */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Skills
                </CardTitle>
                <CardDescription>Installed agent skills and plugins</CardDescription>
              </CardHeader>
              <CardContent>
                {skillsLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full rounded-lg" />
                    ))}
                  </div>
                ) : skills?.installed && skills.installed.length > 0 ? (
                  <div className="space-y-2">
                    {skills.installed.map((skill) => (
                      <div
                        key={skill.name}
                        className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                      >
                        <div>
                          <p className="text-sm font-medium">{skill.name}</p>
                          {skill.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {skill.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {skill.version && (
                            <span className="text-xs text-muted-foreground">v{skill.version}</span>
                          )}
                          {skill.enabled !== false ? (
                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {isGatewayReachable ? 'No skills installed' : 'Gateway not reachable'}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Cron Jobs */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Scheduled Jobs
                </CardTitle>
                <CardDescription>Cron jobs and automated tasks</CardDescription>
              </CardHeader>
              <CardContent>
                {cronLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full rounded-lg" />
                    ))}
                  </div>
                ) : cronJobs && cronJobs.length > 0 ? (
                  <div className="space-y-2">
                    {cronJobs.map((job) => (
                      <div
                        key={job.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                      >
                        <div>
                          <p className="text-sm font-medium">{job.name || job.id}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {job.schedule}
                          </p>
                        </div>
                        <Badge
                          variant={job.enabled ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {job.enabled ? 'Active' : 'Disabled'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {isGatewayReachable ? 'No scheduled jobs' : 'Gateway not reachable'}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Not connected banner */}
          {!healthLoading && !isGatewayReachable && (
            <Card className="mt-6 p-6 border-amber-200 bg-amber-50/50">
              <div className="flex items-start gap-4">
                <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-amber-900">Gateway Not Reachable</h3>
                  <p className="text-sm text-amber-700 mt-1">
                    The mawaDao Agent gateway is not responding. Make sure the gateway is running and the
                    URL is configured correctly in Settings &gt; mawaDao Agent Chat.
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Link href="/settings">
                      <Button size="sm" variant="outline">
                        Configure Gateway
                      </Button>
                    </Link>
                    <Link href={GATEWAY_UI_URL} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="ghost" className="gap-1">
                        Documentation <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </PageContainer>
    </SidebarLayout>
  );
}
