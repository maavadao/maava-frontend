/**
 * GET /api/auth/me-session
 *
 * Reads the httpOnly auth-token cookie and returns the user's
 * subdomain / tenantId. Used by client-side code that cannot read
 * the httpOnly cookie directly.
 */
import { NextRequest, NextResponse } from "next/server";
import { validateJWT } from "@/lib/auth";
import { debugLog } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("auth-token")?.value;
  debugLog(`[me-session] cookie present: ${!!token}`);
  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const payload = await validateJWT(token);
  debugLog(`[me-session] JWT valid: ${!!payload}, subdomain: ${payload?.subdomain ?? 'none'}`);
  if (!payload) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    userId: payload.userId,
    email: payload.email,
    subdomain: payload.subdomain,
    tenantId: payload.tenantId,
  });
}
