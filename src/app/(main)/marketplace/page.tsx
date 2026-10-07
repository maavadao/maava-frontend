import type { Metadata } from 'next';
import Link from 'next/link';
import { BadgeCheck, GraduationCap, Plus, Search, Star, Store } from 'lucide-react';
import { PageContainer } from '@/components/layout';
import { Badge, Button, Card, Input } from '@/components/ui';
import { categoryLabel, marketplaceAgents } from '@/lib/marketplace';
import { pricingSummary } from '@/lib/pricing';
import { REGISTRY_REPO } from '@/lib/registry';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Agent marketplace',
  description: 'AI agents built by the community. Free for education; businesses pay to support the developers.',
};

interface Params {
  q?: string;
  category?: string;
}

export default async function MarketplacePage({ searchParams }: { searchParams: Params }) {
  const agents = await marketplaceAgents();
  const q = (searchParams.q || '').trim().toLowerCase();
  const category = searchParams.category || '';
  const categories = Array.from(new Set(agents.map((a) => a.category))).sort();
  const shown = agents.filter(
    (a) =>
      (!category || a.category === category) &&
      (!q || a.name.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q) || a.tags.some((t) => t.toLowerCase().includes(q))),
  );

  return (
    <PageContainer>
      <div className="max-w-6xl mx-auto p-4 space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Store className="h-7 w-7 text-primary" aria-hidden />
              Agent marketplace
            </h1>
            <p className="text-muted-foreground max-w-3xl">
              AI agents built by the community. Every agent is free for students, teachers, schools, orphanages and
              non-profits. Companies and businesses pay the price set by the developer, which supports their work.
            </p>
          </div>
          <a href={`${REGISTRY_REPO}/blob/main/templates/agent.yaml`}>
            <Button variant="outline" className="gap-2">
              <Plus className="h-4 w-4" aria-hidden /> List your agent
            </Button>
          </a>
        </header>

        <form action="/marketplace" className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
            <Input name="q" defaultValue={searchParams.q} placeholder="Search agents" className="pl-9" />
          </div>
          {category && <input type="hidden" name="category" value={category} />}
          <Button type="submit">Search</Button>
        </form>

        {categories.length > 1 && (
          <nav aria-label="Categories" className="flex flex-wrap gap-2">
            <Link href={q ? `/marketplace?q=${encodeURIComponent(q)}` : '/marketplace'}>
              <Badge variant={category ? 'outline' : 'default'}>All</Badge>
            </Link>
            {categories.map((c) => (
              <Link key={c} href={`/marketplace?category=${c}${q ? `&q=${encodeURIComponent(q)}` : ''}`}>
                <Badge variant={category === c ? 'default' : 'outline'}>{categoryLabel(c)}</Badge>
              </Link>
            ))}
          </nav>
        )}

        {shown.length === 0 ? (
          <Card className="p-8 text-center space-y-2">
            <p className="font-medium">No agents here yet.</p>
            <p className="text-sm text-muted-foreground">
              Built an agent for education or small businesses?{' '}
              <a href={REGISTRY_REPO} className="text-primary hover:underline">List it in the mawaDao registry</a>.
            </p>
          </Card>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((a) => (
              <li key={a.slug}>
                <Link href={`/marketplace/${a.slug}`} className="block h-full">
                  <Card className="h-full p-4 space-y-2 hover:border-primary/50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-semibold leading-tight inline-flex items-center gap-1">
                        {a.name}
                        {a.verified && <BadgeCheck className="h-4 w-4 text-primary" aria-label="Verified" />}
                      </h2>
                      {a.rating != null && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                          <Star className="h-3.5 w-3.5" aria-hidden />
                          {a.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-3">{a.summary}</p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Badge variant="secondary">{categoryLabel(a.category)}</Badge>
                      <span className="text-xs text-muted-foreground">by {a.developer}</span>
                    </div>
                    <p className="text-xs inline-flex items-center gap-1 text-muted-foreground">
                      <GraduationCap className="h-3.5 w-3.5" aria-hidden />
                      {pricingSummary(a.pricing)}
                    </p>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageContainer>
  );
}
