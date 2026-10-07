/**
 * POST /api/setup/provision — Provisions a new tenant.
 *
 * Flow:
 *   1. Validate JWT (user must be authenticated)
 *   2. Check subdomain availability
 *   3. Create tenant record in DB (status: provisioning)
 *   4. Fire Cloud Run Deployer in background (non-blocking)
 *   5. Return immediately — client polls /api/setup/provision/status
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID, randomBytes } from "crypto";
import pool from "@/lib/db";
import { authenticateRequest, createJWT } from "@/lib/auth";
import { debugLog, debugWarn } from "@/lib/logger";
import { isSubdomainAvailable } from "@/lib/tenant-lookup";
import { invalidateBackendUrl } from "@/lib/redis";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { RESERVED_USERNAMES } from "@/lib/constants";

const DEPLOYER_URL =
  process.env.DEPLOYER_URL || "http://localhost:3002/api/v1";
const DEPLOYER_API_SECRET = process.env.DEPLOYER_API_SECRET || "";
const CLOUD_BACKEND_IMAGE =
  process.env.CLOUD_BACKEND_IMAGE ||
  "ghcr.io/mawadao/mawadao-agent-gateway:latest";
const GCS_BUCKET =
  process.env.GCS_BUCKET || "mawadao-agent-data";
// Use CLOUD_MODE (runtime) with NEXT_PUBLIC_CLOUD_MODE (build-time) as fallback.
// NEXT_PUBLIC_ vars are inlined by Next.js at build time and won't reflect runtime env.
const CLOUD_MODE = process.env.CLOUD_MODE === "true" || process.env.NEXT_PUBLIC_CLOUD_MODE === "true";
// Local dev: the mawaDao Agent platform is already running; skip Cloud Run deployment.
const LOCAL_BACKEND_URL =
  process.env.GATEWAY_URL ||
  process.env.NEXT_PUBLIC_GATEWAY_URL ||
  "http://localhost:19001";


/**
 * GET /api/setup/provision — Redirects browser navigation to the onboarding page.
 * This endpoint is POST-only; returning 405 confuses users who follow links or
 * type the URL directly.
 */
export function GET() {
  return NextResponse.redirect(
    new URL(
      "/?step=subdomain",
      process.env.NEXT_PUBLIC_ROOT_DOMAIN || "https://mawadao.com"
    ),
    { status: 302 }
  );
}

