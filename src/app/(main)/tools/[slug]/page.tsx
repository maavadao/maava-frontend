import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink, Github, Pencil, Star, TrendingUp } from 'lucide-react';
import { PageContainer } from '@/components/layout';
import { PricingTable } from '@/components/pricing-table';
import { Badge, Card } from '@/components/ui';
import { formatCount, getRegistryIndex, listingSourceUrl } from '@/lib/registry';

async function findTool(slug: string) {
  const index = await getRegistryIndex();
  const tool = index?.listings.find((l) => l.kind === 'tool' && l.slug === slug);
  return tool ? { index: index!, tool } : null;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const found = await findTool(params.slug);
  return found ? { title: found.tool.name, description: found.tool.summary } : { title: 'Tool not found' };
}

export default async function ToolPage({ params }: { params: { slug: string } }) {
  const found = await findTool(params.slug);
  if (!found) notFound();
  const { index, tool } = found;
  const { stats, links } = tool;

  return (
    <PageContainer>
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <Link href="/tools" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden /> All AI tools
        </Link>

        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-display">{tool.name}</h1>
            <Badge variant="secondary">{index.categories[tool.category] ?? tool.category}</Badge>
            {tool.skill_level && <Badge variant="outline">{tool.skill_level}</Badge>}
          </div>
          <p className="text-lede text-muted-foreground">{tool.summary}</p>
          <div className="flex flex-wrap gap-4 text-sm">
            {links.website && (
              <a href={links.website} className="inline-flex items-center gap-1 text-primary hover:underline" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" aria-hidden /> Website
              </a>
            )}
            {links.repository && (
              <a href={links.repository} className="inline-flex items-center gap-1 text-primary hover:underline" rel="noopener noreferrer">
                <Github className="h-4 w-4" aria-hidden /> Source code
              </a>
            )}
            {links.docs && (
              <a href={links.docs} className="inline-flex items-center gap-1 text-primary hover:underline" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" aria-hidden /> Documentation
              </a>
            )}
          </div>
        </header>

        {tool.description && (
          <Card className="p-5">
            <p className="whitespace-pre-line text-muted-foreground">{tool.description}</p>
          </Card>
        )}

        <section className="space-y-3">
          <h2 className="text-title">Pricing and usage</h2>
          <PricingTable pricing={tool.pricing} />
        </section>

        <section className="grid gap-3 sm:grid-cols-4 text-sm">
          {stats && (
            <>
              <Card className="p-4">
                <p className="text-muted-foreground">Stars</p>
                <p className="text-lg font-semibold inline-flex items-center gap-1"><Star className="h-4 w-4" aria-hidden />{formatCount(stats.stars)}</p>
              </Card>
              <Card className="p-4">
                <p className="text-muted-foreground">This week</p>
                <p className="text-lg font-semibold inline-flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" aria-hidden />
                  {stats.stars_gained != null ? `+${formatCount(stats.stars_gained)}` : '—'}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-muted-foreground">Last updated</p>
                <p className="text-lg font-semibold">{new Date(stats.pushed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </Card>
            </>
          )}
          <Card className="p-4">
            <p className="text-muted-foreground">Licence</p>
            <p className="text-lg font-semibold">{tool.license ?? 'Not stated'}</p>
          </Card>
        </section>

        {!!tool.tags?.length && (
          <div className="flex flex-wrap gap-2">
            {tool.tags.map((tag) => (
              <Link key={tag} href={`/tools?q=${encodeURIComponent(tag)}`}>
                <Badge variant="outline">{tag}</Badge>
              </Link>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Listed in the mawaDao registry. Statistics come from GitHub and were last checked{' '}
          {new Date(index.generated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.{' '}
          <a href={listingSourceUrl(tool)} className="inline-flex items-center gap-1 text-primary hover:underline">
            <Pencil className="h-3 w-3" aria-hidden /> Suggest a correction
          </a>
        </p>
      </div>
    </PageContainer>
  );
}
