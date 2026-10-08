import { NextRequest, NextResponse } from 'next/server';

const CONFIG_API = (process.env.MAWADAO_API_URL || 'http://localhost:3003/api/v1').replace(/\/+$/, '');

/**
 * GET /api/users/waitlist/status?email=...
 * Proxies to mawa-api GET /users/waitlist/status
 * Used by the auth callback to gate OAuth logins through the waitlist.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');

  if (!email) {
    return NextResponse.json({ success: false, error: 'email is required' }, { status: 400 });
  }

  try {
    const upstream = new URL(`${CONFIG_API}/users/waitlist/status`);
    upstream.searchParams.set('email', email);

    const res = await fetch(upstream.toString(), {
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error('[/api/users/waitlist/status GET] Proxy error:', err);
    return NextResponse.json({ success: false, error: 'Service unavailable' }, { status: 503 });
  }
}
