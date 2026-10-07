import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, extractJWTFromRequest } from "@/lib/auth";
import { syncChannelsToGcs } from "@/lib/sync-channels";

const API_BASE = process.env.MAWADAO_API_URL;

function fwd(req: NextRequest): Record<string, string> {
  const auth = req.headers.get("authorization");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) headers["Authorization"] = auth;
  return headers;
}

interface RouteContext {
  params: Promise<{ channelType: string }>;
}

/** DELETE /api/channels/[channelType] — hard-delete a channel connection */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { channelType } = await context.params;
    const res = await fetch(`${API_BASE}/channels/${encodeURIComponent(channelType)}`, {
      method: "DELETE",
      headers: fwd(request),
    });

    if (res.ok) {
      const user = await authenticateRequest(request);
      if (user) {
        await syncChannelsToGcs(user.userId, user.subdomain, extractJWTFromRequest(request)).catch(
          (err) => {
            console.error("[api/channels DELETE] Unexpected sync error:", err);
            return false;
          },
        );
      }
    }

    if (res.status === 204) {
      return new NextResponse(null, { status: 204 });
    }
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

/** PATCH /api/channels/[channelType] — disable (soft-disconnect) */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { channelType } = await context.params;
    const res = await fetch(`${API_BASE}/channels/${encodeURIComponent(channelType)}/disable`, {
      method: "PATCH",
      headers: fwd(request),
    });
    const data = await res.json();

    if (res.ok) {
      const user = await authenticateRequest(request);
      if (user) {
        const gcsOk = await syncChannelsToGcs(
          user.userId,
          user.subdomain,
          extractJWTFromRequest(request),
        ).catch((err) => {
          console.error("[api/channels PATCH] Unexpected sync error:", err);
          return false;
        });

        if (!gcsOk && data && typeof data === "object" && !Array.isArray(data)) {
          (data as Record<string, unknown>).gcsSyncWarning =
            "Channel state changed in DB but GCS sync failed. Ensure BUCKET_MANAGER_URL and BUCKET_MANAGER_API_SECRET are set correctly in the mawadao-frontend service.";
        }
      }
    }

    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
