import { NextRequest, NextResponse } from 'next/server';
import pool, { getUserId, isDbConnectionError } from '@/lib/db';
import { debugLog } from '@/lib/logger';
import { createJWT } from '@/lib/auth';

// ── Tenant platform provisioning ─────────────────────────────────────────────

const BUCKET_MANAGER_URL = process.env.BUCKET_MANAGER_URL || '';
const BUCKET_MANAGER_API_SECRET = process.env.BUCKET_MANAGER_API_SECRET || '';
const GCS_BUCKET =
  process.env.GCS_SHARED_BUCKET || process.env.GCS_BUCKET || 'barrsa-prod-tentant-platform-data';

/** Strips trailing /api/v1 (some backend_url values include it) */
function stripApiV1(url: string): string {
  return url.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');
}

type MarketplaceAgentFull = {
  name: string;
  slug: string;
  soul_config: Record<string, unknown> | null;
  heartbeat_config: Record<string, unknown> | null;
  skills_config: Array<{ slug?: string; name?: string; content?: string }> | null;
  system_prompt: string | null;
  description: string | null;
  category: string | null;
  developer: string | null;
};

function buildSoulMd(a: MarketplaceAgentFull): string {
  if (typeof a.soul_config?.content === 'string' && a.soul_config.content.trim()) {
    return a.soul_config.content;
  }
  const core = a.system_prompt || a.description || '';
  const lines = [
    `# SOUL.md — ${a.name}`,
    '',
    '## Who You Are',
    `You are **${a.name}**, an AI agent specialized in ${a.category || 'general'} tasks.`,
  ];
  if (core) lines.push('', '## Core Instructions', core);
  lines.push(
    '', '## Core Values',
    '- Be helpful, accurate, and concise',
    '- Stay focused on your area of expertise',
    '- Communicate clearly and professionally',
  );
  return lines.join('\n');
}

function buildIdentityMd(a: MarketplaceAgentFull): string {
  const lines = ['# IDENTITY.md', '', '## Core', `- Name: ${a.name}`];
  if (a.category) lines.push(`- Category: ${a.category}`);
  if (a.developer) lines.push(`- Developer: ${a.developer}`);
  lines.push('', '## Purpose', a.description || a.name);
  lines.push('', '## Communication Style', '- Professional and helpful', '- Clear and concise');
  return lines.join('\n');
}

function buildHeartbeatMd(a: MarketplaceAgentFull): string {
  if (typeof a.heartbeat_config?.content === 'string' && a.heartbeat_config.content.trim()) {
    return a.heartbeat_config.content;
  }
  return [
    `# HEARTBEAT.md — ${a.name}`, '',
    '## Status',
    `Agent **${a.name}** is active and ready to receive tasks.`,
    '', '## Standard Operating Procedure',
    '1. Read the incoming request carefully',
    '2. Apply your core instructions from SOUL.md',
    '3. Respond clearly and helpfully',
  ].join('\n');
}

function buildAgentsMd(a: MarketplaceAgentFull): string {
  return [
    `# AGENTS.md — ${a.name}`, '', '## About This Agent',
    a.description || a.name,
    '', '## Capabilities',
    `This agent specializes in ${a.category || 'general'} tasks.`,
    '', '## Notes',
    '- Installed from the Barrsa marketplace',
    `- Developer: ${a.developer || 'Unknown'}`,
  ].join('\n');
}

function buildMemoryMd(): string {
  return '# MEMORY.md\n\n_(Initialized — context will build over time.)_';
}

/**
 * Writes SOUL.md, IDENTITY.md, HEARTBEAT.md, AGENTS.md, MEMORY.md to the
 * tenant-platform local workspace and mirrors each file to GCS.
 */
