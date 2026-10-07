import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

/** GET /api/conversations/[id]/messages — load all messages for a conversation */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { rows } = await pool.query(
      `SELECT id, role, content, created_at FROM messages
       WHERE conversation_id = $1 AND deleted_at IS NULL
       ORDER BY created_at ASC`,
      [params.id]
    );
    let isStreaming = false;
    try {
      const streamRes = await pool.query(
        `SELECT is_streaming FROM conversations WHERE id = $1`,
        [params.id]
      );
      isStreaming = streamRes.rows[0]?.is_streaming === true;
    } catch { /* is_streaming column may not exist yet */ }
    return NextResponse.json({ messages: rows, isStreaming });
  } catch {
    // Fallback: deleted_at column may not exist yet (migration pending)
    try {
      const { rows } = await pool.query(
        `SELECT id, role, content, created_at FROM messages
         WHERE conversation_id = $1
         ORDER BY created_at ASC`,
        [params.id]
      );
      let isStreaming = false;
      try {
        const streamRes = await pool.query(
          `SELECT is_streaming FROM conversations WHERE id = $1`,
          [params.id]
        );
        isStreaming = streamRes.rows[0]?.is_streaming === true;
      } catch { /* is_streaming column may not exist yet */ }
      return NextResponse.json({ messages: rows, isStreaming });
    } catch (err2) {
      console.error('Get messages error:', err2);
      return NextResponse.json({ error: 'Failed to get messages' }, { status: 500 });
    }
  }
}

/** POST /api/conversations/[id]/messages — save a message */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json() as { role: string; content: string };
    if (!body.role || !body.content) {
      return NextResponse.json({ error: 'role and content are required' }, { status: 400 });
    }
    const { rows } = await pool.query(
      `INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3) RETURNING id, role, content, created_at`,
      [params.id, body.role, body.content]
    );
    // Also bump the conversation's updated_at
    await pool.query(`UPDATE conversations SET updated_at = NOW() WHERE id = $1`, [params.id]);
    return NextResponse.json({ message: rows[0] }, { status: 201 });
  } catch (err) {
    console.error('Save message error:', err);
    return NextResponse.json({ error: 'Failed to save message' }, { status: 500 });
  }
}
