import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import pool from "@/lib/db";
import { debugWarn } from "@/lib/logger";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALLOWED_PROVIDERS = ["openai", "anthropic", "google", "moonshot"];

// Derive a 32-byte key from the JWT secret (or a dedicated env var)
const SALT = "mawadao-provider-keys";
let encKey: Buffer | undefined;
function getEncKey(): Buffer {
  if (!encKey) {
    const secret = process.env.PROVIDER_KEY_SECRET || process.env.JWT_SECRET;
    if (!secret) throw new Error("PROVIDER_KEY_SECRET or JWT_SECRET must be set");
    encKey = scryptSync(secret, SALT, 32);
  }
  return encKey;
}

// Bucket-manager config — same env vars used by the provision route
const STORAGE_URL = process.env.STORAGE_URL || "";
const STORAGE_API_SECRET = process.env.STORAGE_API_SECRET || "";
const GCS_BUCKET = process.env.GCS_BUCKET || "mawadao-agent-data";

function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", getEncKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decrypt(data: string): string {
  const [ivHex, encHex] = data.split(":");
  if (!ivHex || !encHex) return "";
  const decipher = createDecipheriv("aes-256-cbc", getEncKey(), Buffer.from(ivHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(encHex, "hex")), decipher.final()]).toString("utf8");
}

/** Mask an API key for display: show first 8 and last 4 chars */
function mask(key: string): string {
  if (key.length <= 12) return "****";
  return key.slice(0, 8) + "..." + key.slice(-4);
}

// ---------------------------------------------------------------------------
// GCS auth-profiles.json sync helpers
// ---------------------------------------------------------------------------

type AuthProfileEntry = { type: "api_key"; provider: string; key: string };
type AuthProfileStore = { version: number; profiles: Record<string, AuthProfileEntry> };

function sanitizeSecret(value: string): string {
  return value.replace(/^\uFEFF+/, "").trim();
}

function buildBucketManagerHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (STORAGE_API_SECRET) h["X-Storage-Secret"] = STORAGE_API_SECRET;
  return h;
}

async function readAuthProfilesFromGCS(authPath: string): Promise<AuthProfileStore> {
  const url = `${STORAGE_URL}/api/v1/buckets/${encodeURIComponent(GCS_BUCKET)}/files/${authPath}`;
  try {
    const res = await fetch(url, { headers: buildBucketManagerHeaders() });
    if (res.ok) {
      const raw = (await res.json()) as Partial<AuthProfileStore>;
      if (raw && raw.profiles && typeof raw.profiles === "object") {
        return { version: raw.version ?? 1, profiles: raw.profiles };
      }
    }
  } catch {
    // will fall back to empty store
  }
  return { version: 1, profiles: {} };
}

async function writeAuthProfilesToGCS(authPath: string, store: AuthProfileStore): Promise<void> {
  const url = `${STORAGE_URL}/api/v1/buckets/${encodeURIComponent(GCS_BUCKET)}/files/${authPath}`;
  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: buildBucketManagerHeaders(),
      body: JSON.stringify(store, null, 2),
    });
    if (!res.ok) {
      const body = await res.text();
      debugWarn(`[provider-keys] GCS write failed (HTTP ${res.status}): ${body}`);
    }
  } catch (err) {
    debugWarn("[provider-keys] GCS write error:", (err as Error).message);
  }
}

/**
 * Adds or updates the api_key entry for `provider` in the user's auth-profiles.json.
 * Fire-and-forget — does not block or affect the HTTP response.
 */
async function upsertProviderKeyInGCS(userId: string, provider: string, apiKey: string): Promise<void> {
  if (!STORAGE_URL) return;
  const authPath = `${userId}/mountfolder/agents/main/agent/auth-profiles.json`;
  const store = await readAuthProfilesFromGCS(authPath);
  store.profiles[`${provider}:default`] = { type: "api_key", provider, key: sanitizeSecret(apiKey) };
  await writeAuthProfilesToGCS(authPath, store);
}

/**
 * Removes the api_key entry for `provider` from the user's auth-profiles.json.
 * Fire-and-forget — does not block or affect the HTTP response.
 */
