import { Building2, GraduationCap, User } from 'lucide-react';
import { AUDIENCES, AUDIENCE_LABELS, formatPlan, type Audience, type Pricing } from '@/lib/pricing';
import { cn } from '@/lib/utils';

const ICONS: Record<Audience, typeof User> = {
  education: GraduationCap,
  individuals: User,
  business: Building2,
};

/** Price and usage for each type of user. */
export function PricingTable({ pricing, className }: { pricing: Pricing | undefined; className?: string }) {
  return (
    <div className={cn('grid gap-3 sm:grid-cols-3', className)}>
      {AUDIENCES.map((audience) => {
        const Icon = ICONS[audience];
        const plan = pricing?.[audience];
        const label = formatPlan(plan);
        return (
          <div key={audience} className="rounded-lg border bg-card p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Icon className="h-4 w-4 text-primary" aria-hidden />
              {AUDIENCE_LABELS[audience].title}
            </div>
            <p className="text-xs text-muted-foreground">{AUDIENCE_LABELS[audience].who}</p>
            <p className={cn('text-lg font-semibold', label === 'Free' && 'text-green-600 dark:text-green-400')}>{label}</p>
            {plan?.usage && <p className="text-sm text-muted-foreground">{plan.usage}</p>}
          </div>
        );
      })}
    </div>
  );
}
