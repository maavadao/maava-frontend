import { NextRequest, NextResponse } from 'next/server';

const CONFIG_API = (process.env.BARRSA_API_URL || 'http://localhost:3003/api/v1').replace(/\/+$/, '');

/**
 * GET /api/users/admin/waitlist
 * Proxies to configuration-api GET /users/admin/waitlist
 * Requires X-Admin-Secret header.
 */
export async function GET(request: NextRequest) {
  const adminSecret = request.headers.get('x-admin-secret') ?? '';
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  const upstream = new URL(`${CONFIG_API}/users/admin/waitlist`);
  if (status) upstream.searchParams.set('status', status);

  try {
    const res = await fetch(upstream.toString(), {
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': adminSecret,
      },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error('[/api/users/admin/waitlist GET] Proxy error:', err);
    return NextResponse.json({ success: false, error: 'Service unavailable' }, { status: 503 });
  }
}
