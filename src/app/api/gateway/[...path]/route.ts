import { NextRequest, NextResponse } from "next/server";

// Server-side only — never exposed to the browser bundle
const GATEWAY_CONFIG_API = (
  process.env.GATEWAY_CONFIG_API_URL || "http://localhost:19002/api/v1"
).replace(/\/+$/, "");

function fwdHeaders(req: NextRequest): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const auth = req.headers.get("authorization");
  const tenantId = req.headers.get("x-tenant-id");
  if (auth) headers["Authorization"] = auth;
  if (tenantId) headers["X-Tenant-ID"] = tenantId;
  return headers;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const targetPath = path.join("/");

  let body = "{}";
  try {
    body = await request.text();
  } catch {
    // empty body is fine
  }

  try {
    const res = await fetch(`${GATEWAY_CONFIG_API}/${targetPath}`, {
      method: "POST",
      headers: fwdHeaders(request),
      body,
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    // Config API not running — return structured 503 instead of ERR_CONNECTION_REFUSED
    return NextResponse.json(
      { success: false, message: "maava config API unreachable", error: "connection_refused" },
      { status: 503 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const targetPath = path.join("/");

  try {
    const res = await fetch(`${GATEWAY_CONFIG_API}/${targetPath}`, {
      method: "GET",
      headers: fwdHeaders(request),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { success: false, message: "maava config API unreachable", error: "connection_refused" },
      { status: 503 }
    );
  }
}
