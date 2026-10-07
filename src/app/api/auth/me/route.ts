import { NextRequest, NextResponse } from 'next/server';

// AUTH_SERVICE_URL is a server-only env var overridable at runtime without a rebuild.
// NEXT_PUBLIC_AUTH_URL is set to http://localhost:8080 in .env.local
const API_BASE = (
  process.env.AUTH_SERVICE_URL ||
  process.env.NEXT_PUBLIC_AUTH_URL ||
  'https://auth.mawadao.com'
).replace(/\/+$/, '');

/**
 * Proxy GET /api/auth/me → Go auth service GET /auth/me
 * Avoids cross-origin browser fetch to localhost:8080.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