export async function POST(request: NextRequest) {
  // Authenticate
  const user = await authenticateRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check DB for existing tenant (handles both fully provisioned and seeded users)
  let existingTenant: {
    id: string;
    subdomain: string;
    backend_url: string | null;
    status: string | null;
    updated_at: Date | null;
  } | null = null;
  try {
    const existing = await pool.query<{
      id: string;
      subdomain: string;
      backend_url: string | null;
      status: string | null;
      updated_at: Date | null;
    }>(
      "SELECT id, subdomain, backend_url, status, updated_at FROM tenants WHERE user_id = $1 LIMIT 1",
      [user.userId]
    );
    if (existing.rows[0]) {
      existingTenant = existing.rows[0];
    }
  } catch {
    // Non-fatal — continue with normal provisioning flow
  }

  // If deployment is already in progress AND recent (under 10 min), return status (don't re-trigger)
  if (existingTenant?.status === "provisioning") {
    const staleMs = Date.now() - (existingTenant.updated_at ? new Date(existingTenant.updated_at).getTime() : 0);
    if (staleMs < 10 * 60 * 1000) {
      return NextResponse.json({
        success: true,
        status: "provisioning",
        tenant: { id: existingTenant.id, subdomain: existingTenant.subdomain },
      });
    }
    // Stale — allow re-provisioning by falling through
  }

  // If previous attempt errored/suspended, allow retry by falling through
  // (status 'error' or 'suspended' from a failed deploy)

  // If tenant is already fully provisioned (has backend_url), return it as-is
  if (existingTenant?.backend_url) {
    const updatedToken = await createJWT({
      userId: user.userId,
      email: user.email,
      subdomain: existingTenant.subdomain,
      tenantId: existingTenant.id,
    });
    const resp = NextResponse.json({
      success: true,
      tenant: {
        id: existingTenant.id,
        subdomain: existingTenant.subdomain,
        backendUrl: existingTenant.backend_url,
      },
      existing: true,
    });
    resp.cookies.set("auth-token", updatedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
      domain: process.env.NODE_ENV === "production" ? ".mawadao.com" : undefined,
    });
    return resp;
  }

  // Rate limit: 3 provisions per hour per user
  const rl = checkRateLimit(user.userId, RATE_LIMITS.provision);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many provisioning attempts. Please try again later." },
      { status: 429 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const subdomain = ((body.subdomain as string) || "").toLowerCase().trim();

  // Validate subdomain format
  if (!subdomain || !/^[a-z][a-z0-9-]{1,61}[a-z0-9]$/.test(subdomain)) {
    return NextResponse.json(
      {
        error:
          "Subdomain must be 3-63 chars, start with a letter, contain only lowercase letters, numbers, and hyphens",
      },
      { status: 400 }
    );
  }

  if (RESERVED_USERNAMES.has(subdomain)) {
    return NextResponse.json(
      { error: "This name is reserved" },
      { status: 400 }
    );
  }

  // Check availability (exclude user's own tenant so seeded subdomain isn't "taken")
  const available = await isSubdomainAvailable(subdomain, user.userId);
  if (!available) {
    return NextResponse.json(
      { error: "This subdomain is already taken" },
      { status: 409 }
    );
  }

  let tenantId: string;
  const gatewayToken = randomBytes(32).toString("hex");

  if (existingTenant) {
    // Reuse existing tenant row (seeded user) — update subdomain and set status to provisioning
    tenantId = existingTenant.id;
    try {
      await pool.query(
        `UPDATE tenants SET subdomain = $1, gateway_token = $2, status = 'provisioning', updated_at = NOW() WHERE id = $3`,
        [subdomain, gatewayToken, tenantId]
      );
    } catch (err: unknown) {
      const pgErr = err as { code?: string };
      if (pgErr.code === "23505") {
        return NextResponse.json(
          { error: "This subdomain is already taken" },
          { status: 409 }
        );
      }
      console.error("Failed to update tenant record:", err);
      return NextResponse.json(
        { error: "Failed to update tenant" },
        { status: 500 }
      );
    }
  } else {
    // Create new tenant record (status: provisioning)
    tenantId = randomUUID();
    try {
      await pool.query(
        `INSERT INTO tenants (id, user_id, subdomain, region, gateway_token, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'provisioning', NOW(), NOW())`,
        [tenantId, user.userId, subdomain, "europe-west1", gatewayToken]
      );
    } catch (err: unknown) {
      const pgErr = err as { code?: string };
      if (pgErr.code === "23505") {
        return NextResponse.json(
          { error: "This subdomain is already taken" },
          { status: 409 }
        );
      }
      console.error("Failed to create tenant record:", err);
      return NextResponse.json(
        { error: "Failed to create tenant" },
        { status: 500 }
      );
    }
  }

  // Issue JWT with subdomain + tenantId immediately (so status polling is authenticated)
  const newToken = await createJWT({
    userId: user.userId,
    email: user.email,
    subdomain,
    tenantId,
  });

  // Fire Cloud Run Deployer in the background — don't block the response.
  // On Cloud Run the Node.js process stays alive so the promise will complete.
  const oldSubdomain = existingTenant?.subdomain;
  if (!CLOUD_MODE) {
    // Dev mode: platform already running locally — just mark active immediately
    const serviceUrl = LOCAL_BACKEND_URL;
    debugLog(`[provision] Dev mode: skipping Cloud Run deploy, using local backend ${serviceUrl}`);
    const serviceName = `mawadao-${subdomain}`;
    const storageBucket = GCS_BUCKET;
    await pool.query(
      `UPDATE tenants SET backend_url = $1, cloud_run_service_name = $2, storage_bucket = $3, status = 'active', updated_at = NOW() WHERE id = $4`,
      [serviceUrl, serviceName, storageBucket, tenantId]
    );
    await invalidateBackendUrl(subdomain);
    if (oldSubdomain && oldSubdomain !== subdomain) await invalidateBackendUrl(oldSubdomain);
  } else {
    // Cloud mode: fire deployer in background, return immediately
    deployInBackground(tenantId, subdomain, user.userId, gatewayToken, oldSubdomain).catch((err) =>
      console.error("[provision] Background deploy error (non-fatal, already handled):", err)
    );
  }

  const response = NextResponse.json({
    success: true,
    status: CLOUD_MODE ? "provisioning" : "active",
    tenant: { id: tenantId, subdomain, region: "europe-west1" },
  });

  response.cookies.set("auth-token", newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
    domain: process.env.NODE_ENV === "production" ? ".mawadao.com" : undefined,
  });

  return response;
}

const STORAGE_URL = process.env.STORAGE_URL || "";
const STORAGE_API_SECRET = process.env.STORAGE_API_SECRET || "";

