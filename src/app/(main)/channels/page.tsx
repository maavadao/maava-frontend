'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Card, Button, Skeleton } from '@/components/ui';
import { CHANNEL_TYPES, ROUTES } from '@/lib/constants';
import { useChannels, useSavedChannels } from '@/hooks';
import {
  Radio, Plus, Settings2, ExternalLink, CheckCircle2,
  Activity, MessageSquare, ArrowUpRight, Key, Zap, Globe,
  Trash2, Loader2, RefreshCw, AlertCircle
} from 'lucide-react';
import { SiDiscord, SiSlack, SiTelegram, SiWhatsapp } from 'react-icons/si';
import { FaMicrosoft } from 'react-icons/fa6';
import { cn } from '@/lib/utils';
import { SettingsSidebar, SidebarLayout } from '@/components/layout/sidebar';
import { api } from '@/lib/api';
import { configApi } from '@/lib/config-api';

// Channel icon component using brand logos
function ChannelIcon({ type, size = 'md' }: { type: (typeof CHANNEL_TYPES)[number]; size?: 'sm' | 'md' }) {
  const sizeClasses = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';
  const iconSizeClasses = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';

  const iconMap: Record<string, JSX.Element> = {
    discord: <SiDiscord className={cn('text-white', iconSizeClasses)} />,
    slack: <SiSlack className={cn('text-white', iconSizeClasses)} />,
    telegram: <SiTelegram className={cn('text-white', iconSizeClasses)} />,
    whatsapp: <SiWhatsapp className={cn('text-white', iconSizeClasses)} />,
    teams: <FaMicrosoft className={cn('text-white', iconSizeClasses)} />,
    web: <Globe className={cn('text-white', iconSizeClasses)} />,
  };

  return (
    <div
      className={cn('rounded-xl flex items-center justify-center text-white font-bold shrink-0', sizeClasses)}
      style={{ backgroundColor: type.color }}
    >
      {iconMap[type.id] || type.label.charAt(0)}
    </div>
  );
}

