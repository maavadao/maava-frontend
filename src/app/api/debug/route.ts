/**
 * GET /api/debug
 *
 * Comprehensive diagnostics endpoint. Returns:
 *  - Build info (commit SHA, build time, Node version, Next version)
 *  - All relevant env vars (values redacted for secrets, only presence shown)
 *  - DB connectivity test + latency
 *  - Gateway connectivity test + latency + /v1/models response
 *  - Config API connectivity test
 *  - Package versions of critical deps (pg, ioredis, next)
 *  - Runtime module resolution check (pg, ioredis)
 *
 * Access: GET https://mawadao.com/api/debug
 */

import { NextResponse } from "next/server";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

const require = createRequire(import.meta.url);

interface CheckResult {
  ok: boolean;
  latencyMs?: number;
  detail?: string;
  error?: string;
}

async function checkDb(): Promise<CheckResult> {
  const t0 = Date.now();
  try {
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
      return { ok: true, latencyMs: Date.now() - t0 };
    } finally {
      client.release();
    }
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - t0, error: err instanceof Error ? err.message : String(err) };
  }
}

async function checkUrl(url: string, opts?: RequestInit & { timeoutMs?: number }): Promise<CheckResult> {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      ...opts,
      signal: AbortSignal.timeout(opts?.timeoutMs ?? 5000),
    });
    const text = await res.text().catch(() => "");
    return {
      ok: res.ok,
      latencyMs: Date.now() - t0,
      detail: `HTTP ${res.status} — ${text.slice(0, 300)}`,
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function resolveModule(name: "pg" | "ioredis" | "next/package.json"): string {
  switch (name) {
    case "pg":
      return require.resolve("pg");
    case "ioredis":
      return require.resolve("ioredis");
    case "next/package.json":
      return require.resolve("next/package.json");
  }
}

function checkModule(name: "pg" | "ioredis" | "next/package.json"): { resolvable: boolean; path?: string; error?: string } {
  try {
    const resolved = resolveModule(name);
    return { resolvable: true, path: resolved.slice(0, 120) };
  } catch (err) {
    return { resolvable: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function readDeclaredPackageVersions() {
  const packagePath = join(process.cwd(), "package.json");
  const pkgText = await readFile(packagePath, "utf8");
  const pkg = JSON.parse(pkgText) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  return { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
}

async function readInstalledPackageVersion(name: "pg" | "ioredis" | "next") {
  const packageJsonPath = name === "next"
    ? resolveModule("next/package.json")
    : require.resolve(`${name}/package.json`);
  const pkgText = await readFile(packageJsonPath, "utf8");
  const pkg = JSON.parse(pkgText) as { version?: string };
  return pkg.version ?? "?";
}

function redact(value: string | undefined, show = 6): string {
  if (!value) return "(not set)";
  if (value.length <= show) return "***";
  return value.slice(0, show) + "…[redacted]";
}

export async function GET() {
  // ── 1. Build info ─────────────────────────────────────────────────────────
  const buildInfo = {
    commitSha: process.env.COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "(unknown)",
    buildTime: process.env.BUILD_TIME ?? "(unknown)",
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    uptime: `${Math.round(process.uptime())}s`,
    env: process.env.NODE_ENV ?? "(not set)",
  };

  // ── 2. Env vars (redacted) ────────────────────────────────────────────────
  const {
    DATABASE_URL,
    NEXT_PUBLIC_AUTH_URL,
    GATEWAY_URL,
    NEXT_PUBLIC_GATEWAY_URL,
    NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_CONFIG_API_URL,
    CONFIG_API_URL,
    OPENAI_API_KEY,
    ANTHROPIC_API_KEY,
    NEXT_PUBLIC_GATEWAY_TOKEN,
    OPENCLAW_GATEWAY_TOKEN,
    REDIS_URL,
    NEXT_PUBLIC_CLOUD_MODE,
    NEXT_PUBLIC_GATEWAY_UI_URL,
  } = process.env;

  const envVars = {
    DATABASE_URL: redact(DATABASE_URL, 30),
    NEXT_PUBLIC_AUTH_URL: NEXT_PUBLIC_AUTH_URL ?? "(not set)",
    GATEWAY_URL: GATEWAY_URL ?? "(not set)",
    NEXT_PUBLIC_GATEWAY_URL: NEXT_PUBLIC_GATEWAY_URL ?? "(not set)",
    NEXT_PUBLIC_API_URL: NEXT_PUBLIC_API_URL ?? "(not set)",
    NEXT_PUBLIC_CONFIG_API_URL: NEXT_PUBLIC_CONFIG_API_URL ?? "(not set)",
    CONFIG_API_URL: CONFIG_API_URL ?? "(not set)",
    OPENAI_API_KEY: redact(OPENAI_API_KEY, 8),
    ANTHROPIC_API_KEY: redact(ANTHROPIC_API_KEY, 8),
    NEXT_PUBLIC_GATEWAY_TOKEN: redact(NEXT_PUBLIC_GATEWAY_TOKEN, 4),
    OPENCLAW_GATEWAY_TOKEN: redact(OPENCLAW_GATEWAY_TOKEN, 4),
    REDIS_URL: redact(REDIS_URL, 20),
    NEXT_PUBLIC_CLOUD_MODE: NEXT_PUBLIC_CLOUD_MODE ?? "(not set)",
    NEXT_PUBLIC_GATEWAY_UI_URL: NEXT_PUBLIC_GATEWAY_UI_URL ?? "(not set)",
  };

  // ── 3. Module resolution ───────────────────────────────────────────────────
  const modules = {
    pg: checkModule("pg"),
    ioredis: checkModule("ioredis"),
    next: checkModule("next/package.json"),
  };

  // ── 4. Package versions ────────────────────────────────────────────────────
  let packageVersions: Record<string, string> = {};
  try {
    const deps = await readDeclaredPackageVersions();
    for (const key of ["pg", "ioredis", "next", "ai"]) {
      packageVersions[key] = deps[key] ?? "(not in package.json)";
    }
  } catch {
    packageVersions = { error: "could not read package.json" };
  }

  let installedVersions: Record<string, string> = {};
  for (const pkg of ["pg", "ioredis", "next"]) {
    try {
      installedVersions[pkg] = await readInstalledPackageVersion(pkg as "pg" | "ioredis" | "next");
    } catch {
      installedVersions[pkg] = "(not installed)";
    }
  }

  // ── 5. Connectivity checks ─────────────────────────────────────────────────
  const gatewayUrl = (
    GATEWAY_URL ||
    NEXT_PUBLIC_GATEWAY_URL ||
    NEXT_PUBLIC_API_URL ||
    ""
  ).replace(/\/+$/, "");

  const configApiUrl = (
    CONFIG_API_URL ||
    NEXT_PUBLIC_CONFIG_API_URL ||
    "http://localhost:19002/api/v1"
  ).replace(/\/+$/, "");

  const authUrl = (NEXT_PUBLIC_AUTH_URL || "https://auth.mawadao.com").replace(/\/+$/, "");

  const [dbCheck, gatewayModelsCheck, gatewayHealthCheck, configApiCheck, authHealthCheck] = await Promise.all([
    checkDb(),
    gatewayUrl ? checkUrl(`${gatewayUrl}/v1/models`, { timeoutMs: 5000 }) : Promise.resolve({ ok: false, detail: "GATEWAY_URL not configured" }),
    gatewayUrl ? checkUrl(`${gatewayUrl}/health`, { timeoutMs: 5000 }) : Promise.resolve({ ok: false, detail: "GATEWAY_URL not configured" }),
    checkUrl(`${configApiUrl}/models/list`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      timeoutMs: 3000,
    }),
    checkUrl(`${authUrl}/health`, { timeoutMs: 5000 }),
  ]);

  // ── 6. Chat route self-check ───────────────────────────────────────────────
  // Check which provider the chat route would use given current env vars
  const chatRouteProvider = (() => {
    const isLocalGateway = !!GATEWAY_URL;
    if (isLocalGateway) return `mawadao-agent-gateway (${GATEWAY_URL})`;
    if (OPENAI_API_KEY) return "openai-direct";
    if (ANTHROPIC_API_KEY) return "anthropic-direct";
    return "no-provider-configured";
  })();

  const body = {
    timestamp: new Date().toISOString(),
    build: buildInfo,
    env: envVars,
    modules,
    packageVersions: {
      declared: packageVersions,
      installed: installedVersions,
    },
    connectivity: {
      db: { url: redact(DATABASE_URL, 30), ...dbCheck },
      gateway: {
        url: gatewayUrl,
        models: gatewayModelsCheck,
        health: gatewayHealthCheck,
      },
      configApi: {
        url: configApiUrl,
        modelsEndpoint: configApiCheck,
      },
      auth: {
        url: authUrl,
        health: authHealthCheck,
      },
    },
    chatRoute: {
      cloudMode: NEXT_PUBLIC_CLOUD_MODE === "true",
      resolvedProvider: chatRouteProvider,
      gatewayUrl,
    },
  };

  const overallOk = dbCheck.ok && modules.pg.resolvable && modules.ioredis.resolvable;

  return NextResponse.json(body, { status: overallOk ? 200 : 503 });
}
