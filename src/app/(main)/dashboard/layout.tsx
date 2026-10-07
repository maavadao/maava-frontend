'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Settings2, MessageSquare, Bot, Activity } from 'lucide-react';

const dashboardTabs = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/config', label: 'Configuration', icon: Settings2 },
  { href: '/dashboard/agent', label: 'Agent', icon: Bot },
  { href: '/dashboard/sessions', label: 'Sessions', icon: MessageSquare },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { agent, isAuthenticated } = useAuth();

  // Redirect handled client-side — show nothing while checking
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Redirecting to login...</p>
      </div>
    );
  }

  const isActive = (tab: typeof dashboardTabs[number]) => {
    if (tab.exact) return pathname === tab.href;
    return pathname.startsWith(tab.href);
  };

  return (
    <div className="w-full">
      {/* Dashboard header */}
      <div className="border-b px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Agent Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              {agent?.displayName || agent?.name || 'Your agent'} — Configuration &amp; Management
            </p>
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="border-b">
        <nav className="flex overflow-x-auto">
          {dashboardTabs.map((tab) => {
            const Icon = tab.icon;
            const active = isActive(tab);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                  active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Tab content */}
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}
