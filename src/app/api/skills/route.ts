import { NextRequest, NextResponse } from 'next/server';
import pool, { getUserId } from '@/lib/db';

const DEFAULT_PREINSTALLED_SKILLS = 50;

async function ensurePreinstalledSkills(userId: string): Promise<void> {
  if (!userId || userId === 'anonymous') return;

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM user_skills WHERE user_id = $1`,
    [userId],
  );
  const installedCount = countRows[0]?.cnt ?? 0;
  if (installedCount >= DEFAULT_PREINSTALLED_SKILLS) return;

  const toAdd = DEFAULT_PREINSTALLED_SKILLS - installedCount;
  if (toAdd <= 0) return;

  // Pick the most popular unique skills for a good default out-of-the-box experience.
  // Default skills are installed but toggled OFF — users can enable them manually.
  await pool.query(
    `INSERT INTO user_skills (user_id, skill_id, source, is_active)
     SELECT $1, ranked.skill_id, ranked.source, FALSE
     FROM (
       SELECT DISTINCT ON (s.skill_id)
         s.skill_id,
         s.source,
         s.installs
       FROM skills s
       ORDER BY s.skill_id, s.installs DESC, s.created_at DESC
     ) ranked
     WHERE NOT EXISTS (
       SELECT 1
       FROM user_skills us
       WHERE us.user_id = $1 AND us.skill_id = ranked.skill_id
     )
     ORDER BY ranked.installs DESC
     LIMIT $2
     ON CONFLICT (user_id, skill_id)
     DO NOTHING`,
    [userId, toAdd],
  );
}

/**
 * GET /api/skills?q=search&category=ai-ml&page=1&limit=24&sort=installs
 * Returns paginated skills with optional full-text search and category filter.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get('q')?.trim() || '';
  const category = searchParams.get('category')?.trim() || '';
  const installed = searchParams.get('installed');
  const includeTotal = searchParams.get('includeTotal') === 'true';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '24', 10)));
  const sort = searchParams.get('sort') || 'installs'; // installs | name | newest
  const offset = (page - 1) * limit;

  // When filtering by installed, scope to current user's user_skills
  const userId = getUserId(request) ?? request.headers.get('x-user-id') ?? 'anonymous';

  const conditions: string[] = [];
  const params: (string | number)[] = [];
  let paramIdx = 1;

  if (q) {
    conditions.push(`(s.name ILIKE $${paramIdx} OR s.skill_id ILIKE $${paramIdx} OR s.source ILIKE $${paramIdx})`);
    params.push(`%${q}%`);
    paramIdx++;
  }

  if (category && category !== 'all') {
    conditions.push(`s.category = $${paramIdx}`);
    params.push(category);
    paramIdx++;
  }

  // Always LEFT JOIN user_skills to compute is_installed for the current user
  const userIdParamIdx = paramIdx;
  params.push(userId);
  paramIdx++;

  const fromClause = installed === 'true'
    ? `FROM skills s
       INNER JOIN user_skills us
         ON us.user_id = $${userIdParamIdx}
        AND us.skill_id = s.skill_id
        AND us.source = s.source`
    : `FROM skills s
       LEFT JOIN user_skills us
         ON us.user_id = $${userIdParamIdx}
        AND us.skill_id = s.skill_id
        AND us.source = s.source`;

  // In the hub browse view, hide skills already installed by this user
  if (installed !== 'true' && userId !== 'anonymous') {
    conditions.push(`us.id IS NULL`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const orderBy =
    sort === 'name' ? 's.name ASC' : sort === 'newest' ? 's.created_at DESC' : 's.installs DESC';

  // For the installed view, always sort active-first then newest-installed-first
  const effectiveOrder = installed === 'true'
    ? 'us.is_active DESC, us.installed_at DESC'
    : orderBy;

  try {
    if (installed === 'true') {
      await ensurePreinstalledSkills(userId);
    }

    const selectCols = `s.id, s.skill_id, s.name, s.description, s.category, s.installs, s.source, s.source_url, COALESCE(us.is_active, FALSE) AS is_installed`;
    // description and source are already included above — used by dialog for display name parsing

    const dataRes = await pool.query(
      `SELECT ${selectCols}
       ${fromClause}
       ${where}
       ORDER BY ${effectiveOrder}
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    );

    let total: number;
    if (includeTotal) {
      const countRes = await pool.query(`SELECT COUNT(*)::int as total ${fromClause} ${where}`, params);
      total = countRes.rows[0]?.total ?? 0;
    } else {
      // Fast path for interactive UIs (skills dialog, filters): avoid COUNT(*) on large tables.
      total = offset + dataRes.rows.length + (dataRes.rows.length === limit ? 1 : 0);
    }

    return NextResponse.json({
      data: dataRes.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: dataRes.rows.length === limit,
      },
    });
  } catch (err) {
    // Gracefully handle missing user_skills table (migration pending)
    console.error('Skills query error:', err);
    // Return empty list on any DB failure so the page renders instead of crashing
    return NextResponse.json({
      data: [],
      pagination: { page, limit, total: 0, totalPages: 0, hasMore: false },
    });
  }
}
