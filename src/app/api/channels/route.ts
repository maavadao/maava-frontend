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

/** GET /api/channels — list saved channels for the authenticated user */
export async function GET(request: NextRequest) {
  try {
    const res = await fetch(`${API_BASE}/channels`, { headers: fwd(request) });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

/** POST /api/channels — save (upsert) a channel connection */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await fetch(`${API_BASE}/channels`, {
      method: "POST",
      headers: fwd(request),
      body: JSON.stringify(body),
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
          console.error("[api/channels POST] Unexpected sync error:", err);
          return false;
        });

        if (!gcsOk && data && typeof data === "object" && !Array.isArray(data)) {
          (data as Record<string, unknown>).gcsSyncWarning =
            "Channel saved to DB but GCS sync failed. Ensure STORAGE_URL and STORAGE_API_SECRET are set correctly in the mawadao-frontend service.";
        }
      }
    }

    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
