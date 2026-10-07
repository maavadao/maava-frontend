import { randomBytes, createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

function toHostOnly(host: string): string {
  return host.split(',')[0].trim().split(':')[0].trim();
}

function firstForwardedValue(value: string | null): string {
  if (!value) return '';
  return value.split(',')[0].trim();
}

function resolveAuthBase(request: NextRequest): string {
  const xfProto = firstForwardedValue(request.headers.get('x-forwarded-proto'));
  const xfHost = firstForwardedValue(request.headers.get('x-forwarded-host'));
  const hostHeader = firstForwardedValue(request.headers.get('host'));
  const urlHost = request.nextUrl.hostname?.trim();

  const protocol = xfProto || request.nextUrl.protocol.replace(':', '') || 'https';
  const host = toHostOnly(xfHost || urlHost || hostHeader || 'localhost');

  if (host === 'localhost' || host === '127.0.0.1') {
    return 'http://localhost:8080';
  }

  if (host.startsWith('auth.')) {
    return `${protocol}://${host}`;
  }

  return `${protocol}://auth.${host}`;
}

function resolveAppBase(request: NextRequest): string {
  const xfProto = firstForwardedValue(request.headers.get('x-forwarded-proto'));
  const xfHost = firstForwardedValue(request.headers.get('x-forwarded-host'));
  const hostHeader = firstForwardedValue(request.headers.get('host'));
  const protocol = xfProto || request.nextUrl.protocol.replace(':', '') || 'https';
  const host = xfHost || request.nextUrl.host || hostHeader || 'localhost:3000';
  return `${protocol}://${host}`;
}

function base64Url(input: Buffer): string {
  return input.toString('base64url');
}

/**
 * Runtime redirect entrypoint for Google login via OIDC authorization code + PKCE.
 */
export async function GET(request: NextRequest) {
  const authBase = resolveAuthBase(request).replace(/\/+$/, '');
  const appBase = resolveAppBase(request).replace(/\/+$/, '');
  const state = base64Url(randomBytes(24));
  const verifier = base64Url(randomBytes(32));
  const challenge = base64Url(createHash('sha256').update(verifier).digest());
  const authorizeUrl = new URL(`${authBase}/oauth2/authorize`);
  authorizeUrl.searchParams.set('provider', 'google');
  authorizeUrl.searchParams.set('client_id', process.env.OIDC_CLIENT_ID || 'barrsa-web');
  authorizeUrl.searchParams.set('redirect_uri', `${appBase}/auth/callback`);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', 'openid email profile');
  authorizeUrl.searchParams.set('code_challenge', challenge);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');
  authorizeUrl.searchParams.set('state', state);

  const response = NextResponse.redirect(authorizeUrl.toString());
  response.cookies.set('oidc_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60,
  });
  response.cookies.set('oidc_pkce_verifier', verifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60,
  });
  return response;
}