async function waitForAuthProfilesJson(userId: string) {
  if (!STORAGE_URL) {
    debugWarn("[provision] STORAGE_URL not set — cannot verify auth-profiles.json");
    return false;
  }

  const filePath = `${userId}/mountfolder/agents/main/agent/auth-profiles.json`;
  const headers: Record<string, string> = {};
  if (STORAGE_API_SECRET) {
    headers["X-Storage-Secret"] = STORAGE_API_SECRET;
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      const res = await fetch(
        `${STORAGE_URL}/api/v1/buckets/${encodeURIComponent(GCS_BUCKET)}/files/${filePath}`,
        { headers }
      );

      if (res.ok) {
        debugLog(`[provision] Verified auth-profiles.json for ${userId} (${filePath})`);
        return true;
      }
    } catch (err) {
      debugWarn("[provision] auth-profiles.json verification request failed:", (err as Error).message);
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  return false;
}

/**
 * Provision a tenant via the deployer's dedicated /tenants/provision route.
 * This keeps bucket seeding and Cloud Run deploy logic in one place so the
 * frontend does not drift from the deployer's canonical config shape.
 */
async function deployInBackground(
  tenantId: string,
  subdomain: string,
  userId: string,
  gatewayToken: string,
  oldSubdomain: string | undefined
) {
  try {
    debugLog(`[provision] Starting deploy for ${subdomain} (tenant ${tenantId}, user ${userId})`);

    const deployRes = await fetch(`${DEPLOYER_URL}/tenants/provision`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(DEPLOYER_API_SECRET ? { "x-deployer-secret": DEPLOYER_API_SECRET } : {}),
      },
      body: JSON.stringify({
        subdomain,
        userId,
        tenantId,
        gatewayToken,
        region: "europe-west1",
        containerImage: CLOUD_BACKEND_IMAGE,
      }),
      signal: AbortSignal.timeout(180_000), // 3 min — Cloud Run deploys can take 90s+
    });

    if (!deployRes.ok) {
      const errBody = await deployRes.text();
      throw new Error(`Deployer returned ${deployRes.status}: ${errBody}`);
    }

    const deployData = (await deployRes.json()) as {
      success?: boolean;
      serviceUrl?: string;
      status?: string;
    };
    debugLog(`[provision] Deployer response for ${subdomain}:`, JSON.stringify(deployData));
    const serviceUrl = deployData.serviceUrl || "";

    if (!serviceUrl) {
      throw new Error("Deployer returned OK but no serviceUrl in response: " + JSON.stringify(deployData));
    }

    if (!serviceUrl.startsWith("https://") || serviceUrl.includes("/api/")) {
      throw new Error(`Deployer returned suspicious serviceUrl: ${serviceUrl}`);
    }

    const authProfilesReady = await waitForAuthProfilesJson(userId);
    if (!authProfilesReady) {
      throw new Error(
        "Provisioning finished without auth-profiles.json. Check MOONSHOT_API_KEY on mawadao-frontend and mawadao-agent-deployer."
      );
    }

    await pool.query(
      `UPDATE tenants SET backend_url = $1, cloud_run_service_name = $2, storage_bucket = $3, status = 'active', updated_at = NOW() WHERE id = $4`,
      [serviceUrl, `mawadao-${subdomain}`, GCS_BUCKET, tenantId]
    );

    await invalidateBackendUrl(subdomain);
    if (oldSubdomain && oldSubdomain !== subdomain) await invalidateBackendUrl(oldSubdomain);

    debugLog(`[provision] Deploy SUCCESS for ${subdomain}: ${serviceUrl}`);
  } catch (err) {
    console.error(`[provision] Deploy FAILED for ${subdomain}:`, err);
    // Recovery: the deployer may have succeeded even if the fetch timed out.
    // Check if the Cloud Run service URL is reachable before marking suspended.
    const projectNumber = process.env.GCP_PROJECT_NUMBER || "";
    const expectedUrl = `https://mawadao-${subdomain}-${projectNumber}.europe-west1.run.app`;
    let recovered = false;
    try {
      const probe = await fetch(`${expectedUrl}/health`, { signal: AbortSignal.timeout(10_000) });
      if (probe.ok || probe.status === 404 || probe.status === 503) {
        // Service exists (any response means the container is up or starting)
        debugLog(`[provision] Recovery: service exists at ${expectedUrl}, marking active`);
        await pool.query(
          `UPDATE tenants SET backend_url = $1, cloud_run_service_name = $2, storage_bucket = $3, status = 'active', updated_at = NOW() WHERE id = $4`,
          [expectedUrl, `mawadao-${subdomain}`, GCS_BUCKET, tenantId]
        );
        await invalidateBackendUrl(subdomain);
        if (oldSubdomain && oldSubdomain !== subdomain) await invalidateBackendUrl(oldSubdomain);
        recovered = true;
      }
    } catch { /* probe failed — service truly doesn't exist */ }
    if (!recovered) {
      await pool.query(
        `UPDATE tenants SET status = 'suspended', updated_at = NOW() WHERE id = $1`,
        [tenantId]
      ).catch((dbErr) => console.error("[provision] Failed to mark tenant as suspended:", dbErr));
    }
  }
}
