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
  ['Developers build', 'agents for education, learning support and small businesses, and list them in the open marketplace.'],
  ['The community reviews', 'every agent against our responsible AI and child-safety standards before it is made available.'],
  ['Schools and educators use them', 'free of charge, along with community educators, students and small businesses.'],
  ['The community decides', 'how mawaDao is run, from a single school up to a national or global level.'],
];

export default function AboutPage() {
  return (
    <PageContainer>
      <article className="max-w-2xl mx-auto px-4 py-12 sm:py-16 space-y-12">
        <header className="space-y-4">
          <h1 className="text-display text-foreground text-balance">About mawaDao</h1>
          <p className="text-lede text-muted-foreground">
            A non-profit, community-owned marketplace for responsible AI agents, built to bring quality education to
            underserved children and orphans.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-title text-foreground">Why we exist</h2>
          <p className="text-body text-muted-foreground">
            Millions of children, particularly orphans and those in low-income or remote communities, have no access to
            good teachers, tutoring or learning resources. At the same time, developers around the world are building AI
            agents that could help close that gap. mawaDao connects the two, fairly and accountably.
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
              <Link href={ROUTES.MARKETPLACE} className="text-primary hover:underline">Browse agents</Link>{' '}
              <span className="text-muted-foreground">for your school or classroom.</span>
            </li>
            <li>
              <Link href={ROUTES.TOOLS} className="text-primary hover:underline">Explore AI tools</Link>{' '}
              <span className="text-muted-foreground">and learn what they can do.</span>
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
