import { NextRequest, NextResponse } from 'next/server';
import pool, { getUserId } from '@/lib/db';

/** GET /api/conversations — list all conversations for a user */
export async function GET(request: NextRequest) {
  const userId = getUserId(request) ?? request.headers.get('x-user-id') ?? 'anonymous';
  try {
    const { rows } = await pool.query(
      `WITH selected AS (
         SELECT c.id, c.title, c.created_at, c.updated_at
         FROM conversations c
         WHERE c.user_id = $1 AND c.deleted_at IS NULL
         ORDER BY c.updated_at DESC
         LIMIT 100
       )
       SELECT s.id, s.title, s.created_at, s.updated_at, COALESCE(m.cnt, 0)::int AS message_count
       FROM selected s
       LEFT JOIN (
         SELECT m.conversation_id, COUNT(*)::int AS cnt
         FROM messages m
         WHERE m.deleted_at IS NULL
           AND m.conversation_id IN (SELECT id FROM selected)
         GROUP BY m.conversation_id
       ) m ON m.conversation_id = s.id
       ORDER BY s.updated_at DESC`,
      [userId]
    );
    return NextResponse.json({ conversations: rows });
  } catch {
    // Fallback: deleted_at column may not exist yet (migration pending)
    try {
      const { rows } = await pool.query(
        `WITH selected AS (
           SELECT c.id, c.title, c.created_at, c.updated_at
           FROM conversations c
           WHERE c.user_id = $1
           ORDER BY c.updated_at DESC
           LIMIT 100
         )
         SELECT s.id, s.title, s.created_at, s.updated_at, COALESCE(m.cnt, 0)::int AS message_count
         FROM selected s
         LEFT JOIN (
           SELECT m.conversation_id, COUNT(*)::int AS cnt
           FROM messages m
           WHERE m.conversation_id IN (SELECT id FROM selected)
           GROUP BY m.conversation_id
         ) m ON m.conversation_id = s.id
         ORDER BY s.updated_at DESC`,
        [userId]
      );
      return NextResponse.json({ conversations: rows });
    } catch (err2) {
      console.error('List conversations error:', err2);
      // Return empty list so the chat page renders instead of crashing
      return NextResponse.json({ conversations: [] });
    }
  }
}

/** POST /api/conversations — create a new conversation */
export async function POST(request: NextRequest) {
  const userId = getUserId(request) ?? request.headers.get('x-user-id') ?? 'anonymous';
  try {
    const body = await request.json() as { title?: string };
    const title = body.title || 'New Chat';
    const { rows } = await pool.query(
      `INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING id, title, created_at, updated_at`,
      [userId, title]
    );
    return NextResponse.json({ conversation: rows[0] }, { status: 201 });
  } catch (err) {
    console.error('Create conversation error:', err);
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
  }
}
