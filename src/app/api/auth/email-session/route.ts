/**
 * POST /api/auth/email-session
 *
 * Bridges email/password auth (Configuration API) to the frontend's
 * httpOnly auth-token cookie. Called after successful register/login
 * via the Configuration API, this endpoint:
 *   1. Validates the API key by calling Configuration API's /users/me
 *   2. Looks up the user's tenant in the DB (if any)
 *   3. Issues a JWT signed with the frontend's JWT_SECRET
 *   4. Sets it as the auth-token httpOnly cookie
 *
 * This mirrors /api/auth/session (which handles Google OAuth) but
 * verifies against the Configuration API instead of the Go auth service.
 */
import { NextRequest, NextResponse } from "next/server";
import { createJWT, createTransferToken } from "@/lib/auth";
import pool from "@/lib/db";
import { debugLog } from "@/lib/logger";

const CONFIG_API_URL = (
  process.env.MAAVADAO_API_URL ||
  process.env.NEXT_PUBLIC_CONFIG_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3003/api/v1"
).replace(/\/+$/, "");

export async function POST(request: NextRequest) {
  let body: { apiKey?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const apiKey = body.apiKey;
  if (!apiKey || typeof apiKey !== "string") {
    return NextResponse.json({ error: "API key required" }, { status: 400 });
  }

  // Validate the API key via the Configuration API's /users/me endpoint
  let userId: string;
  let email: string;
  let username: string | null = null;
  let displayName: string | null = null;
  let isVerified = false;
  let createdAt: string | null = null;

  try {
    debugLog(`[email-session] Validating API key via ${CONFIG_API_URL}/users/me`);
    const meRes = await fetch(`${CONFIG_API_URL}/users/me`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!meRes.ok) {
      console.error(`[email-session] /users/me returned ${meRes.status}`);
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    const meData = (await meRes.json()) as {
      success?: boolean;
      user?: {
        id?: string;
        email?: string;
        username?: string;
      };
    };

    if (!meData.success || !meData.user) {
      console.error("[email-session] /users/me response: success=false or no user data");
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    userId = meData.user.id || "";
    email = meData.user.email || "";
    username = meData.user.username || null;
    displayName = typeof (meData.user as { displayName?: unknown }).displayName === "string"
      ? ((meData.user as { displayName?: string }).displayName || null)
      : null;
    isVerified = Boolean((meData.user as { isVerified?: unknown }).isVerified);
    createdAt = typeof (meData.user as { createdAt?: unknown }).createdAt === "string"
      ? ((meData.user as { createdAt?: string }).createdAt || null)
      : null;
    debugLog(`[email-session] Validated user: id=${userId}, email=${email}`);
  } catch (err) {
    console.error("[email-session] Configuration API unavailable:", err);
    return NextResponse.json(
      { error: "Configuration API unavailable" },
      { status: 503 }
    );
  }

  if (!userId) {
    return NextResponse.json({ error: "Invalid user data" }, { status: 401 });
  }

  // Check DB for existing tenant
  let tenantId: string | null = null;
  let subdomain: string | null = null;
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
        pendingSubdomain = res.rows[0].subdomain;
      }
      debugLog(`[email-session] Found tenant: id=${tenantId}, subdomain=${subdomain}, backend_url=${res.rows[0].backend_url}`);
    } else {
      debugLog(`[email-session] No tenant found for user_id=${userId}`);
    }
  } catch (err) {
    console.error("[email-session] Tenant lookup failed:", err);
    // Non-fatal — tenantId/subdomain will be null
  }

  // Issue a JWT signed with the frontend's JWT_SECRET
  const token = await createJWT({ userId, email, subdomain, tenantId });

  // Generate a short-lived transfer token for cross-subdomain redirect
  let transferToken: string | null = null;
  if (subdomain) {
    transferToken = await createTransferToken({ userId, email, subdomain, tenantId });
  }

  const response = NextResponse.json({
    success: true,
    user: {
      userId,
      email,
      username,
      displayName,
      isVerified,
      createdAt,
      subdomain,
      tenantId,
      pendingSubdomain,
    },
    transferToken,
    token,
  });

  response.cookies.set("auth-token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 days
    domain:
      process.env.NODE_ENV === "production" ? ".maavadao.com" : undefined,
  });

  return response;
}
