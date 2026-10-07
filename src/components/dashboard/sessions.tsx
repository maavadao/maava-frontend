'use client';

import * as React from 'react';
import {
  Card, CardHeader, CardTitle, CardContent, CardDescription,
  Button, Badge, Skeleton, Separator, Input,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui';
import { useSessions } from '@/hooks';
import { configApi } from '@/lib/config-api';
import {
  MessageSquare, Eye, RotateCcw, Trash2, AlertCircle,
  Clock, Hash, ChevronDown, ChevronRight, Loader2,
  Search, Filter, Archive, Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GatewaySession } from '@/types';

function formatDate(dateStr?: string) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString();
  } catch { return dateStr; }
}

function formatDateFull(dateStr?: string) {
  if (!dateStr) return '—';
  try { return new Date(dateStr).toLocaleString(); } catch { return dateStr; }
}

// ---------------------------------------------------------------------------
// Confirmation dialog
// ---------------------------------------------------------------------------

function ConfirmDialog({ open, onOpenChange, title, description, action, variant, onConfirm, loading }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  title: string; description: string; action: string;
  variant?: 'destructive' | 'default'; onConfirm: () => void; loading: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button variant={variant === 'destructive' ? 'destructive' : 'default'} onClick={onConfirm} isLoading={loading}>{action}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Session row
// ---------------------------------------------------------------------------

function SessionRow({ session, onRefresh }: { session: GatewaySession; onRefresh: () => void }) {
  const [expanded, setExpanded] = React.useState(false);
  const [preview, setPreview] = React.useState<unknown[] | null>(null);
  const [loadingPreview, setLoadingPreview] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);
  const [confirmAction, setConfirmAction] = React.useState<'reset' | 'delete' | 'compact' | null>(null);

  const loadPreview = async () => {
    if (expanded) { setExpanded(false); return; }
    setLoadingPreview(true);
    try {
      const result = await configApi.sessionsPreview(session.id);
      setPreview(result.messages || []);
      setExpanded(true);
    } catch { setPreview([]); setExpanded(true); }
    finally { setLoadingPreview(false); }
  };

  const handleAction = async (action: 'reset' | 'delete' | 'compact') => {
    setActionLoading(action);
    try {
      if (action === 'reset') await configApi.sessionsReset(session.id);
      else if (action === 'delete') await configApi.sessionsDelete(session.id);
      else if (action === 'compact') await configApi.sessionsCompact(session.id);
      onRefresh();
    } catch (err) { console.error(`Session ${action} failed:`, err); }
    finally { setActionLoading(null); setConfirmAction(null); }
  };

  const confirmDialogProps = {
    reset: { title: 'Reset Session?', description: 'This will clear all messages in this session. The session will start fresh, but the session ID is preserved.', action: 'Reset Session', variant: 'default' as const },
    delete: { title: 'Delete Session?', description: 'This will permanently delete this session and all its messages. This action cannot be undone.', action: 'Delete Session', variant: 'destructive' as const },
    compact: { title: 'Compact Session?', description: 'This will summarize older messages to reduce token usage while preserving context. Recent messages are kept intact.', action: 'Compact', variant: 'default' as const },
  };

  return (
    <>
      <div className="border rounded-lg overflow-hidden hover:border-primary/30 transition-colors">
        {/* Session header */}
        <div className="flex items-center gap-3 px-4 py-3">
          <button type="button" onClick={loadPreview} className="shrink-0" disabled={loadingPreview}>
            {loadingPreview ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              : expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </button>

          <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10 shrink-0">
            <MessageSquare className="h-4 w-4 text-primary" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">{session.label || session.id}</span>
              {session.channel && <Badge variant="secondary" className="text-xs shrink-0">{session.channel}</Badge>}
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
              {session.messageCount != null && (
                <span className="flex items-center gap-1"><Hash className="h-3 w-3" /> {session.messageCount} messages</span>
              )}
              {(session.updatedAt || session.createdAt) && (
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDate(session.updatedAt || session.createdAt)}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Preview messages" onClick={loadPreview} disabled={loadingPreview}>
              <Eye className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Compact session" onClick={() => setConfirmAction('compact')} disabled={!!actionLoading}>
              {actionLoading === 'compact' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Reset session" onClick={() => setConfirmAction('reset')} disabled={!!actionLoading}>
              {actionLoading === 'reset' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Delete session"
              onClick={() => setConfirmAction('delete')} disabled={!!actionLoading}>
              {actionLoading === 'delete' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Expanded preview */}
        {expanded && (
          <div className="border-t bg-muted/10 px-4 py-3">
            {preview && preview.length > 0 ? (
              <div className="space-y-2.5 max-h-[350px] overflow-y-auto">
                {(preview as Array<Record<string, unknown>>).map((msg, i) => {
                  const role = String(msg.role || msg.from || 'unknown');
                  const content = String(msg.content || msg.text || JSON.stringify(msg));
                  const isUser = role === 'user' || role === 'human';
                  return (
                    <div key={i} className={cn('flex gap-2 text-sm', isUser ? 'flex-row-reverse' : '')}>
                      <div className={cn(
                        'max-w-[80%] rounded-lg px-3 py-2',
                        isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      )}>
                        <p className="text-xs font-medium mb-0.5 opacity-70">{role}</p>
                        <p className="text-sm whitespace-pre-wrap break-words">{content.slice(0, 500)}{content.length > 500 && '...'}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No messages in this session.</p>
            )}
          </div>
        )}
      </div>

      {/* Confirmation dialog */}
      {confirmAction && (
        <ConfirmDialog
          open={!!confirmAction}
          onOpenChange={(v) => !v && setConfirmAction(null)}
          {...confirmDialogProps[confirmAction]}
          onConfirm={() => handleAction(confirmAction)}
          loading={!!actionLoading}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main Sessions Panel
// ---------------------------------------------------------------------------

export function SessionsPanel() {
  const { data: sessions, isLoading, error, mutate } = useSessions();
  const [search, setSearch] = React.useState('');
  const [filter, setFilter] = React.useState<'all' | string>('all');

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Sessions Unavailable
          </CardTitle>
          <CardDescription>Could not load sessions. Ensure the mawaDao Agent gateway is running.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const sessionList = Array.isArray(sessions) ? sessions : [];

  // Unique channels for filter
  const channels = Array.from(new Set(sessionList.map((s) => s.channel).filter(Boolean))) as string[];

  // Filter + search
  const filtered = sessionList.filter((s) => {
    if (filter !== 'all' && s.channel !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (s.label?.toLowerCase().includes(q) || s.id.toLowerCase().includes(q) || s.channel?.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="h-5 w-5" /> Chat Sessions
          </h2>
          <p className="text-sm text-muted-foreground">
            {sessionList.length} session{sessionList.length !== 1 ? 's' : ''} total
            {filtered.length !== sessionList.length && ` · ${filtered.length} shown`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => mutate()}>
          <RotateCcw className="h-4 w-4 mr-1.5" /> Refresh
        </Button>
      </div>

      {/* Search & filter bar */}
      {sessionList.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sessions by name, ID, or channel..."
              className="pl-9" />
          </div>
          {channels.length > 1 && (
            <select value={filter} onChange={(e) => setFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background text-foreground px-3 text-sm shadow-sm min-w-[140px]">
              <option value="all">All Channels</option>
              {channels.map((ch) => <option key={ch} value={ch}>{ch}</option>)}
            </select>
          )}
        </div>
      )}

      {/* Session list */}
      {sessionList.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <div className="flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 mx-auto mb-4">
              <MessageSquare className="h-8 w-8 text-primary/60" />
            </div>
            <h3 className="font-semibold text-lg mb-1">No sessions yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Sessions will appear here once your agent starts receiving messages through any connected channel.
            </p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Search className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No sessions match your search.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((session) => (
            <SessionRow key={session.id} session={session} onRefresh={() => mutate()} />
          ))}
        </div>
      )}
    </div>
  );
}
