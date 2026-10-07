/**
 * Generic API proxy — forwards authenticated requests to the user's Cloud Run backend.
 *
 * Path: /api/proxy/[...path]
 * Example: /api/proxy/v1/config/get → https://<user-backend>.run.app/api/v1/config/get
 *
 * Flow:
 *   1. Validate JWT (from cookie or Authorization header)
 *   2. Resolve backend URL via tenant-lookup (Redis cache → DB)
 *   3. Forward request with X-Tenant-ID, Authorization headers
 *   4. Stream response back to client
 */
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { resolveTenantBackend } from "@/lib/tenant-lookup";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const CLOUD_MODE = process.env.NEXT_PUBLIC_CLOUD_MODE === "true";

/** Allowlist of backend URL patterns to prevent SSRF */
const ALLOWED_BACKEND_PATTERNS = [
  /^https:\/\/[a-z0-9-]+\.run\.app\/?/,        // Cloud Run
  /^https:\/\/[a-z0-9-]+\.a\.run\.app\/?/,      // Cloud Run (alternative)
  /^http:\/\/localhost:\d+\/?/,                   // Local dev only
];

function isAllowedBackendUrl(url: string): boolean {
  return ALLOWED_BACKEND_PATTERNS.some((p) => p.test(url));
}

/** Paths that must not be proxied (internal-only endpoints) */
const BLOCKED_PATHS = [
  "/healthz", "/readyz", "/api/v1/health",
  "/data/import", "/data/export",  // Use dedicated endpoints instead
];

async function proxyRequest(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  // Cloud mode is required for proxy routing
  if (!CLOUD_MODE) {
    return NextResponse.json(
      { error: "Proxy routing is only available in cloud mode" },
      { status: 404 }
    );
  }

  // Authenticate
  const user = await authenticateRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!user.subdomain) {
    return NextResponse.json(
      { error: "No tenant provisioned. Complete onboarding first." },
      { status: 403 }
    );
  }

  // Rate limit: 120 requests per minute per user
  const rl = checkRateLimit(user.userId, RATE_LIMITS.proxy);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please slow down." },
      { status: 429 }
    );
  }

  // Resolve backend URL
  const tenant = await resolveTenantBackend(user.subdomain);
  if (!tenant || !tenant.backendUrl) {
    return NextResponse.json(
      { error: "Backend not available. Your instance may still be provisioning." },
      { status: 503 }
    );
  }

  // SSRF protection: verify backend URL is an allowed destination
  if (!isAllowedBackendUrl(tenant.backendUrl)) {
    console.error(`[proxy] Blocked SSRF attempt to ${tenant.backendUrl}`);
    return NextResponse.json(
      { error: "Backend URL is not allowed" },
      { status: 502 }
    );
  }

  // Build target URL
  const { path } = await params;
  const targetPath = `/api/${path.join("/")}`;

  // Block internal-only paths
  if (BLOCKED_PATHS.some((bp) => targetPath.startsWith(bp))) {
    return NextResponse.json(
      { error: "This endpoint is not accessible via proxy" },
      { status: 403 }
    );
  }

  const targetUrl = new URL(targetPath, tenant.backendUrl);

  // Forward query parameters
  const searchParams = request.nextUrl.searchParams.toString();
  if (searchParams) {
    targetUrl.search = searchParams;
  }

  // Forward request
  const headers = new Headers();
  headers.set("Content-Type", request.headers.get("content-type") || "application/json");
  headers.set("X-Tenant-ID", tenant.tenantId);
  headers.set("X-Forwarded-For", request.headers.get("x-forwarded-for") || request.ip || "");

  // Forward auth token
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    headers.set("Authorization", authHeader);
  } else {
    const token = request.cookies.get("auth-token")?.value;
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  try {
    const body =
      request.method !== "GET" && request.method !== "HEAD"
        ? await request.arrayBuffer()
        : undefined;

    const backendResponse = await fetch(targetUrl.toString(), {
      method: request.method,
      headers,
      body,
    });

    // Stream the response back
    const responseHeaders = new Headers();
    const contentType = backendResponse.headers.get("content-type");
    if (contentType) responseHeaders.set("Content-Type", contentType);
    responseHeaders.set("Cache-Control", "no-cache");

    // Stream if the backend is streaming
    if (
      backendResponse.body &&
      (contentType?.includes("text/event-stream") ||
        contentType?.includes("text/plain"))
    ) {
      return new NextResponse(backendResponse.body, {
        status: backendResponse.status,
        headers: responseHeaders,
      });
    }

    // Non-streaming: forward body as-is
    const responseBody = await backendResponse.arrayBuffer();
    return new NextResponse(responseBody, {
      status: backendResponse.status,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error("Proxy error:", err);
    return NextResponse.json(
      { error: "Backend unreachable. Please try again later." },
      { status: 502 }
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const DELETE = proxyRequest;
export const PATCH = proxyRequest;
