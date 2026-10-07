import pool from '@/lib/db';
import { getCachedBackendUrl, cacheBackendUrl } from '@/lib/redis';

export interface TenantInfo {
  tenantId: string;
  userId: string;
  agentId: string | null;
  subdomain: string;
  backendUrl: string;
  storageBucket: string | null;
  region: string;
  gatewayToken: string | null;
}

/**
 * Resolve a subdomain to the tenant's backend URL.
 * Checks Redis cache first, falls back to PostgreSQL, then caches the result.
 * Returns null if no active tenant exists for this subdomain.
 */
export async function resolveTenantBackend(subdomain: string): Promise<TenantInfo | null> {
  if (!subdomain) return null;

  // 1. Check Redis cache for fast path
  const cached = await getCachedBackendUrl(subdomain);
  if (cached) {
    // Cache only stores backend_url; we still need full info for auth checks.
    // For performance, we can return a minimal object and let callers query DB if they need more.
    // But for the proxy route, backendUrl is all we need.
    // Query DB anyway to get full tenant info (still fast with index).
  }

  // 2. Query PostgreSQL
  try {
    const result = await pool.query(
      `SELECT id, user_id, agent_id, subdomain, backend_url, storage_bucket, region, gateway_token
       FROM tenants
       WHERE subdomain = $1 AND status = 'active'
       LIMIT 1`,
      [subdomain]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    if (!row.backend_url) return null;

    const info: TenantInfo = {
      tenantId: row.id,
      userId: row.user_id,
      agentId: row.agent_id,
      subdomain: row.subdomain,
      backendUrl: row.backend_url,
      storageBucket: row.storage_bucket,
      region: row.region,
      gatewayToken: row.gateway_token ?? null,
    };

    // 3. Cache in Redis for subsequent requests
    await cacheBackendUrl(subdomain, row.backend_url);

    return info;
  } catch (err) {
    console.error('[tenant-lookup] DB query failed:', err);
    // If DB fails but we had a cache hit, return minimal info
    if (cached) {
      return {
        tenantId: '',
        userId: '',
        agentId: null,
        subdomain,
        backendUrl: cached,
        storageBucket: null,
        region: 'europe-west1',
        gatewayToken: null,
      };
    }
    return null;
  }
}

/**
 * Check if a subdomain is owned by a specific user.
 */
export async function isSubdomainOwner(subdomain: string, userId: string): Promise<boolean> {
  try {
    const result = await pool.query(
      `SELECT 1 FROM tenants WHERE subdomain = $1 AND user_id = $2 AND status = 'active' LIMIT 1`,
      [subdomain, userId]
    );
    return result.rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * Check if a subdomain is available for registration.
 * When excludeUserId is provided, the user's own existing tenant is excluded
 * (so seeded users can re-provision with their own subdomain).
 */
export async function isSubdomainAvailable(subdomain: string, excludeUserId?: string): Promise<boolean> {
  try {
    const result = excludeUserId
      ? await pool.query(
          `SELECT 1 FROM tenants WHERE subdomain = $1 AND user_id != $2 LIMIT 1`,
          [subdomain, excludeUserId]
        )
      : await pool.query(
          `SELECT 1 FROM tenants WHERE subdomain = $1 LIMIT 1`,
          [subdomain]
        );
    return result.rows.length === 0;
  } catch {
    return false;
  }
}
