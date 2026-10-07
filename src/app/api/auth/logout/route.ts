/**
 * POST /api/auth/logout
 *
 * Clears the auth-token cookie on the current domain and .mawadao.com.
 */
import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });

  // Clear cookie for the current domain
  response.cookies.set('auth-token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    domain: process.env.NODE_ENV === 'production' ? '.mawadao.com' : undefined,
  });

  return response;
}
