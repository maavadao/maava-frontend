import { NextRequest, NextResponse } from 'next/server';

const CONFIG_API = (process.env.BARRSA_API_URL || 'http://localhost:3003/api/v1').replace(/\/+$/, '');

/**
 * POST /api/users/admin/waitlist/[id]/approve
 * Proxies to configuration-api POST /users/admin/waitlist/:id/approve
 * Requires X-Admin-Secret header.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const adminSecret = request.headers.get('x-admin-secret') ?? '';

  try {
    const res = await fetch(`${CONFIG_API}/users/admin/waitlist/${id}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': adminSecret,
      },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error(`[/api/users/admin/waitlist/${id}/approve] Proxy error:`, err);
    return NextResponse.json({ success: false, error: 'Service unavailable' }, { status: 503 });
  }
}
