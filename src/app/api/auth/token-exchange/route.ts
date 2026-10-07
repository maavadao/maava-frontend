/**
 * POST /api/auth/token-exchange
 *
 * Validates a short-lived transfer token (passed via URL when redirecting from
 * barrsa.com to {subdomain}.barrsa.com) and sets an httpOnly auth-token cookie
 * for the subdomain. This eliminates reliance on cross-domain cookie sharing.
 *
 * Flow:
 *   1. User logs in on barrsa.com → gets a 60-second transfer token
 *   2. Redirect: https://raj.barrsa.com?auth_token=TRANSFER_TOKEN&state=RANDOM
 *   3. Subdomain JS calls POST /api/auth/token-exchange { token: TRANSFER_TOKEN }
 *   4. This route validates the transfer token and sets the session cookie
 */
import { NextRequest, NextResponse } from 'next/server';
import { validateTransferToken, createJWT } from '@/lib/auth';
import pool from '@/lib/db';

export async function POST(request: NextRequest) {
  let body: { token?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const token = body.token;
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'Token required' }, { status: 400 });
  }

  // Validate the transfer token (must be purpose=subdomain-transfer, <60s old)
  const payload = await validateTransferToken(token);
  if (!payload || !payload.userId) {
    return NextResponse.json({ error: 'Invalid or expired transfer token' }, { status: 401 });
  }

  // Look up tenant from DB to ensure we have the latest subdomain/tenant info
  let subdomain = payload.subdomain;
  let tenantId = payload.tenantId;
  try {
    const res = await pool.query<{ id: string; subdomain: string; backend_url: string | null }>(
      'SELECT id, subdomain, backend_url FROM tenants WHERE user_id = $1 LIMIT 1',
      [payload.userId],
    );
    if (res.rows[0]) {
      tenantId = res.rows[0].id;
      subdomain = res.rows[0].subdomain;
    }
  } catch {
    // Non-fatal — use the claims from the transfer token
  }

  // Issue a full-duration session JWT
  const sessionToken = await createJWT({
    userId: payload.userId,
    email: payload.email,
    subdomain,
    tenantId,
  });

  const response = NextResponse.json({
    success: true,
    user: {
      userId: payload.userId,
      email: payload.email,
      subdomain,
      tenantId,
    },
  });

  response.cookies.set('auth-token', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    domain: process.env.NODE_ENV === 'production' ? '.barrsa.com' : undefined,
  });

  return response;
}