async function removeProviderKeyFromGCS(userId: string, provider: string): Promise<void> {
  if (!STORAGE_URL) return;
  const authPath = `${userId}/mountfolder/agents/main/agent/auth-profiles.json`;
  const store = await readAuthProfilesFromGCS(authPath);
  delete store.profiles[`${provider}:default`];
  await writeAuthProfilesToGCS(authPath, store);
}

/**
 * GET /api/provider-keys
 * List the authenticated user's saved provider keys (masked).
 */
export async function GET(request: NextRequest) {
  const user = await authenticateRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await pool.query(
      `SELECT id, provider, api_key, label, is_active, created_at, updated_at
       FROM provider_keys
       WHERE user_id = $1
       ORDER BY provider ASC`,
      [user.userId],
    );

    const keys = result.rows.map((row) => ({
      id: row.id,
      provider: row.provider,
      maskedKey: mask(decrypt(row.api_key)),
      label: row.label,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json({ success: true, providers: keys });
  } catch (err) {
    console.error("[api/provider-keys GET]", err);
    return NextResponse.json({ success: true, providers: [] });
  }
}

/**
 * POST /api/provider-keys
 * Save (upsert) a provider API key.
 * Body: { provider: string, apiKey: string, label?: string }
 */
export async function POST(request: NextRequest) {
  const user = await authenticateRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const provider = String(body.provider || "").toLowerCase().trim();
  const apiKey = String(body.apiKey || "").trim();
  const label = body.label ? String(body.label).trim().slice(0, 255) : null;

  if (!ALLOWED_PROVIDERS.includes(provider)) {
    return NextResponse.json(
      { error: `Invalid provider. Allowed: ${ALLOWED_PROVIDERS.join(", ")}` },
      { status: 400 },
    );
  }

  if (!apiKey || apiKey.length < 10) {
    return NextResponse.json({ error: "API key must be at least 10 characters" }, { status: 400 });
  }

  try {
    const encrypted = encrypt(apiKey);
    const result = await pool.query(
      `INSERT INTO provider_keys (user_id, provider, api_key, label, is_active)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (user_id, provider)
       DO UPDATE SET
         api_key    = EXCLUDED.api_key,
         label      = EXCLUDED.label,
         is_active  = true,
         updated_at = NOW()
       RETURNING id, provider, label, is_active, created_at, updated_at`,
      [user.userId, provider, encrypted, label],
    );

    const row = result.rows[0];

    // Sync to GCS auth-profiles.json (fire-and-forget — never fails the response)
    void upsertProviderKeyInGCS(user.userId, provider, apiKey).catch((err) => {
      debugWarn("[provider-keys] GCS upsert failed:", (err as Error).message);
    });

    return NextResponse.json({
      success: true,
      provider: {
        id: row.id,
        provider: row.provider,
        maskedKey: mask(apiKey),
        label: row.label,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (err) {
    console.error("[api/provider-keys POST]", err);
    return NextResponse.json({ error: "Failed to save provider key" }, { status: 500 });
  }
}

/**
 * DELETE /api/provider-keys
 * Remove a provider key.
 * Query: ?provider=openai
 */
export async function DELETE(request: NextRequest) {
  const user = await authenticateRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const provider = request.nextUrl.searchParams.get("provider")?.toLowerCase().trim();
  if (!provider || !ALLOWED_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: "Invalid or missing provider parameter" }, { status: 400 });
  }

  try {
    const result = await pool.query(
      "DELETE FROM provider_keys WHERE user_id = $1 AND provider = $2 RETURNING id",
      [user.userId, provider],
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Provider key not found" }, { status: 404 });
    }

    // Sync removal to GCS auth-profiles.json (fire-and-forget)
    void removeProviderKeyFromGCS(user.userId, provider).catch((err) => {
      debugWarn("[provider-keys] GCS remove failed:", (err as Error).message);
    });

    return NextResponse.json({ success: true, deleted: true });
  } catch (err) {
    console.error("[api/provider-keys DELETE]", err);
    return NextResponse.json({ error: "Failed to delete provider key" }, { status: 500 });
  }
}