async function seedAgentWorkspaceFiles(
  base: string,
  headers: Record<string, string>,
  userId: string,
  agent: MarketplaceAgentFull,
): Promise<void> {
  debugLog('[seed] START — agent:', agent.slug, 'base:', base, 'userId:', userId);
  debugLog('[seed] ENV check — BUCKET_MANAGER_URL:', BUCKET_MANAGER_URL || '(empty)',
    'BUCKET_MANAGER_API_SECRET:', BUCKET_MANAGER_API_SECRET ? '(set)' : '(empty)',
    'GCS_BUCKET:', GCS_BUCKET);

  const workspaceFiles = [
    { name: 'SOUL.md',      content: buildSoulMd(agent) },
    { name: 'IDENTITY.md',  content: buildIdentityMd(agent) },
    { name: 'HEARTBEAT.md', content: buildHeartbeatMd(agent) },
    { name: 'AGENTS.md',    content: buildAgentsMd(agent) },
    { name: 'MEMORY.md',    content: buildMemoryMd() },
  ];

  const gcsHeaders: Record<string, string> = { 'Content-Type': 'text/plain; charset=utf-8' };
  if (BUCKET_MANAGER_API_SECRET) gcsHeaders['X-Bucket-Manager-Secret'] = BUCKET_MANAGER_API_SECRET;

  for (const file of workspaceFiles) {
    // Write to tenant-platform local disk (GCSFuse auto-syncs to GCS)
    const fileSetUrl = `${base}/api/v1/agents/files/set`;
    debugLog('[seed] files.set request:', fileSetUrl, '{ agentId:', agent.slug, ', name:', file.name, ', contentLen:', file.content.length, '}');
    try {
      const resp = await fetch(fileSetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ agentId: agent.slug, name: file.name, content: file.content }),
        signal: AbortSignal.timeout(10_000),
      });
      const body = await resp.text().catch(() => '');
      debugLog('[seed] files.set', file.name, '→', resp.status, body.slice(0, 300));
    } catch (err: unknown) {
      debugLog('[seed] files.set', file.name, 'THREW:', (err as Error)?.message);
    }

    // Mirror to GCS via bucket-manager (fallback if GCSFuse is not mounted)
    if (BUCKET_MANAGER_URL) {
      const gcsPath = `${userId}/mountfolder/workspace-${agent.slug}/${file.name}`;
      const gcsUrl = `${BUCKET_MANAGER_URL}/api/v1/buckets/${encodeURIComponent(GCS_BUCKET)}/files/${gcsPath}`;
      debugLog('[seed] GCS PUT:', gcsUrl);
      try {
        const gcsResp = await fetch(gcsUrl, {
          method: 'PUT', headers: gcsHeaders, body: file.content, signal: AbortSignal.timeout(15_000),
        });
        const gcsBody = await gcsResp.text().catch(() => '');
        debugLog('[seed] GCS', file.name, '→', gcsResp.status, gcsBody.slice(0, 300));
      } catch (err: unknown) {
        debugLog('[seed] GCS', file.name, 'THREW:', (err as Error)?.message);
      }
    } else {
      debugLog('[seed] GCS skip — BUCKET_MANAGER_URL is empty');
    }
  }

  // Seed any skills from skills_config
  const skills = Array.isArray(agent.skills_config) ? agent.skills_config : [];
  debugLog('[seed] skills to seed:', skills.length);
  for (const skill of skills) {
    if (!skill.slug || !skill.content) {
      debugLog('[seed] skip skill — missing slug or content:', JSON.stringify(skill)?.slice(0, 200));
      continue;
    }
    if (BUCKET_MANAGER_URL) {
      const gcsPath = `${userId}/mountfolder/skills/${skill.slug}/SKILL.md`;
      const gcsUrl = `${BUCKET_MANAGER_URL}/api/v1/buckets/${encodeURIComponent(GCS_BUCKET)}/files/${gcsPath}`;
      debugLog('[seed] GCS skill PUT:', gcsUrl);
      try {
        const resp = await fetch(gcsUrl, {
          method: 'PUT', headers: gcsHeaders, body: skill.content, signal: AbortSignal.timeout(15_000),
        });
        const body = await resp.text().catch(() => '');
        debugLog('[seed] GCS skill', skill.slug, '→', resp.status, body.slice(0, 300));
      } catch (err: unknown) {
        debugLog('[seed] GCS skill', skill.slug, 'THREW:', (err as Error)?.message);
      }
    }
  }

  debugLog('[seed] DONE — all files processed for', agent.slug);
}

/**
 * After a DB install, creates the agent in the user's live tenant gateway
 * and seeds all workspace files from the marketplace agent's DB config.
 * Non-fatal — errors are logged but never surface to the caller.
 */
