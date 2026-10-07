'use client';

import { useState, useCallback } from 'react';
import { Check, X, Loader2, RefreshCw, Users, Clock, CheckCircle, XCircle } from 'lucide-react';

type WaitlistStatus = 'pending' | 'approved' | 'rejected';

interface WaitlistEntry {
  id: string;
  username: string;
  email: string;
  display_name: string;
  status: WaitlistStatus;
  notes: string | null;
  created_at: string;
  reviewed_at: string | null;
}

const STATUS_FILTER_OPTIONS: { label: string; value: '' | WaitlistStatus }[] = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function AdminWaitlistPage() {
  const [secret, setSecret] = useState('');
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState('');

  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [statusFilter, setStatusFilter] = useState<'' | WaitlistStatus>('pending');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [actionError, setActionError] = useState<Record<string, string>>({});
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});

  const fetchEntries = useCallback(
    async (currentSecret: string, filter: '' | WaitlistStatus) => {
      setLoading(true);
      setError('');
      try {
        const url = filter
          ? `/api/users/admin/waitlist?status=${filter}`
          : '/api/users/admin/waitlist';
        const res = await fetch(url, {
          headers: { 'x-admin-secret': currentSecret },
        });
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 403) {
            setAuthed(false);
            setAuthError('Invalid admin secret.');
            return;
          }
          throw new Error(data.error || 'Failed to load waitlist');
        }
        setEntries(data.data?.entries ?? data.entries ?? []);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!secret.trim()) {
      setAuthError('Please enter the admin secret.');
      return;
    }
    // Verify by doing a real fetch
    setLoading(true);
    try {
      const res = await fetch('/api/users/admin/waitlist?status=pending', {
        headers: { 'x-admin-secret': secret },
      });
      if (res.status === 403) {
        setAuthError('Invalid admin secret.');
        setLoading(false);
        return;
      }
      const data = await res.json();
      setEntries(data.data?.entries ?? data.entries ?? []);
      setAuthed(true);
    } catch (err) {
      setAuthError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (filter: '' | WaitlistStatus) => {
    setStatusFilter(filter);
    fetchEntries(secret, filter);
  };

  const handleApprove = async (id: string) => {
    setActionLoading((s) => ({ ...s, [id]: true }));
    setActionError((s) => ({ ...s, [id]: '' }));
    try {
      const res = await fetch(`/api/users/admin/waitlist/${id}/approve`, {
        method: 'POST',
        headers: { 'x-admin-secret': secret },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Approval failed');
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, status: 'approved', reviewed_at: new Date().toISOString() } : e))
      );
    } catch (err) {
      setActionError((s) => ({ ...s, [id]: (err as Error).message }));
    } finally {
      setActionLoading((s) => ({ ...s, [id]: false }));
    }
  };

  const handleReject = async (id: string) => {
    setActionLoading((s) => ({ ...s, [id]: true }));
    setActionError((s) => ({ ...s, [id]: '' }));
    try {
      const res = await fetch(`/api/users/admin/waitlist/${id}/reject`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify({ notes: rejectNotes[id] || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Rejection failed');
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, status: 'rejected', reviewed_at: new Date().toISOString() } : e))
      );
    } catch (err) {
      setActionError((s) => ({ ...s, [id]: (err as Error).message }));
    } finally {
      setActionLoading((s) => ({ ...s, [id]: false }));
    }
  };

  // ── Auth gate ───────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-full max-w-sm space-y-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Admin — Waitlist</h1>
            <p className="text-sm text-muted-foreground mt-1">Enter your admin secret to continue</p>
          </div>
          <form onSubmit={handleAuth} className="space-y-3">
            {authError && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                <X className="h-4 w-4 shrink-0" />
                {authError}
              </div>
            )}
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Admin secret"
              className="w-full h-11 px-4 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              autoComplete="current-password"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Verifying…</> : 'Continue'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const pending   = entries.filter((e) => e.status === 'pending').length;
  const approved  = entries.filter((e) => e.status === 'approved').length;
  const rejected  = entries.filter((e) => e.status === 'rejected').length;

  // ── Dashboard ───────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" /> Waitlist Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Approve or reject alpha access requests</p>
        </div>
        <button
          onClick={() => fetchEntries(secret, statusFilter)}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-background hover:bg-muted text-sm font-medium transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pending',  count: pending,  icon: Clock,        color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
          { label: 'Approved', count: approved, icon: CheckCircle,  color: 'text-green-600 dark:text-green-400',  bg: 'bg-green-50  dark:bg-green-900/20'  },
          { label: 'Rejected', count: rejected, icon: XCircle,      color: 'text-red-600   dark:text-red-400',    bg: 'bg-red-50    dark:bg-red-900/20'    },
        ].map(({ label, count, icon: Icon, color, bg }) => (
          <div key={label} className={`rounded-xl p-4 border ${bg}`}>
            <Icon className={`h-5 w-5 ${color} mb-1`} />
            <p className="text-2xl font-bold">{count}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex rounded-lg border bg-muted/30 p-1 w-fit gap-1">
        {STATUS_FILTER_OPTIONS.map(({ label, value }) => (
          <button
            key={label}
            onClick={() => handleFilterChange(value)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              statusFilter === value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          <X className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      {/* Entries */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          No entries{statusFilter ? ` with status "${statusFilter}"` : ''}.
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div key={entry.id} className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold">{entry.display_name || entry.username}</p>
                  <p className="text-sm text-muted-foreground">{entry.email}</p>
                  <p className="text-xs text-muted-foreground">@{entry.username} · {formatDate(entry.created_at)}</p>
                </div>
                <span className={`
                  text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap
                  ${entry.status === 'pending'  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' : ''}
                  ${entry.status === 'approved' ? 'bg-green-100  text-green-800  dark:bg-green-900/40  dark:text-green-300'  : ''}
                  ${entry.status === 'rejected' ? 'bg-red-100    text-red-800    dark:bg-red-900/40    dark:text-red-300'    : ''}
                `}>
                  {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                </span>
              </div>

              {/* Action error */}
              {actionError[entry.id] && (
                <p className="text-xs text-destructive">{actionError[entry.id]}</p>
              )}

              {/* Actions (only pending) */}
              {entry.status === 'pending' && (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={rejectNotes[entry.id] ?? ''}
                    onChange={(e) => setRejectNotes((n) => ({ ...n, [entry.id]: e.target.value }))}
                    placeholder="Optional rejection note (shown internally only)"
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(entry.id)}
                      disabled={!!actionLoading[entry.id]}
                      className="flex-1 flex items-center justify-center gap-2 h-9 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {actionLoading[entry.id] ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <><Check className="h-4 w-4" /> Approve</>
                      )}
                    </button>
                    <button
                      onClick={() => handleReject(entry.id)}
                      disabled={!!actionLoading[entry.id]}
                      className="flex-1 flex items-center justify-center gap-2 h-9 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {actionLoading[entry.id] ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <><X className="h-4 w-4" /> Reject</>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Reviewed info */}
              {entry.reviewed_at && (
                <p className="text-xs text-muted-foreground">
                  Reviewed: {formatDate(entry.reviewed_at)}
                  {entry.notes ? ` · Note: ${entry.notes}` : ''}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
