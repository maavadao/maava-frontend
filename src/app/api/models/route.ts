import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import pool from "@/lib/db";
import { createDecipheriv, scryptSync } from "crypto";
import { debugLog } from "@/lib/logger";

export const dynamic = "force-dynamic";

type ModelEntry = { id: string; name: string; provider: string; contextWindow?: number };

/* ── Encryption helpers (same key derivation as provider-keys route) ─── */
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

function decrypt(data: string): string {
  try {
    const [ivHex, encHex] = data.split(":");
    if (!ivHex || !encHex) return "";
    const decipher = createDecipheriv("aes-256-cbc", getEncKey(), Buffer.from(ivHex, "hex"));
    return Buffer.concat([decipher.update(Buffer.from(encHex, "hex")), decipher.final()]).toString("utf8");
  } catch { return ""; }
}

/** Get user's connected provider names + decrypted keys */
async function getUserProviders(userId: string): Promise<{ providers: Set<string>; keys: Record<string, string> }> {
  try {
    const result = await pool.query(
      `SELECT provider, api_key FROM provider_keys WHERE user_id = $1 AND is_active = true`,
      [userId],
    );
    const providers = new Set<string>();
    const keys: Record<string, string> = {};
    for (const row of result.rows) {
      providers.add(row.provider);
      const k = decrypt(row.api_key);
      if (k) keys[row.provider] = k;
    }
    return { providers, keys };
  } catch {
    return { providers: new Set(), keys: {} };
  }
}

/* ── Per-provider live model fetchers ──────────────────────────────────── */

