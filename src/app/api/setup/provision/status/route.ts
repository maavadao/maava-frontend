/**
 * GET /api/setup/provision/status — Poll tenant provisioning status.
 * Returns { status, tenant? } so the onboarding UI can track progress.
 */
import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await authenticateRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const row = await pool
    .query<{
      id: string;
      subdomain: string;
      backend_url: string | null;
      status: string | null;
    }>(
      "SELECT id, subdomain, backend_url, status FROM tenants WHERE user_id = $1 LIMIT 1",
      [user.userId]
    )
    .then((r) => r.rows[0] ?? null)
    .catch(() => null);

  if (!row) {
    return NextResponse.json({ status: "not_found" });
  }

  return NextResponse.json({
    status: row.status ?? "unknown",
    tenant:
      row.status === "active"
        ? { id: row.id, subdomain: row.subdomain, backendUrl: row.backend_url }
        : { id: row.id, subdomain: row.subdomain },
  });
}
