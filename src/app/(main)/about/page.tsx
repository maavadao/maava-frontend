import type { Metadata } from 'next';
import Link from 'next/link';
import { PageContainer } from '@/components/layout';
import { ROUTES } from '@/lib/constants';
import { CONTACT_URL } from '@/lib/pricing';
import { REGISTRY_REPO } from '@/lib/registry';

export const metadata: Metadata = {
  title: 'About',
  description: 'Why mawaDao exists, how it works, and how to get involved.',
};

const HOW_IT_WORKS = [
  ['Create and list, free', 'build an AI agent and list it on the mawa Marketplace. There is no charge to list, create or publish anything, ever.'],
  ['Propose a project', 'any community member can propose a new product, and the DAO votes on it.'],
  ['Educators and learners use them', 'free of charge, to teach, learn, research and inform.'],
  ['Share the rewards', 'when a product is monetised, 75% goes to the contributors who built it and 25% funds children\'s education.'],
];

export default function AboutPage() {
  return (
    <PageContainer>
      <article className="max-w-2xl mx-auto px-4 py-12 sm:py-16 space-y-12">
        <header className="space-y-4">
          <h1 className="text-display text-foreground text-balance">About mawaDao</h1>
          <p className="text-lede text-muted-foreground">
            Build it. Own it. Share it. A community-owned ecosystem of agentic AI and blockchain technologies for
            education, free for everyone, with a share of every success going to children who need it most.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-title text-foreground">Why we exist</h2>
          <p className="text-body text-muted-foreground">
            Open-source developers give their expertise away for nothing, and commercial marketplaces can take up to
            30% of what creators earn, while quality education is still out of reach for millions of children.
            mawaDao turns this around: developers build and list agents for free, and when a product earns money,
            75% goes to the community who built it and 25% funds education for deserving children, orphans and
            street children.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-title text-foreground">How it works</h2>
          <ol className="space-y-4">
            {HOW_IT_WORKS.map(([lead, rest], i) => (
              <li key={lead} className="flex gap-4">
                <span className="text-headline text-primary tabular-nums">{i + 1}</span>
                <p className="text-body text-muted-foreground">
                  <span className="font-semibold text-foreground">{lead}</span> {rest}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-title text-foreground">Get involved</h2>
          <ul className="space-y-2 text-body">
            <li>
              <Link href={ROUTES.MARKETPLACE} className="text-primary hover:underline">Browse the marketplace</Link>{' '}
              <span className="text-muted-foreground">for agents and tools for your school or classroom.</span>
            </li>
            <li>
              <a href={REGISTRY_REPO} className="text-primary hover:underline">List an agent or tool</a>{' '}
              <span className="text-muted-foreground">for the community to review.</span>
            </li>
            <li>
              <a href={CONTACT_URL} className="text-primary hover:underline">Contact us</a>{' '}
              <span className="text-muted-foreground">to bring mawaDao to your school or organisation.</span>
            </li>
          </ul>
        </section>
      </article>
    </PageContainer>
  );
}
