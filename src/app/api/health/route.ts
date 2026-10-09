import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = "force-dynamic";

export async function GET() {
  const dbUrlSet = !!process.env.DATABASE_URL;
  let dbConnected = false;
  let dbError: string | undefined;
  let dbLatencyMs: number | undefined;

  const t0 = Date.now();
  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      dbConnected = true;
      dbLatencyMs = Date.now() - t0;
    } finally {
      client.release();
    }
  } catch (err) {
    dbLatencyMs = Date.now() - t0;
    dbError = err instanceof Error ? err.message : String(err);
  }

  // Quick gateway reachability check
  const gatewayUrl = (
    process.env.GATEWAY_URL ||
    process.env.NEXT_PUBLIC_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    ''
  ).replace(/\/+$/, '');

  let gatewayOk = false;
  let gatewayLatencyMs: number | undefined;
  if (gatewayUrl) {
    const gt0 = Date.now();
    try {
      const res = await fetch(`${gatewayUrl}/v1/models`, {
        signal: AbortSignal.timeout(4000),
      });
      gatewayOk = res.ok;
      gatewayLatencyMs = Date.now() - gt0;
    } catch {
      gatewayLatencyMs = Date.now() - gt0;
    }
  }

  // Check pg module is loadable (critical for API routes)
  let pgLoadable = false;
  try {
    require.resolve('pg');
    pgLoadable = true;
  } catch { /* not available */ }

  const status = dbConnected ? 'ok' : 'degraded';

  const body = {
    service: 'maavaDao Frontend',
    status,
    timestamp: new Date().toISOString(),
    commit: process.env.COMMIT_SHA ?? '(unknown)',
    node: process.version,
    db: {
      url_set: dbUrlSet,
      connected: dbConnected,
      latency_ms: dbLatencyMs,
      ...(dbError ? { error: dbError } : {}),
    },
    gateway: {
      url: gatewayUrl || null,
      reachable: gatewayUrl ? gatewayOk : null,
      latency_ms: gatewayLatencyMs,
    },
    modules: {
      pg: pgLoadable,
    },
  };

  return NextResponse.json(body, { status: dbConnected ? 200 : 503 });
}