// OpenAI: GET https://api.openai.com/v1/models → { data: [{ id, owned_by }] }
// We keep only chat-capable models (gpt-*, chatgpt-*, o1-*, o3-*)
const OPENAI_CHAT_PREFIXES = ["gpt-", "chatgpt-", "o1-", "o3-", "o4-"];
async function fetchOpenAIModels(apiKey: string): Promise<ModelEntry[]> {
  const res = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) { debugLog(`[models] openai list HTTP ${res.status}`); return []; }
  const data = (await res.json()) as { data?: Array<{ id: string; owned_by?: string }> };
  return (data.data ?? [])
    .filter(m => m?.id && OPENAI_CHAT_PREFIXES.some(p => m.id.startsWith(p)))
    .map(m => ({
      id: `openai/${m.id}`,
      name: m.id,
      provider: "openai",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Anthropic: GET https://api.anthropic.com/v1/models → { data: [{ id, display_name }] }
async function fetchAnthropicModels(apiKey: string): Promise<ModelEntry[]> {
  const res = await fetch("https://api.anthropic.com/v1/models?limit=100", {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) { debugLog(`[models] anthropic list HTTP ${res.status}`); return []; }
  const data = (await res.json()) as { data?: Array<{ id: string; display_name?: string }> };
  return (data.data ?? [])
    .filter(m => m?.id)
    .map(m => ({
      id: `anthropic/${m.id}`,
      name: m.display_name || m.id,
      provider: "anthropic",
    }));
}

// Google Gemini: GET https://generativelanguage.googleapis.com/v1beta/models?key=KEY
// → { models: [{ name: "models/gemini-...", displayName, inputTokenLimit }] }
// Keep only models that support generateContent (chat)
async function fetchGoogleModels(apiKey: string): Promise<ModelEntry[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=100`,
    { cache: "no-store", signal: AbortSignal.timeout(8000) },
  );
  if (!res.ok) { debugLog(`[models] google list HTTP ${res.status}`); return []; }
  const data = (await res.json()) as {
    models?: Array<{
      name: string;
      displayName?: string;
      supportedGenerationMethods?: string[];
      inputTokenLimit?: number;
    }>;
  };
  return (data.models ?? [])
    .filter(m => m?.name && (m.supportedGenerationMethods ?? []).includes("generateContent"))
    .map(m => {
      const shortId = m.name.replace(/^models\//, "");
      return {
        id: `google/${shortId}`,
        name: m.displayName || shortId,
        provider: "google",
        contextWindow: m.inputTokenLimit,
      };
    });
}

/* ── Main GET handler ──────────────────────────────────────────────────── */

/**
 * GET /api/models
 *
 * Priority:
 *  1. Local config API (POST /models/list)
 *  2. Local gateway (GET /v1/models)
 *  3. Live fetch from each provider the user has connected (in parallel)
 *  4. Empty list when no providers connected
 */
export async function GET(request: NextRequest) {
  const user = await authenticateRequest(request).catch(() => null);
  const userProviderInfo = user ? await getUserProviders(user.userId) : null;
  const userProviders = userProviderInfo?.providers ?? new Set<string>();
  const userKeys = userProviderInfo?.keys ?? {};

  const gatewayEnv = process.env.OPENCLAW_GATEWAY_URL || process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_URL || process.env.NEXT_PUBLIC_API_URL || "";
  const configEnv = process.env.CONFIG_API_URL || process.env.NEXT_PUBLIC_CONFIG_API_URL || "http://localhost:19002/api/v1";
  debugLog(`[models] GET — user=${user?.userId ?? "anon"} providers=[${[...userProviders].join(",")}]`);

  // ── 1. Config API ─────────────────────────────────────────────────────────
  try {
    const base = configEnv.replace(/\/+$/, "");
    const res = await fetch(`${base}/models/list`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      cache: "no-store",
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      const data = (await res.json()) as Record<string, unknown>;
      const models =
        (data?.data as { models?: ModelEntry[] } | undefined)?.models ??
        (data?.models as ModelEntry[] | undefined) ??
        [];
      if (models.length > 0) {
        debugLog(`[models] source=config-api count=${models.length}`);
        return NextResponse.json({ models, connectedProviders: [...userProviders] });
      }
    }
  } catch (e) { debugLog(`[models] config-api skip: ${(e as Error).message}`); }

  // ── 2. Gateway /v1/models ─────────────────────────────────────────────────
  const gatewayUrl = gatewayEnv.replace(/\/+$/, "");
  if (gatewayUrl) {
    try {
      const res = await fetch(`${gatewayUrl}/v1/models`, {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = (await res.json()) as { data?: Array<{ id: string; name?: string; provider?: string }> };
        const models: ModelEntry[] = (data?.data ?? []).map(m => ({
          id: m.id,
          name: m.name || m.id,
          provider: m.provider || "openai",
        }));
        if (models.length > 0) {
          debugLog(`[models] source=gateway count=${models.length}`);
          return NextResponse.json({ models, connectedProviders: [...userProviders] });
        }
      }
    } catch (e) { debugLog(`[models] gateway skip: ${(e as Error).message}`); }
  }

  // ── 3. Live fetch from each connected provider (in parallel) ──────────────
  const fetchers: Promise<ModelEntry[]>[] = [];
  const sources: string[] = [];

  if (userKeys.openai) {
    fetchers.push(fetchOpenAIModels(userKeys.openai).catch(e => { debugLog(`[models] openai err: ${e.message}`); return []; }));
    sources.push("openai");
  }
  if (userKeys.anthropic) {
    fetchers.push(fetchAnthropicModels(userKeys.anthropic).catch(e => { debugLog(`[models] anthropic err: ${e.message}`); return []; }));
    sources.push("anthropic");
  }
  if (userKeys.google) {
    fetchers.push(fetchGoogleModels(userKeys.google).catch(e => { debugLog(`[models] google err: ${e.message}`); return []; }));
    sources.push("google");
  }
  if (fetchers.length > 0) {
    const results = await Promise.all(fetchers);
    const models = results.flat();
    debugLog(`[models] source=live-providers(${sources.join(",")}) count=${models.length}`);
    return NextResponse.json({ models, connectedProviders: [...userProviders] });
  }

  // ── 4. No providers connected — empty list ────────────────────────────────
  debugLog(`[models] no providers connected, returning empty`);
  return NextResponse.json({ models: [], connectedProviders: [] });
}
