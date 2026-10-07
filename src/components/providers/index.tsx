'use client';

import * as React from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { SWRConfig } from 'swr';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { useAuthStore } from '@/store';
import { useCloudStore } from '@/store/cloud';
import { api } from '@/lib/api';
import { configApi } from '@/lib/config-api';

// Create query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// SWR configuration
const swrConfig = {
  revalidateOnFocus: false,
  revalidateIfStale: true,
  shouldRetryOnError: true,
  errorRetryCount: 2,
  dedupingInterval: 2000,
};

// Auth provider to initialize auth state
function AuthProvider({ children }: { children: React.ReactNode }) {
  const { apiKey, refresh } = useAuthStore();
  const [isInitialized, setIsInitialized] = React.useState(false);

  React.useEffect(() => {
    const init = async () => {
      if (apiKey) {
        api.setApiKey(apiKey);
        await refresh();
      } else {
        // No apiKey in Zustand (e.g. subdomain with empty localStorage).
        // Try restoring session from the httpOnly auth-token cookie.
        try {
          const res = await fetch('/api/auth/me-session', { credentials: 'include' });
          if (res.ok) {
            const data = await res.json();
            if (data?.authenticated && data.userId) {
              useAuthStore.setState({
                user: {
                  id: data.userId,
                  email: data.email || '',
                  displayName: '',
                  avatarUrl: '',
                  username: data.email?.split('@')[0] || '',
                  isActive: true,
                  isVerified: true,
                  createdAt: new Date().toISOString(),
                },
              });
              if (data.subdomain) {
                useCloudStore.getState().setSubdomain(data.subdomain);
              }
              if (data.tenantId) {
                configApi.setTenantId(data.tenantId);
              }
            }
          }
        } catch {
          // Cannot reach me-session — continue unauthenticated
        }
      }
      setIsInitialized(true);
    };
    init();
  }, [apiKey, refresh]);

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return <>{children}</>;
}

// Analytics provider (placeholder)
function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  React.useEffect(() => {
    // Track page views
    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');
    // console.log('Page view:', url);
    // Add your analytics tracking here (GA, Posthog, etc.)
  }, [pathname, searchParams]);

  return <>{children}</>;
}

// Keyboard shortcuts provider
interface ShortcutContextType {
  registerShortcut: (key: string, handler: () => void, options?: { ctrl?: boolean; shift?: boolean; alt?: boolean }) => void;
  unregisterShortcut: (key: string) => void;
}

const ShortcutContext = React.createContext<ShortcutContextType | null>(null);

export function useShortcuts() {
  const context = React.useContext(ShortcutContext);
  if (!context) throw new Error('useShortcuts must be used within ShortcutProvider');
  return context;
}

function ShortcutProvider({ children }: { children: React.ReactNode }) {
  const shortcutsRef = React.useRef<Map<string, { handler: () => void; options: any }>>(new Map());

  const registerShortcut = React.useCallback((key: string, handler: () => void, options = {}) => {
    shortcutsRef.current.set(key, { handler, options });
  }, []);

  const unregisterShortcut = React.useCallback((key: string) => {
    shortcutsRef.current.delete(key);
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger in input fields
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;

      shortcutsRef.current.forEach(({ handler, options }, key) => {
        const ctrlMatch = !options.ctrl || (e.ctrlKey || e.metaKey);
        const shiftMatch = !options.shift || e.shiftKey;
        const altMatch = !options.alt || e.altKey;
        
        if (e.key.toLowerCase() === key.toLowerCase() && ctrlMatch && shiftMatch && altMatch) {
          e.preventDefault();
          handler();
        }
      });
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <ShortcutContext.Provider value={{ registerShortcut, unregisterShortcut }}>
      {children}
    </ShortcutContext.Provider>
  );
}

// Online status provider
interface OnlineContextType {
  isOnline: boolean;
}

const OnlineContext = React.createContext<OnlineContextType>({ isOnline: true });

export function useOnlineStatus() {
  return React.useContext(OnlineContext);
}

function OnlineProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = React.useState(true);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <OnlineContext.Provider value={{ isOnline }}>
      {children}
      {!isOnline && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 p-4 bg-destructive text-destructive-foreground rounded-lg shadow-lg z-50 animate-in slide-in-from-bottom">
          <p className="font-medium">You're offline</p>
          <p className="text-sm opacity-90">Some features may not work properly</p>
        </div>
      )}
    </OnlineContext.Provider>
  );
}

// Modal context for global modals
interface ModalContextType {
  openModal: (name: string, props?: any) => void;
  closeModal: () => void;
  modal: { name: string; props?: any } | null;
}

const ModalContext = React.createContext<ModalContextType | null>(null);

export function useModal() {
  const context = React.useContext(ModalContext);
  if (!context) throw new Error('useModal must be used within ModalProvider');
  return context;
}

function ModalProvider({ children }: { children: React.ReactNode }) {
  const [modal, setModal] = React.useState<{ name: string; props?: any } | null>(null);

  const openModal = React.useCallback((name: string, props?: any) => {
    setModal({ name, props });
  }, []);

  const closeModal = React.useCallback(() => {
    setModal(null);
  }, []);

  // Close on escape
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modal) closeModal();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [modal, closeModal]);

  return (
    <ModalContext.Provider value={{ openModal, closeModal, modal }}>
      {children}
    </ModalContext.Provider>
  );
}

// Scroll restoration
function ScrollRestoration({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const scrollPositions = React.useRef<Map<string, number>>(new Map());

  React.useEffect(() => {
    // Save scroll position before navigation
    const saveScroll = () => {
      scrollPositions.current.set(pathname, window.scrollY);
    };

    // Restore scroll position
    const savedPosition = scrollPositions.current.get(pathname);
    if (savedPosition !== undefined) {
      window.scrollTo(0, savedPosition);
    } else {
      window.scrollTo(0, 0);
    }

    window.addEventListener('beforeunload', saveScroll);
    return () => window.removeEventListener('beforeunload', saveScroll);
  }, [pathname]);

  return <>{children}</>;
}

// Main providers wrapper
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SWRConfig value={swrConfig}>
        <NextThemesProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <AuthProvider>
            <OnlineProvider>
              <ShortcutProvider>
                <ModalProvider>
                  <AnalyticsProvider>
                    <ScrollRestoration>
                      {children}
                    </ScrollRestoration>
                  </AnalyticsProvider>
                </ModalProvider>
              </ShortcutProvider>
            </OnlineProvider>
          </AuthProvider>
          <Toaster position="bottom-right" richColors closeButton />
        </NextThemesProvider>
      </SWRConfig>
    </QueryClientProvider>
  );
}