async function provisionAgentInTenantPlatform(
  userId: string,
  marketplaceAgentId: string,
): Promise<void> {
  debugLog('[provision] START — userId:', userId, 'agentId:', marketplaceAgentId);

  // 1. Fetch full marketplace agent data
  const { rows: [agent] } = await pool.query<MarketplaceAgentFull>(
    `SELECT name, slug, soul_config, heartbeat_config, skills_config,
            system_prompt, description, category, developer
       FROM marketplace_agents WHERE id = $1`,
    [marketplaceAgentId],
  );
  if (!agent) {
    debugLog('[provision] ABORT — marketplace agent not found:', marketplaceAgentId);
    return;
  }
  debugLog('[provision] 1/6 agent data:', agent.slug, agent.name,
    'soul_config:', JSON.stringify(agent.soul_config)?.slice(0, 200),
    'heartbeat_config:', JSON.stringify(agent.heartbeat_config)?.slice(0, 200),
    'skills_config:', JSON.stringify(agent.skills_config)?.slice(0, 200));

  // 2. Fetch tenant gateway URL + user email in one join
  const { rows: [tenant] } = await pool.query<{
    backend_url: string | null;
    subdomain: string;
    email: string;
  }>(
    `SELECT t.backend_url, t.subdomain, u.email
       FROM tenants t
       JOIN users u ON u.id = t.user_id
      WHERE t.user_id = $1 AND t.status = 'active'`,
    [userId],
  );
  if (!tenant?.backend_url) {
    debugLog('[provision] ABORT — no active tenant for user:', userId, 'tenant row:', JSON.stringify(tenant));
    return;
  }
  debugLog('[provision] 2/6 tenant:', tenant.subdomain, 'backend_url:', tenant.backend_url);

  // 3. Short-lived service JWT (60 s) accepted by cloud-auth middleware
  const jwt = await createJWT(
    { userId, email: tenant.email, subdomain: tenant.subdomain, tenantId: tenant.subdomain },
    '60s',
  );
  debugLog('[provision] 3/6 JWT created, length:', jwt.length);

  const base = stripApiV1(tenant.backend_url);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwt}`,
    'X-Tenant-ID': tenant.subdomain,
  };

  // 4. Create the agent (slug is already normalized → stable agent ID)
  debugLog('[provision] 4/6 calling agents.create:', `${base}/api/v1/agents/create`, '{ name:', agent.slug, '}');
  const createResp = await fetch(`${base}/api/v1/agents/create`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: agent.slug, workspace: `/home/node/.openclaw/workspace-${agent.slug}` }),
    signal: AbortSignal.timeout(10_000),
  });
  const createBody = await createResp.text().catch(() => '');
  debugLog('[provision] 4/6 agents.create response:', createResp.status, createBody);
  // Allow 409/conflict if agent already exists — still continue to seed files
  if (!createResp.ok && createResp.status !== 409) {
    debugLog('[provision] ABORT — agents.create failed:', createResp.status, createBody);
    return;
  }

  // 5. Set the human-readable display name
  debugLog('[provision] 5/6 calling agents.update:', agent.slug, '→', agent.name);
  const updateResp = await fetch(`${base}/api/v1/agents/update`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ agentId: agent.slug, name: agent.name }),
    signal: AbortSignal.timeout(10_000),
  }).catch((err) => { debugLog('[provision] 5/6 agents.update error:', err?.message); return null; });
  if (updateResp) {
    const updateBody = await updateResp.text().catch(() => '');
    debugLog('[provision] 5/6 agents.update response:', updateResp.status, updateBody);
  }

  // 6. Seed workspace files (SOUL.md, IDENTITY.md, HEARTBEAT.md, AGENTS.md, MEMORY.md + skills)
  debugLog('[provision] 6/6 seeding workspace files…');
  await seedAgentWorkspaceFiles(base, headers, userId, agent);

  debugLog('[provision] DONE — agent fully provisioned:', agent.slug, 'for user', userId);
}

/**
 * Removes the agent from the user's live tenant gateway on uninstall.
 * Non-fatal.
 */
async function deprovisionAgentFromTenantPlatform(
  userId: string,
  marketplaceAgentId: string,
): Promise<void> {
  const { rows: [agent] } = await pool.query<{ slug: string }>(
    `SELECT slug FROM marketplace_agents WHERE id = $1`,
    [marketplaceAgentId],
  );
  if (!agent) return;

  const { rows: [tenant] } = await pool.query<{
    backend_url: string | null;
    subdomain: string;
    email: string;
  }>(
    `SELECT t.backend_url, t.subdomain, u.email
       FROM tenants t
       JOIN users u ON u.id = t.user_id
      WHERE t.user_id = $1 AND t.status = 'active'`,
    [userId],
  );
  if (!tenant?.backend_url) return;

  const jwt = await createJWT(
    { userId, email: tenant.email, subdomain: tenant.subdomain, tenantId: tenant.subdomain },
    '60s',
  );

  const base = stripApiV1(tenant.backend_url);
  await fetch(`${base}/api/v1/agents/delete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwt}`,
      'X-Tenant-ID': tenant.subdomain,
    },
    // deleteFiles: false → keeps workspace files, just removes agent from config
    body: JSON.stringify({ agentId: agent.slug, deleteFiles: false }),
    signal: AbortSignal.timeout(10_000),
  }).catch((err) => debugLog('[deprovision] agents.delete warning:', err?.message));

  debugLog('[deprovision] agent removed from tenant platform:', agent.slug, 'for user', userId);
}

/**
 * GET /api/agents/installed — list user's installed agents
 * POST /api/agents/installed — install an agent (body: { agent_id })
 * DELETE /api/agents/installed — uninstall an agent (body: { agent_id })
 */

export async function GET(request: NextRequest) {
  const userId = getUserId(request);
  debugLog('[GET /api/agents/installed] userId:', userId ?? '(none — 401)');
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { rows } = await pool.query(
      `SELECT
        uia.id as install_id,
        uia.agent_id,
        uia.is_active,
        uia.installed_at,
        uia.last_used_at,
        uia.config_overrides,
        ma.id,
        ma.slug,
        ma.name,
        ma.short_description,
        ma.description,
        ma.category,
        ma.developer,
        ma.icon_url,
        ma.verified,
        ma.system_prompt,
        ma.soul_config,
        ma.skills_config,
        ma.heartbeat_config,
        ma.channels_config,
        ma.model,
        ma.max_runtime_hours
      FROM user_installed_agents uia
      JOIN marketplace_agents ma ON ma.id = uia.agent_id
      WHERE uia.user_id = $1 AND uia.is_active = true
      ORDER BY uia.last_used_at DESC NULLS LAST, uia.installed_at DESC`,
      [userId]
    );

    debugLog('[GET /api/agents/installed] Found', rows.length, 'agents for user', userId);
    return NextResponse.json({ agents: rows });
  } catch (err) {
    console.error('[GET /api/agents/installed] DB error:', err);
    // Return empty list on connection errors so the page renders instead of crashing
    if (isDbConnectionError(err)) {
      return NextResponse.json({ agents: [] });
    }
    return NextResponse.json({ agents: [] });
  }
}

export async function POST(request: NextRequest) {
  const userId = getUserId(request);
  debugLog('[POST /api/agents/installed] userId:', userId ?? '(none — 401)');
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { agent_id: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.agent_id) {
    return NextResponse.json({ error: 'agent_id is required' }, { status: 400 });
  }

  try {
    // Verify agent exists
    const { rows: agentRows } = await pool.query(
      `SELECT id FROM marketplace_agents WHERE id = $1`,
      [body.agent_id]
    );
    if (agentRows.length === 0) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Install (upsert)
    await pool.query(
      `INSERT INTO user_installed_agents (user_id, agent_id, is_active)
       VALUES ($1, $2, true)
       ON CONFLICT (user_id, agent_id) DO UPDATE SET is_active = true, installed_at = now()`,
      [userId, body.agent_id]
    );

    // Increment install count
    await pool.query(
      `UPDATE marketplace_agents SET total_installs = total_installs + 1 WHERE id = $1`,
      [body.agent_id]
    );

    debugLog('[POST /api/agents/installed] Installed agent', body.agent_id, 'for user', userId);

    // Provision the agent in the user's live tenant gateway (awaited so serverless doesn't kill process)
    try {
      await provisionAgentInTenantPlatform(userId, body.agent_id);
    } catch (err: unknown) {
      console.warn('[POST /api/agents/installed] tenant provision warning:', (err as Error)?.message ?? err);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[POST /api/agents/installed] DB error:', err);
    return NextResponse.json({ error: 'Failed to install agent' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const userId = getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { agent_id: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.agent_id) {
    return NextResponse.json({ error: 'agent_id is required' }, { status: 400 });
  }

  try {
    await pool.query(
      `UPDATE user_installed_agents SET is_active = false WHERE user_id = $1 AND agent_id = $2`,
      [userId, body.agent_id]
    );

    // Remove the agent from the user's live tenant gateway (awaited so serverless doesn't kill process)
    try {
      await deprovisionAgentFromTenantPlatform(userId, body.agent_id);
    } catch (err: unknown) {
      console.warn('[DELETE /api/agents/installed] tenant deprovision warning:', (err as Error)?.message ?? err);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Uninstall agent error:', err);
    return NextResponse.json({ error: 'Failed to uninstall agent' }, { status: 500 });
  }
}
