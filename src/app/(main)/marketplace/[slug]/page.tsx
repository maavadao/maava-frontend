import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BadgeCheck, ExternalLink, Github, Languages, ShieldCheck, Users } from 'lucide-react';
import { PageContainer } from '@/components/layout';
import { AgentAccess } from '@/components/agent-access';
import { Badge, Button, Card } from '@/components/ui';
import { MEMBER_SPACE_URL } from '@/lib/constants';
import { categoryLabel, marketplaceAgent } from '@/lib/marketplace';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const agent = await marketplaceAgent(params.slug);
  return agent ? { title: agent.name, description: agent.summary } : { title: 'Agent not found' };
}

export default async function MarketplaceAgentPage({ params }: { params: { slug: string } }) {
  const agent = await marketplaceAgent(params.slug);
  if (!agent) notFound();

  return (
    <PageContainer>
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <Link href="/marketplace" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Agent marketplace
        </Link>

        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-display">{agent.name}</h1>
            {agent.verified && <BadgeCheck className="h-6 w-6 text-primary" aria-label="Verified" />}
            <Badge variant="secondary">{categoryLabel(agent.category)}</Badge>
          </div>
          <p className="text-lede text-muted-foreground">{agent.summary}</p>
          <p className="text-sm text-muted-foreground">by {agent.developer}</p>
          <div className="flex flex-wrap gap-3">
            {agent.source === 'mawadao' && (
              <a href={`${MEMBER_SPACE_URL}/marketplace`}>
                <Button>Use this agent</Button>
              </a>
            )}
            {agent.links.repository && (
              <a href={agent.links.repository} rel="noopener noreferrer">
                <Button variant="outline" className="gap-2"><Github className="h-4 w-4" aria-hidden /> Source code</Button>
              </a>
            )}
            {agent.links.website && (
              <a href={agent.links.website} rel="noopener noreferrer">
                <Button variant="outline" className="gap-2"><ExternalLink className="h-4 w-4" aria-hidden /> Website</Button>
              </a>
            )}
          </div>
        </header>

        <section className="space-y-3">
          <h2 className="text-title">Who can use it</h2>
          <AgentAccess />
        </section>

        {(agent.audience || agent.languages?.length || agent.dataCollected) && (
          <section className="grid gap-3 sm:grid-cols-3 text-sm">
            {agent.audience && (
              <Card className="p-4 space-y-1">
                <p className="text-muted-foreground inline-flex items-center gap-1"><Users className="h-4 w-4" aria-hidden /> Made for</p>
                <p>{agent.audience}</p>
              </Card>
            )}
            {!!agent.languages?.length && (
              <Card className="p-4 space-y-1">
                <p className="text-muted-foreground inline-flex items-center gap-1"><Languages className="h-4 w-4" aria-hidden /> Languages</p>
                <p>{agent.languages.join(', ')}</p>
              </Card>
            )}
            {agent.dataCollected && (
              <Card className="p-4 space-y-1">
                <p className="text-muted-foreground inline-flex items-center gap-1"><ShieldCheck className="h-4 w-4" aria-hidden /> Data collected</p>
                <p>{agent.dataCollected}</p>
              </Card>
            )}
          </section>
        )}

        {agent.description && (
          <Card className="p-5">
            <p className="whitespace-pre-line text-muted-foreground">{agent.description}</p>
          </Card>
        )}

        {(agent.capabilities.length > 0 || agent.integrations.length > 0) && (
          <section className="grid gap-4 sm:grid-cols-2">
            {agent.capabilities.length > 0 && (
              <div className="space-y-2">
                <h2 className="font-semibold">What it can do</h2>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {agent.capabilities.map((c) => <li key={c}>{c}</li>)}
                </ul>
              </div>
            )}
            {agent.integrations.length > 0 && (
              <div className="space-y-2">
                <h2 className="font-semibold">Works with</h2>
                <div className="flex flex-wrap gap-2">
                  {agent.integrations.map((i) => <Badge key={i} variant="outline">{i}</Badge>)}
                </div>
              </div>
            )}
          </section>
        )}

        {agent.source === 'registry' && agent.links.listing && (
          <p className="text-xs text-muted-foreground">
            Listed in the mawaDao registry and reviewed by the community.{' '}
            <a href={agent.links.listing} className="text-primary hover:underline">View the listing</a>
          </p>
        )}
      </div>
    </PageContainer>
  );
}
