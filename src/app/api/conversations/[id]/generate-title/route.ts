import { NextRequest, NextResponse } from 'next/server';
import pool, { getUserId } from '@/lib/db';

const OPENCLAW_GATEWAY_URL =
  process.env.OPENCLAW_GATEWAY_URL ||
  process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_URL ||
  '';

/** POST /api/conversations/[id]/generate-title — AI-generate a short title */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch the first few messages for context
    const { rows: messages } = await pool.query(
      `SELECT role, content FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC
       LIMIT 4`,
      [params.id]
    );

    if (messages.length === 0) {
      return NextResponse.json({ error: 'No messages found' }, { status: 404 });
    }

    const context = messages.map((m: { role: string; content: string }) =>
      `${m.role}: ${m.content.slice(0, 200)}`
    ).join('\n');

    const base = OPENCLAW_GATEWAY_URL.replace(/\/+$/, '');
    const res = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({
        model: 'openclaw',
        messages: [
          {
            role: 'system',
            content: 'Generate a very short title (3-6 words, no quotes, no punctuation at the end) that summarizes this conversation. Respond with ONLY the title, nothing else.',
          },
          {
            role: 'user',
            content: context,
          },
        ],
        stream: false,
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to generate title' }, { status: 502 });
    }

    const data = await res.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    let title = data?.choices?.[0]?.message?.content?.trim() || '';

    // Clean up: remove quotes, limit length
    title = title.replace(/^["']|["']$/g, '').trim();
    if (title.length > 60) title = title.slice(0, 60);
    if (!title) {
      return NextResponse.json({ error: 'Empty title generated' }, { status: 500 });
    }

    // Update the conversation title
    await pool.query(
      `UPDATE conversations SET title = $1, updated_at = NOW() WHERE id = $2`,
      [title, params.id]
    );

    return NextResponse.json({ title });
  } catch (err) {
    console.error('Generate title error:', err);
    return NextResponse.json({ error: 'Failed to generate title' }, { status: 500 });
  }
}
