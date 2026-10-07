'use client';

import { useEffect } from 'react';
import { Loader2, ExternalLink, Store } from 'lucide-react';
import { Button } from '@/components/ui';
import { useCloudStore } from '@/store/cloud';
import { MEMBER_SPACE_URL, MEMBER_SPACE_HOST } from '@/lib/constants';

/**
 * MarketplaceTab — redirects the user to the marketplace in their member space.
 */
export default function MarketplaceTab() {
  const subdomain = useCloudStore((s) => s.subdomain);

  useEffect(() => {
    if (subdomain) {
      window.location.href = `${MEMBER_SPACE_URL}/marketplace`;
    }
  }, [subdomain]);

  if (subdomain) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">
          Redirecting to your marketplace&hellip;
        </p>
        <a
          href={`${MEMBER_SPACE_URL}/marketplace`}
          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
        >
          <ExternalLink className="h-3 w-3" />
          {MEMBER_SPACE_HOST}/marketplace
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-6 text-center max-w-md mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Store className="h-8 w-8 text-primary" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Set up your workspace first</h2>
        <p className="text-muted-foreground">
          The marketplace lives inside your personal AI workspace. Complete onboarding
          to get your subdomain, then browse and install agents.
        </p>
      </div>
      <Button size="lg" className="gap-2" onClick={() => { window.location.href = '/onboarding'; }}>
        Set up workspace
        <ExternalLink className="h-4 w-4" />
      </Button>
    </div>
  );
}
