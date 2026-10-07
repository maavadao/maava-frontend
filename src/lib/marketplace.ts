// Marketplace agents for the public pages: agents published on mawaDao plus agents listed in the registry.
import pool from '@/lib/db';
import type { Pricing } from '@/lib/pricing';
import { getRegistryIndex, listingSourceUrl } from '@/lib/registry';

export interface MarketplaceAgent {
  slug: string;
  name: string;
  summary: string;
  description: string;
  category: string;
  developer: string;
  verified: boolean;
  rating: number | null;
  installs: number | null;
  tags: string[];
  capabilities: string[];
  integrations: string[];
  pricing: Pricing;
  source: 'mawadao' | 'registry';
  links: { repository?: string; website?: string; listing?: string };
  audience?: string;
  languages?: string[];
  dataCollected?: string;
  reviewed: boolean;
}

const FREE: Pricing = { education: { price: 'free' }, individuals: { price: 'free' }, business: { price: 'free' } };

export function categoryLabel(category: string): string {
  return category.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

async function publishedAgents(): Promise<MarketplaceAgent[]> {
  try {
    const { rows } = await pool.query(
      `SELECT slug, name, short_description, description, about, category, developer, verified,
              rating, review_count, total_installs, tags, integrations, capabilities, pricing
         FROM marketplace_agents
        WHERE COALESCE(is_active, true) AND COALESCE(is_public, true)
        ORDER BY rating DESC, total_installs DESC`,
    );
    return rows.map((r) => ({
      slug: r.slug,
      name: r.name,
      summary: r.short_description || r.description?.slice(0, 160) || '',
      description: r.about || r.description || '',
      category: r.category,
      developer: r.developer || 'Community',
      verified: !!r.verified,
      rating: r.review_count > 0 ? Number(r.rating) : null,
      installs: r.total_installs ?? null,
      tags: r.tags ?? [],
      capabilities: r.capabilities ?? [],
      integrations: r.integrations ?? [],
      pricing: r.pricing ?? FREE,
      source: 'mawadao' as const,
      links: {},
      reviewed: !!r.verified,
    }));
  } catch (err) {
    console.error('[marketplace] could not load published agents:', (err as Error).message);
    return [];
  }
}

async function registryAgents(): Promise<MarketplaceAgent[]> {
  const index = await getRegistryIndex();
  return (index?.listings ?? [])
    .filter((l) => l.kind === 'agent' && l.safety?.reviewed)
    .map((l) => ({
      slug: l.slug,
      name: l.name,
      summary: l.summary,
      description: l.description ?? '',
      category: l.category,
      developer: l.maintainer?.name || l.maintainer?.github || 'Community',
      verified: false,
      rating: null,
      installs: null,
      tags: l.tags ?? [],
      capabilities: [],
      integrations: [],
      pricing: l.pricing,
      source: 'registry' as const,
      links: { repository: l.links.repository, website: l.links.website, listing: listingSourceUrl(l) },
      audience: l.agent?.audience,
      languages: l.agent?.languages,
      dataCollected: l.agent?.data_collected,
      reviewed: true,
    }));
}

/** Every agent shown in the marketplace. Published agents win when a slug appears in both. */
export async function marketplaceAgents(): Promise<MarketplaceAgent[]> {
  const [published, listed] = await Promise.all([publishedAgents(), registryAgents()]);
  const seen = new Set(published.map((a) => a.slug));
  return [...published, ...listed.filter((a) => !seen.has(a.slug))];
}

export async function marketplaceAgent(slug: string): Promise<MarketplaceAgent | null> {
  return (await marketplaceAgents()).find((a) => a.slug === slug) ?? null;
}
