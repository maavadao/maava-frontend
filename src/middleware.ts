import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { validateJWT } from '@/lib/auth';
import { MEMBER_SPACE_HOST, memberSpaceUrl } from '@/lib/constants';

// Routes that require authentication
const protectedRoutes = ['/settings', '/channels', '/onboarding'];

// Routes that should redirect if authenticated
const authRoutes = ['/auth/login', '/auth/agent/login', '/auth/agent/register'];

// Paths that stay on this site even for members who have a workspace
const mainSitePaths = ['/marketplace', '/auth', '/api', '/settings'];

// Cloud mode: when true, enables JWT auth and sends members to the member space
const CLOUD_MODE = process.env.NEXT_PUBLIC_CLOUD_MODE === 'true';

function firstForwardedValue(value: string | null): string {
  if (!value) return '';
  return value.split(',')[0].trim();
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

  if (CLOUD_MODE) {
    const token = request.cookies.get('auth-token')?.value;
    const user = token ? await validateJWT(token) : null;

    // Members with a workspace belong in their space, agent.mawadao.com/<username>.
    // The auth cookie is scoped to the parent domain, so the member space shares the session.
    const onMemberSpace = resolveExternalHost(request) === MEMBER_SPACE_HOST;
    if (user?.subdomain && !onMemberSpace && !mainSitePaths.some(p => pathname.startsWith(p))) {
      return NextResponse.redirect(new URL(memberSpaceUrl(user.subdomain)));
    }

    // Never keep authenticated users on login routes.
    if (user && authRoutes.some(route => pathname.startsWith(route))) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      url.search = '';
      return NextResponse.redirect(url);
    }

    // Signed in but no workspace yet → the home page's guided setup handles onboarding.
    if (user && !user.subdomain && !pathname.startsWith('/auth') && !pathname.startsWith('/api') && pathname !== '/') {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      url.searchParams.set('step', 'subdomain');
      return NextResponse.redirect(url);
    }

    if (!user && protectedRoutes.some(route => pathname.startsWith(route))) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/auth/login';
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
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