export default function ChannelsPage() {
  const { data: gatewayChannels, isLoading: gatewayLoading } = useChannels();
  const { data: savedChannels, isLoading: savedLoading, mutate: refreshSaved } = useSavedChannels();
  const { mutate: refreshGateway } = useChannels();
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);

  const isLoading = gatewayLoading || savedLoading;

  // Build a map: channelType → saved DB record
  const savedMap = useMemo(() => {
    const map = new Map<string, (typeof savedChannels extends (infer U)[] | undefined ? U : never)>();
    (savedChannels ?? []).forEach((c) => { if (c) map.set(c.channelType, c); });
    return map;
  }, [savedChannels]);

  // Build a map: channelType → gateway connected status
  const gatewayMap = useMemo(() => {
    const map = new Map<string, boolean>();
    (gatewayChannels ?? []).forEach((gc) => {
      const key = gc.type?.toLowerCase() || gc.name?.toLowerCase() || '';
      if (key) map.set(key, !!gc.connected);
    });
    return map;
  }, [gatewayChannels]);

  // Merge channel types with DB + gateway status
  const channels = useMemo(() => CHANNEL_TYPES.map((type) => {
    const saved = savedMap.get(type.id);
    const gatewayConnected = gatewayMap.get(type.id);
    return {
      type,
      savedRecord: saved,
      isConnected: saved?.isActive === true || !!gatewayConnected,
      isGatewayLive: !!gatewayConnected,
      isDbSaved: !!saved?.isActive,
      connectedAt: saved?.connectedAt ?? null,
      lastError: saved?.lastError ?? null,
    };
  }), [savedMap, gatewayMap]);

  const connectedChannels = channels.filter((c) => c.isConnected);
  const connectedCount = connectedChannels.length;

  const handleDisconnect = useCallback(async (channelTypeId: string) => {
    setDisconnecting(channelTypeId);
    setDisconnectError(null);
    try {
      // Disable on gateway
      try {
        const currentConfig = await configApi.configGet();
        const baseHash = currentConfig.hash;
        await configApi.configPatch(
          { channels: { [channelTypeId]: { enabled: false } } },
          baseHash || undefined
        );
      } catch {
        // Gateway may be unreachable — still remove from DB
      }
      // Delete from DB
      await api.deleteChannel(channelTypeId);
      refreshSaved();
      refreshGateway();
    } catch (err) {
      setDisconnectError(`Failed to disconnect ${channelTypeId}: ${(err as Error).message}`);
    } finally {
      setDisconnecting(null);
    }
  }, [refreshSaved, refreshGateway]);

  return (
    <SidebarLayout sidebar={<SettingsSidebar />}>
      <div className="p-6 md:p-8 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Connected Channels</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Manage your connected messaging platforms and integrations
            </p>
          </div>
        </div>

        {/* Error banner */}
        {disconnectError && (
          <div className="mb-6 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 flex items-start gap-2 text-sm text-red-700 dark:text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            {disconnectError}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="p-5 border border-border shadow-sm bg-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Active Channels</span>
              <Radio className="h-4 w-4 text-primary" />
            </div>
            {isLoading ? (
              <Skeleton className="h-9 w-16" />
            ) : (
              <>
                <p className="text-3xl font-bold text-foreground">{connectedCount}</p>
                <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                  <ArrowUpRight className="h-3 w-3" />
                  {connectedCount === 0 ? 'No channels connected yet' : 'Channels operational'}
                </p>
              </>
            )}
          </Card>

          <Card className="p-5 border border-border shadow-sm bg-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Saved to DB</span>
              <CheckCircle2 className="h-4 w-4 text-blue-500" />
            </div>
            {savedLoading ? (
              <Skeleton className="h-9 w-16" />
            ) : (
              <>
                <p className="text-3xl font-bold text-foreground">{savedChannels?.length ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Persisted across restarts</p>
              </>
            )}
          </Card>

          <Card className="p-5 border border-border shadow-sm bg-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Gateway Live</span>
              <Activity className="h-4 w-4 text-emerald-500" />
            </div>
            {gatewayLoading ? (
              <Skeleton className="h-9 w-16" />
            ) : (
              <>
                <p className="text-3xl font-bold text-foreground">
                  {channels.filter((c) => c.isGatewayLive).length}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Currently active on gateway</p>
              </>
            )}
          </Card>
        </div>

        {/* Integration Cards Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {channels.map((channel) => (
            <Card
              key={channel.type.id}
              className={cn(
                'p-5 border shadow-sm hover:shadow-md transition-all duration-200 bg-card',
                channel.isConnected && 'ring-1 ring-emerald-500/20'
              )}
            >
              <div className="flex items-start gap-3 mb-4">
                <ChannelIcon type={channel.type} />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground text-sm">{channel.type.label}</h3>
                  {channel.isConnected ? (
                    <div className="space-y-0.5 mt-0.5">
                      <span className="flex items-center gap-1.5 text-xs text-emerald-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {channel.isGatewayLive ? 'Connected — live' : 'Saved — reconnect on next restart'}
                      </span>
                      {channel.connectedAt && (
                        <span className="text-[11px] text-muted-foreground block">
                          Since {new Date(channel.connectedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  ) : channel.lastError ? (
                    <span className="text-xs text-red-500 mt-0.5 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Error
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground mt-0.5">Not connected</span>
                  )}
                </div>
              </div>

              {channel.isConnected ? (
                <div className="space-y-3">
                  {channel.lastError && (
                    <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 rounded-lg p-2">
                      {channel.lastError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Link href={`/integrations/${channel.type.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5 w-full">
                        <Settings2 className="h-3 w-3" />
                        Manage
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-8 gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                      onClick={() => handleDisconnect(channel.type.id)}
                      disabled={disconnecting === channel.type.id}
                    >
                      {disconnecting === channel.type.id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Trash2 className="h-3 w-3" />}
                      Disconnect
                    </Button>
                  </div>
                </div>
              ) : (
                <Link href={`/integrations/${channel.type.id}`}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 gap-1.5 w-full justify-center"
                  >
                    <Zap className="h-3 w-3" />
                    Connect
                  </Button>
                </Link>
              )}
            </Card>
          ))}
        </div>

        {/* Connected channels detail list */}
        {connectedChannels.length > 0 && (
          <div className="mt-8">
            <h2 className="text-base font-semibold text-foreground mb-4">Connected Channel Details</h2>
            <div className="space-y-3">
              {connectedChannels.map((channel) => (
                <Card key={channel.type.id} className="p-4 border border-border shadow-sm bg-card">
                  <div className="flex items-center gap-3">
                    <ChannelIcon type={channel.type} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-foreground">{channel.type.label}</span>
                        {channel.isGatewayLive && (
                          <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Live
                          </span>
                        )}
                        {channel.isDbSaved && (
                          <span className="inline-flex items-center gap-1 text-[11px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">
                            Saved
                          </span>
                        )}
                      </div>
                      {channel.savedRecord && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Keys: {channel.savedRecord.credentialKeys.join(', ')}
                        </p>
                      )}
                    </div>
                    <Link href={`/integrations/${channel.type.id}`}>
                      <Button variant="ghost" size="sm" className="h-8 text-xs gap-1">
                        <Settings2 className="h-3 w-3" />
                        Edit
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* API Keys Banner */}
        <Card className="mt-8 p-5 border border-border shadow-sm bg-muted/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                <Key className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm">Looking for API Keys?</h3>
                <p className="text-xs text-muted-foreground">
                  Manage your API keys for programmatic access to maavaDao integrations
                </p>
              </div>
            </div>
            <Link href="/settings?tab=account">
              <Button variant="outline" size="sm" className="text-xs gap-1.5">
                Manage API Keys
                <ArrowUpRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </SidebarLayout>
  );
}
