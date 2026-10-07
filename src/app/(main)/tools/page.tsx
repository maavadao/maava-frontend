import type { Metadata } from 'next';
import Link from 'next/link';
import { Compass, GraduationCap, Search, Star, TrendingUp } from 'lucide-react';
import { PageContainer } from '@/components/layout';
import { Badge, Button, Card, Input } from '@/components/ui';
import { pricingSummary } from '@/lib/pricing';
import { formatCount, getRegistryIndex, REGISTRY_REPO, type RegistryListing } from '@/lib/registry';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Explore AI tools',
  description: 'Discover and learn about open-source and trending AI tools, with pricing for students, individuals and businesses.',
};

const PAGE_SIZE = 48;
const SORTS = { trending: 'Trending', stars: 'Most starred', recent: 'Recently updated', name: 'Name' } as const;
type Sort = keyof typeof SORTS;

interface Params {
  q?: string;
  category?: string;
  sort?: string;
  free?: string;
  page?: string;
}

function sortListings(items: RegistryListing[], sort: Sort): RegistryListing[] {
  const stars = (l: RegistryListing) => l.stats?.stars ?? 0;
  const by: Record<Sort, (a: RegistryListing, b: RegistryListing) => number> = {
    trending: (a, b) => (b.stats?.stars_gained ?? 0) - (a.stats?.stars_gained ?? 0) || stars(b) - stars(a),
    stars: (a, b) => stars(b) - stars(a),
    recent: (a, b) => (b.stats?.pushed_at ?? '').localeCompare(a.stats?.pushed_at ?? ''),
    name: (a, b) => a.name.localeCompare(b.name),
  };
  return [...items].sort(by[sort]);
}

function href(current: Params, change: Partial<Params>): string {
  const next = { ...current, ...change };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(next)) if (v) qs.set(k, v);
  const s = qs.toString();
  return s ? `/tools?${s}` : '/tools';
}

export default async function ToolsPage({ searchParams }: { searchParams: Params }) {
  const index = await getRegistryIndex();
  const sort: Sort = (searchParams.sort as Sort) in SORTS ? (searchParams.sort as Sort) : 'trending';
  const q = (searchParams.q || '').trim().toLowerCase();
  const category = searchParams.category || '';
  const freeOnly = searchParams.free === '1';
  const page = Math.max(1, parseInt(searchParams.page || '1', 10) || 1);

  if (!index) {
    return (
      <PageContainer>
        <Card className="max-w-2xl mx-auto p-8 text-center space-y-3">
          <h1 className="text-2xl font-semibold">Explore AI tools</h1>
          <p className="text-muted-foreground">The tool list couldn&apos;t be loaded right now. Please try again shortly.</p>
        </Card>
      </PageContainer>
    );
  }

  const tools = index.listings.filter((l) => l.kind === 'tool');
  const counts = new Map<string, number>();
  for (const t of tools) counts.set(t.category, (counts.get(t.category) ?? 0) + 1);

  const filtered = sortListings(
    tools.filter(
      (t) =>
        (!category || t.category === category) &&
        (!freeOnly || t.pricing?.education?.price === 'free') &&
        (!q ||
          t.name.toLowerCase().includes(q) ||
          t.summary.toLowerCase().includes(q) ||
          (t.tags ?? []).some((tag) => tag.includes(q))),
    ),
    sort,
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const shown = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <PageContainer>
      <div className="max-w-6xl mx-auto p-4 space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Compass className="h-7 w-7 text-primary" aria-hidden />
            Explore AI tools
          </h1>
          <p className="text-muted-foreground max-w-3xl">
            Learn about open-source and trending AI tools listed by the community, with what each one costs for
            students and educators, individuals and businesses. Built a tool?{' '}
            <a href={REGISTRY_REPO} className="text-primary hover:underline">List it on mawaDao</a>.
          </p>
        </header>

        <form action="/tools" className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
            <Input name="q" defaultValue={searchParams.q} placeholder="Search tools, for example speech, OCR, tutoring" className="pl-9" />
          </div>
          {category && <input type="hidden" name="category" value={category} />}
          {freeOnly && <input type="hidden" name="free" value="1" />}
          <input type="hidden" name="sort" value={sort} />
          <Button type="submit">Search</Button>
        </form>

        <nav aria-label="Categories" className="flex flex-wrap gap-2">
          <Link href={href(searchParams, { category: undefined, page: undefined })}>
            <Badge variant={category ? 'outline' : 'default'}>All</Badge>
          </Link>
          {Object.entries(index.categories)
            .filter(([slug]) => counts.has(slug))
            .map(([slug, label]) => (
              <Link key={slug} href={href(searchParams, { category: slug, page: undefined })}>
                <Badge variant={category === slug ? 'default' : 'outline'}>
                  {label} <span className="ml-1 opacity-60">{counts.get(slug)}</span>
                </Badge>
              </Link>
            ))}
        </nav>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted-foreground">Sort:</span>
          {(Object.keys(SORTS) as Sort[]).map((s) => (
            <Link
              key={s}
              href={href(searchParams, { sort: s, page: undefined })}
              className={cn('hover:text-foreground', s === sort ? 'font-medium text-foreground' : 'text-muted-foreground')}
            >
              {SORTS[s]}
            </Link>
          ))}
          <Link
            href={href(searchParams, { free: freeOnly ? undefined : '1', page: undefined })}
            className={cn('ml-auto inline-flex items-center gap-1', freeOnly ? 'font-medium text-foreground' : 'text-muted-foreground')}
          >
            <GraduationCap className="h-4 w-4" aria-hidden />
            {freeOnly ? 'Showing free for education' : 'Free for education only'}
          </Link>
        </div>

        {tools.length === 0 ? (
          <Card className="p-8 text-center space-y-2">
            <p className="font-medium">No tools listed yet.</p>
            <p className="text-sm text-muted-foreground">
              Built an AI tool, or know a good one for learners?{' '}
              <a href={REGISTRY_REPO} className="text-primary hover:underline">Add it to the mawaDao registry</a>.
            </p>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground">{filtered.length.toLocaleString('en-GB')} tools</p>
        )}

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((t) => (
            <li key={t.slug}>
              <Link href={`/tools/${t.slug}`} className="block h-full">
                <Card className="h-full p-4 space-y-2 hover:border-primary/50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold leading-tight">{t.name}</h2>
                    {t.stats && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <Star className="h-3.5 w-3.5" aria-hidden />
                        {formatCount(t.stats.stars)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-3">{t.summary}</p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Badge variant="secondary">{index.categories[t.category] ?? t.category}</Badge>
                    {!!t.stats?.stars_gained && t.stats.stars_gained > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                        <TrendingUp className="h-3.5 w-3.5" aria-hidden />+{formatCount(t.stats.stars_gained)} this week
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{pricingSummary(t.pricing)}</p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>

        {pages > 1 && (
          <nav aria-label="Pages" className="flex items-center justify-center gap-4 text-sm">
            {page > 1 && <Link href={href(searchParams, { page: String(page - 1) })} className="text-primary hover:underline">Previous</Link>}
            <span className="text-muted-foreground">Page {page} of {pages}</span>
            {page < pages && <Link href={href(searchParams, { page: String(page + 1) })} className="text-primary hover:underline">Next</Link>}
          </nav>
        )}
      </div>
    </PageContainer>
  );
}
