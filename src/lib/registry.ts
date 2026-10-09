// The maavaDao registry (github.com/maavadao/marketplace-registry): AI tools and agents listed by the community.
import type { Pricing } from '@/lib/pricing';

export const REGISTRY_INDEX_URL =
  process.env.REGISTRY_INDEX_URL || 'https://maavadao.github.io/marketplace-registry/index.json';
export const REGISTRY_REPO = 'https://github.com/maavadao/marketplace-registry';

export interface RegistryStats {
  stars: number;
  forks: number;
  language: string | null;
  pushed_at: string;
  archived: boolean;
  stars_gained: number | null;
  since: string | null;
}

export interface RegistryListing {
  slug: string;
  kind: 'tool' | 'agent';
  name: string;
  summary: string;
  description?: string;
  category: string;
  tags?: string[];
  links: { repository?: string; website?: string; docs?: string };
  license?: string;
  skill_level?: 'beginner' | 'intermediate' | 'advanced';
  pricing: Pricing;
  agent?: { runtime: string; audience: string; languages: string[]; data_collected?: string };
  maintainer?: { name?: string; github: string };
  safety?: { reviewed?: boolean; reviewed_on?: string };
  added: string;
  stats?: RegistryStats;
}

export interface RegistryIndex {
  generated_at: string;
  categories: Record<string, string>;
  audiences: Record<string, string>;
  counts: { tools: number; agents: number };
  listings: RegistryListing[];
}

/** The published index, cached for an hour. Returns null if it can't be fetched. */
export async function getRegistryIndex(): Promise<RegistryIndex | null> {
  try {
    const res = await fetch(REGISTRY_INDEX_URL, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return (await res.json()) as RegistryIndex;
  } catch {
    return null;
  }
}

export function listingSourceUrl(listing: RegistryListing): string {
  return `${REGISTRY_REPO}/blob/main/${listing.kind === 'agent' ? 'agents' : 'tools'}/${listing.slug}.yaml`;
}

/** 1234 → "1.2k", 274530 → "275k". */
export function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1).replace(/\.0$/, '')}k`;
  return String(n);
}
