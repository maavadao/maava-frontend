/**
 * GET /api/auth/transfer-token
 *
 * Reads the httpOnly auth-token cookie, validates it, and returns
 * a short-lived transfer token suitable for cross-subdomain redirect.
 *
 * Used by the login page's useEffect when auto-redirecting an
 * already-authenticated user to their subdomain.
 */
import { NextRequest, NextResponse } from "next/server";
import { validateJWT, createTransferToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
    const token = request.cookies.get("auth-token")?.value;
    if (!token) {
        return NextResponse.json(
            { error: "Not authenticated" },
            { status: 401 }
        );
    }

    const payload = await validateJWT(token);
    if (!payload) {
        return NextResponse.json(
            { error: "Invalid token" },
            { status: 401 }
        );
    }

    if (!payload.subdomain) {
        return NextResponse.json(
            { error: "No subdomain assigned" },
            { status: 400 }
        );
    }

    const transferToken = await createTransferToken({
        userId: payload.userId,
        email: payload.email,
        subdomain: payload.subdomain,
        tenantId: payload.tenantId,
    });

    return NextResponse.json({
        transferToken,
        subdomain: payload.subdomain,
    });
}
