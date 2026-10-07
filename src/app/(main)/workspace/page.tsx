'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AppSidebar, SidebarLayout } from '@/components/layout/sidebar';
import { useAuthStore } from '@/store';

import MarketplaceTab from '@/components/workspace/marketplace-tab';
import AgentsTab from '@/components/workspace/agents-tab';
import CommunitiesTab from '@/components/workspace/communities-tab';
import NotificationsTab from '@/components/workspace/notifications-tab';

type WorkspaceTab = 'marketplace' | 'agents' | 'communities' | 'notifications';

function WorkspaceHubContent() {
  const router = useRouter();
  const authStore = useAuthStore();
  const isAuthenticated = authStore.isAuthenticated || !!authStore.user;
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get('tab') as WorkspaceTab) || 'agents';

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <SidebarLayout sidebar={<AppSidebar />}>
      <div className="p-6 md:p-8 max-w-6xl relative">
        {/* Subtle gradient background */}
        <div className="absolute top-0 right-0 w-[500px] h-[400px] rounded-full bg-gradient-to-bl from-blue-50/40 via-indigo-50/20 to-transparent blur-3xl pointer-events-none" />

        {/* Active Tab Content */}
        {activeTab === 'marketplace' && <MarketplaceTab />}
        {activeTab === 'agents' && <AgentsTab />}
        {activeTab === 'communities' && <CommunitiesTab />}
        {activeTab === 'notifications' && <NotificationsTab />}
      </div>
    </SidebarLayout>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense>
      <WorkspaceHubContent />
    </Suspense>
  );
}
