import { Building2, GraduationCap, MessageCircle } from 'lucide-react';
import { CONTACT_URL } from '@/lib/pricing';

/**
 * Who can use mawas and on what terms. Pricing for other uses is still being decided
 * with the community, so for now this points people to us instead of showing prices.
 */
export function AgentAccess() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-lg border bg-card p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <GraduationCap className="h-4 w-4 text-primary" aria-hidden />
          Education and community
        </div>
        <p className="text-lg font-semibold text-green-600 dark:text-green-400">Free</p>
        <p className="text-sm text-muted-foreground">
          Students, teachers, schools, orphanages, community educators and small businesses use mawas free of charge.
        </p>
      </div>
      <div className="rounded-lg border bg-card p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Building2 className="h-4 w-4 text-primary" aria-hidden />
          Other organisations
        </div>
        <p className="text-lg font-semibold">Talk to us</p>
        <p className="text-sm text-muted-foreground">
          We&apos;re working out with the community how larger organisations can support the developers who build for mawaDao.
        </p>
        <a href={CONTACT_URL} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <MessageCircle className="h-4 w-4" aria-hidden /> Contact us
        </a>
      </div>
    </div>
  );
}
