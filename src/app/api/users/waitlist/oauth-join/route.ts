import { NextRequest, NextResponse } from 'next/server';

const CONFIG_API = (process.env.MAWADAO_API_URL || 'http://localhost:3003/api/v1').replace(/\/+$/, '');

/**
 * POST /api/users/waitlist/oauth-join
 * Proxies to configuration-api POST /users/waitlist/oauth-join
 * Auto-enrolls a Google/OAuth user onto the waitlist.
 * Body: { email: string, displayName?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await fetch(`${CONFIG_API}/users/waitlist/oauth-join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error('[/api/users/waitlist/oauth-join POST] Proxy error:', err);
    return NextResponse.json({ success: false, error: 'Service unavailable' }, { status: 503 });
  }
}
