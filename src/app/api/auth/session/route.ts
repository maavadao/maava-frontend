/**
 * POST /api/auth/session
 *
 * Exchanges either an OIDC authorization code or a legacy auth-service JWT,
 * then re-issues a new JWT signed with the frontend's JWT_SECRET and sets it
 * as an httpOnly auth-token cookie.
 *
 * This bridges the gap between auth.mawadao.com and the frontend middleware
 * that reads the auth-token cookie.
 */
import { NextRequest, NextResponse } from "next/server";
import { createJWT, createTransferToken } from "@/lib/auth";
import pool from "@/lib/db";

// AUTH_SERVICE_URL is a server-only env var that can be changed at Cloud Run runtime
// without a rebuild. NEXT_PUBLIC_AUTH_URL is baked in at build time by Next.js.
const AUTH_URL = (
  process.env.AUTH_SERVICE_URL ||
  process.env.NEXT_PUBLIC_AUTH_URL ||
  "https://auth.mawadao.com"
).replace(/\/+$/, "");

function firstForwardedValue(value: string | null): string {
  if (!value) return "";
  return value.split(",")[0].trim();
}

function resolveFrontendBase(request: NextRequest): string {
  const xfProto = firstForwardedValue(request.headers.get("x-forwarded-proto"));
  const xfHost = firstForwardedValue(request.headers.get("x-forwarded-host"));
  const hostHeader = firstForwardedValue(request.headers.get("host"));
  const protocol = xfProto || request.nextUrl.protocol.replace(":", "") || "https";
  const host = xfHost || request.nextUrl.host || hostHeader || "localhost:3000";
  return `${protocol}://${host}`;
}

export async function POST(request: NextRequest) {
  let body: { token?: unknown; code?: unknown; state?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let token: string | null = null;
  const legacyToken = body.token;
  const authCode = body.code;
  const state = body.state;

  if (typeof legacyToken === "string" && legacyToken) {
    token = legacyToken;
  } else if (typeof authCode === "string" && authCode) {
    const expectedState = request.cookies.get("oidc_state")?.value || "";
    const codeVerifier = request.cookies.get("oidc_pkce_verifier")?.value || "";
    if (!state || typeof state !== "string" || state !== expectedState || !codeVerifier) {
      return NextResponse.json({ error: "Invalid OIDC state or verifier" }, { status: 401 });
    }

    const tokenRes = await fetch(`${AUTH_URL}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: authCode,
        client_id: process.env.OIDC_CLIENT_ID || "mawadao-web",
        redirect_uri: `${resolveFrontendBase(request)}/auth/callback`,
        code_verifier: codeVerifier,
      }),
    }).catch(() => null);

    if (!tokenRes) {
      return NextResponse.json({ error: "Auth service unavailable" }, { status: 503 });
    }
    if (!tokenRes.ok) {
      const message = await tokenRes.text().catch(() => "");
      return NextResponse.json({ error: message || "OIDC token exchange failed" }, { status: 401 });
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      return NextResponse.json({ error: "OIDC token exchange returned no access token" }, { status: 401 });
    }
    token = tokenData.access_token;
  } else {
    return NextResponse.json({ error: "Token or code required" }, { status: 400 });
  }

  // Validate the token via the Go auth service's /auth/me endpoint.
  // This avoids needing to share the Go service's JWT signing secret.
  let userId: string;
  let email: string;
  let subdomain: string | null;

  try {
    const meRes = await fetch(`${AUTH_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!meRes.ok) {
      const body = await meRes.text().catch(() => "");
      console.error(
        `[session] Auth service /auth/me returned ${meRes.status} from ${AUTH_URL}:`,
        body
      );
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const meData = (await meRes.json()) as {
      success?: boolean;
      data?: {
        id?: string;
        email?: string;
        subdomain?: string;
      };
    };

    if (!meData.success || !meData.data) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    userId = meData.data.id || "";
    email = meData.data.email || "";
    subdomain = meData.data.subdomain || null;
  } catch {
    return NextResponse.json(
      { error: "Auth service unavailable" },
      { status: 503 }
    );
  }

  if (!userId) {
    return NextResponse.json({ error: "Invalid user data" }, { status: 401 });
  }

  // Always check DB for existing tenant by user_id.
  // The Go auth service doesn't track subdomain, so we rely on the DB.
  let tenantId: string | null = null;
  let pendingSubdomain: string | null = null;
  try {
    const res = await pool.query<{ id: string; subdomain: string; backend_url: string | null }>(
      "SELECT id, subdomain, backend_url FROM tenants WHERE user_id = $1 LIMIT 1",
      [userId]
    );
    if (res.rows[0]) {
      tenantId = res.rows[0].id;
      subdomain = res.rows[0].subdomain;
      if (!res.rows[0].backend_url) {
        // Keep pending info for UX, but preserve assigned subdomain so
        // returning users are not repeatedly asked to choose one again.
        pendingSubdomain = res.rows[0].subdomain;
      }
    }
  } catch {
    // Non-fatal — tenantId will be null, which is handled gracefully
  }

  // Re-issue a JWT signed with the frontend's JWT_SECRET so the middleware
  // and all Next.js API routes can validate it independently.
  const newToken = await createJWT({ userId, email, subdomain, tenantId });

  // Generate a short-lived transfer token for cross-subdomain redirect.
  // The callback page uses this to redirect to {subdomain}.mawadao.com with
  // the token in the URL, avoiding cross-domain cookie issues.
  let transferToken: string | null = null;
  if (subdomain) {
    transferToken = await createTransferToken({ userId, email, subdomain, tenantId });
  }

  const response = NextResponse.json({
    success: true,
    token,
    user: { userId, email, subdomain, tenantId, pendingSubdomain },
    transferToken,
  });

  response.cookies.set("auth-token", newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 days
    domain:
      process.env.NODE_ENV === "production" ? ".mawadao.com" : undefined,
  });
  response.cookies.set("oidc_state", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set("oidc_pkce_verifier", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
