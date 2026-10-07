'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useGatewayHealth, useGatewayStatus, useChannels, useSessions, useSkills } from '@/hooks';
import { DashboardOverview } from '@/components/dashboard/overview';

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || !isAuthenticated) return null;

  return <DashboardOverview />;
}
