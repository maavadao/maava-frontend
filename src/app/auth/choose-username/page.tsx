'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useSetupStore } from '@/store';
import { api } from '@/lib/api';
import { MAWADAO_DOMAIN } from '@/lib/constants';
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui';
import { MawadaoLogo } from '@/components/layout';
import { Globe, Check, X, Loader2, ArrowRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ChooseUsernamePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const token = useAuthStore((s) => s.token);
  const apiKey = useAuthStore((s) => s.apiKey);
  const { setupComplete } = useSetupStore.getState();

  const [username, setUsername] = useState('');
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!user && !token && !apiKey) {
      router.push('/');
      return;
    }
    // If user already has a username that doesn't look like an auto-generated one,
    // skip this page and go to the home page (middleware will redirect to subdomain).
    if (user?.username && !user.username.startsWith('user_')) {
      window.location.href = '/';
    }
  }, [user, token, apiKey, router]);

  // Validate username format
  const isValidFormat = useCallback((name: string) => {
    return /^[a-z0-9][a-z0-9_-]{1,30}[a-z0-9]$/.test(name) && name.length >= 3 && name.length <= 32;
  }, []);

  // Check availability with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!username || !isValidFormat(username)) {
      setAvailable(null);
      setSuggestion(null);
      return;
    }

    setChecking(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.checkUsername(username);
        setAvailable(res.available);
        setSuggestion(res.suggestion || null);
      } catch {
        // On error, don't assume available — show unknown state
        setAvailable(null);
        setSuggestion(null);
      } finally {
        setChecking(false);
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [username, isValidFormat]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    setUsername(val);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isValidFormat(username)) {
      setError('Username must be 3-32 characters: letters, numbers, hyphens, underscores');
      return;
    }

    if (available === false) {
      setError('This username is already taken');
      return;
    }

    setSaving(true);
    try {
      const updatedUser = await api.setUsername(username);

      // Update the auth store with the new username
      if (user) {
        setUser({
          ...user,
          username: updatedUser.username || username,
          displayName: updatedUser.displayName || user.displayName,
        });
      }

      // Continue to setup or home
      if (setupComplete) {
        router.push('/');
      } else {
        router.push('/#how-it-works');
      }
    } catch (err) {
      const msg = (err as Error).message || 'Failed to set username';
      if (msg.toLowerCase().includes('taken') || msg.toLowerCase().includes('exists')) {
        setAvailable(false);
        setError('This username is already taken');
      } else {
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const useSuggestion = () => {
    if (suggestion) {
      setUsername(suggestion);
      setError('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="border-b bg-background px-6 py-4">
        <MawadaoLogo />
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Globe className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="text-2xl">Choose Your Username</CardTitle>
            <CardDescription className="text-base">
              This will be your unique identity and subdomain on mawaDao
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              {/* Username input */}
              <div className="space-y-2">
                <label htmlFor="username" className="text-sm font-medium">
                  Username
                </label>
                <div className="relative">
                  <Input
                    id="username"
                    value={username}
                    onChange={handleInputChange}
                    placeholder="your-username"
                    maxLength={32}
                    autoFocus
                    autoComplete="off"
                    className={cn(
                      'pr-10 text-base',
                      available === true && username && 'border-emerald-500 focus-visible:ring-emerald-500/20',
                      available === false && 'border-red-500 focus-visible:ring-red-500/20'
                    )}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {checking && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    {!checking && available === true && username && (
                      <Check className="h-4 w-4 text-emerald-500" />
                    )}
                    {!checking && available === false && (
                      <X className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                </div>

                {/* Format rules */}
                <p className="text-xs text-muted-foreground">
                  3-32 characters. Letters, numbers, hyphens, and underscores only.
                </p>

                {/* Availability feedback */}
                {!checking && available === true && username && isValidFormat(username) && (
                  <p className="text-xs text-emerald-600 flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    Username is available!
                  </p>
                )}
                {!checking && available === false && (
                  <div className="space-y-1">
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <X className="h-3 w-3" />
                      This username is already taken
                    </p>
                    {suggestion && (
                      <button
                        type="button"
                        onClick={useSuggestion}
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        <Sparkles className="h-3 w-3" />
                        Try &ldquo;{suggestion}&rdquo; instead?
                      </button>
                    )}
                  </div>
                )}

                {/* Error */}
                {error && (
                  <p className="text-xs text-red-600">{error}</p>
                )}
              </div>

              {/* Subdomain preview */}
              {username && isValidFormat(username) && (
                <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Your chat page will be
                  </p>
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary shrink-0" />
                    <p className="text-sm font-mono font-medium text-foreground">
                      {username}.{MAWADAO_DOMAIN}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This will be your personal OpenClaw chat page where people can interact with your AI agent.
                  </p>
                </div>
              )}
            </CardContent>

            <CardFooter>
              <Button
                type="submit"
                className="w-full gap-2"
                disabled={saving || !username || !isValidFormat(username) || available === false || checking}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
