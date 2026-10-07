import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { validateJWT, validateTransferToken, createJWT } from '@/lib/auth';

// Routes that require authentication
const protectedRoutes = ['/settings', '/channels', '/onboarding'];

// Routes that should redirect if authenticated
const authRoutes = ['/auth/login', '/auth/agent/login', '/auth/agent/register'];

// The root domain (without subdomain). Set via env or fallback to localhost.
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000';

// Cloud mode: when true, enables multi-tenant subdomain routing with JWT auth
const CLOUD_MODE = process.env.NEXT_PUBLIC_CLOUD_MODE === 'true';

function firstForwardedValue(value: string | null): string {
  if (!value) return '';
  return value.split(',')[0].trim();
}

function stripPort(host: string): string {
  return host.replace(/:\d+$/, '').trim();
}

function resolveExternalProtocol(request: NextRequest): string {
  const proto = firstForwardedValue(request.headers.get('x-forwarded-proto')) || request.nextUrl.protocol.replace(':', '') || 'https';
  const host = stripPort(resolveExternalHost(request)).toLowerCase();
  // Reverse proxies can show internal http while the public domain is https.
  if (host === 'mawadao.com' || host.endsWith('.mawadao.com')) {
    return 'https';
  }
  return proto;
}

function resolveExternalHost(request: NextRequest): string {
  const forwardedHost = firstForwardedValue(request.headers.get('x-forwarded-host'));
  if (forwardedHost) return forwardedHost;

  const urlHost = request.nextUrl.host?.trim();
  if (urlHost) return urlHost;

  return firstForwardedValue(request.headers.get('host'));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const externalHost = resolveExternalHost(request);
  const externalProto = resolveExternalProtocol(request);

  // --- Subdomain detection ---
  const currentHost = stripPort(externalHost);
  const rootBase = ROOT_DOMAIN.replace(/:\d+$/, '');

  const isSubdomain =
    currentHost !== rootBase &&
    currentHost !== 'localhost' &&
    currentHost !== 'www.' + rootBase &&
    currentHost.endsWith('.' + rootBase);

  const subdomain = isSubdomain
    ? currentHost.replace('.' + rootBase, '')
    : null;

  // --- Cloud mode: JWT-based auth + tenant routing ---
  if (CLOUD_MODE) {
    const token = request.cookies.get('auth-token')?.value;
    let user = token ? await validateJWT(token) : null;

    if (subdomain) {
      // Paths that belong on the main domain — redirect from subdomain to root
      const mainOnlyPaths = ['/marketplace'];
      if (mainOnlyPaths.some(p => pathname.startsWith(p))) {
        return NextResponse.redirect(
          new URL(`${externalProto}://${rootBase}${pathname}${request.nextUrl.search}`)
        );
      }

      // --- Transfer token exchange ---
      // When redirected from mawadao.com after login, the URL contains
      // ?auth_token=TRANSFER_TOKEN&state=RANDOM. Validate the transfer token,
      // set the auth-token cookie, and redirect to the clean URL.
      const authTokenParam = request.nextUrl.searchParams.get('auth_token');
      if (authTokenParam && !user) {
        const transferPayload = await validateTransferToken(authTokenParam);
        if (transferPayload && transferPayload.subdomain === subdomain) {
          // Valid transfer token for this subdomain — issue a session cookie
          const sessionToken = await createJWT({
            userId: transferPayload.userId,
            email: transferPayload.email,
            subdomain: transferPayload.subdomain,
            tenantId: transferPayload.tenantId,
          });

          // Redirect to clean URL (strip auth_token and state params).
          // Build from the host header so Cloud Run doesn't resolve to localhost:8080.
          const xProto = externalProto;
          const cleanParams = new URLSearchParams(request.nextUrl.search);
          cleanParams.delete('auth_token');
          cleanParams.delete('state');
          const qs = cleanParams.toString();
          const cleanHref = `${xProto}://${externalHost}${pathname}${qs ? '?' + qs : ''}`;
          const response = NextResponse.redirect(new URL(cleanHref));
          response.cookies.set('auth-token', sessionToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 7 * 24 * 60 * 60,
            domain: process.env.NODE_ENV === 'production' ? '.mawadao.com' : undefined,
          });
          return response;
        }
        // Invalid transfer token — fall through to normal auth check
      }

      // Subdomain request (e.g., alice.mawadao.com)
      if (!user) {
        // Not authenticated → redirect to main domain login
        const loginUrl = new URL('/auth/login', `${externalProto}://${rootBase}`);
        // Build redirect from the actual host header so it resolves to the
        // external subdomain URL, not the internal Cloud Run container URL.
        const externalUrl = `${externalProto}://${externalHost}${pathname}${request.nextUrl.search}`;
        loginUrl.searchParams.set('redirect', externalUrl);
        return NextResponse.redirect(loginUrl);
      }

      // Verify ownership: JWT subdomain must match URL subdomain
      if (user.subdomain !== subdomain) {
        const url = request.nextUrl.clone();
        url.pathname = '/unauthorized';
        return NextResponse.rewrite(url);
      }

      // Authorized: rewrite root to /chat/<subdomain> and set routing headers
      if (pathname === '/') {
        const url = request.nextUrl.clone();
        url.pathname = `/chat/${subdomain}`;
        const response = NextResponse.rewrite(url);
        response.headers.set('x-subdomain', subdomain);
        response.headers.set('x-tenant-id', user.tenantId || '');
        response.headers.set('x-user-id', user.userId);
        return response;
      }

      // Non-root subdomain paths: set routing headers
      const response = NextResponse.next();
      response.headers.set('x-subdomain', subdomain);
      response.headers.set('x-tenant-id', user.tenantId || '');
      response.headers.set('x-user-id', user.userId);
      response.headers.set('X-Frame-Options', 'DENY');
      response.headers.set('X-Content-Type-Options', 'nosniff');
      response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      response.headers.set('Permissions-Policy', 'camera=(), microphone=(self), geolocation=(), payment=()');
      response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
      return response;
    }

    // Paths that should always stay on the main domain (mawadao.com), even for
    // authenticated users who have a subdomain.
    const mainDomainPaths = ['/marketplace', '/auth', '/api', '/settings'];
    const isMainDomainPath = mainDomainPaths.some(p => pathname.startsWith(p));

    // Main domain (mawadao.com): if user already has subdomain, send them there
    // — unless they are accessing a main-domain-only path like /marketplace.
    if (user?.subdomain && !isMainDomainPath) {
      const targetHost = `${user.subdomain}.${rootBase}`;
      if (currentHost !== targetHost) {
        return NextResponse.redirect(new URL(`${externalProto}://${targetHost}`));
      }
    }

    // Never keep authenticated users on login routes.
    // (Users with subdomain are already redirected above.)
    if (user && authRoutes.some(route => pathname.startsWith(route))) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      url.search = '';
      return NextResponse.redirect(url);
    }

    // Main domain (mawadao.com) — check if authenticated user needs onboarding
    if (user && !user.subdomain && !pathname.startsWith('/auth') && !pathname.startsWith('/api') && pathname !== '/') {
      // User is logged in but has no tenant yet → redirect to main page
      // where the Guided Setup section handles onboarding inline.
      const url = request.nextUrl.clone();
      url.pathname = '/';
      url.searchParams.set('step', 'subdomain');
      return NextResponse.redirect(url);
    }

    // Protected routes on main domain require auth
    if (!user && protectedRoutes.some(route => pathname.startsWith(route))) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/auth/login';
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  } else {
    // --- Local mode (original behavior) ---
    if (isSubdomain && subdomain && pathname === '/') {
      const url = request.nextUrl.clone();
      url.pathname = `/chat/${subdomain}`;
      const response = NextResponse.rewrite(url);
      response.headers.set('x-subdomain', subdomain);
      return response;
    }
  }

  // --- Security headers ---
  const response = NextResponse.next();
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-DNS-Prefetch-Control', 'on');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(self), geolocation=(), payment=()');
  if (CLOUD_MODE) {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }

  return response;
}

export const config = {
  matcher: [
    // Match all paths except static files and api routes
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|api).*)',
  ],
};
