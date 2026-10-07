import { NextRequest, NextResponse } from 'next/server';
import pool, { getUserId } from '@/lib/db';

/**
 * GET /api/agents/tasks — list user's agent tasks
 * POST /api/agents/tasks — create a new task for an agent
 */

export async function GET(request: NextRequest) {
  const userId = getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const status = request.nextUrl.searchParams.get('status');

  try {
    let query = `
      SELECT t.*, ma.name as agent_name, ma.slug as agent_slug, ma.category as agent_category
      FROM agent_tasks t
      JOIN marketplace_agents ma ON ma.id = t.agent_id
      WHERE t.user_id = $1
    `;
    const params: (string | null)[] = [userId];

    if (status) {
      query += ` AND t.status = $2`;
      params.push(status);
    }

    query += ` ORDER BY t.created_at DESC LIMIT 50`;

    const { rows } = await pool.query(query, params);
    return NextResponse.json({ tasks: rows });
  } catch (err) {
    console.error('List tasks error:', err);
    return NextResponse.json({ error: 'Failed to list tasks' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const userId = getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    agent_id: string;
    task_prompt: string;
    task_type?: string;
    conversation_id?: string;
    heartbeat_interval?: string;
    max_runtime_hours?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.agent_id || !body.task_prompt) {
    return NextResponse.json({ error: 'agent_id and task_prompt are required' }, { status: 400 });
  }

  try {
    const taskType = body.task_type || 'one-shot';
    const heartbeatInterval = taskType === 'recurring' ? (body.heartbeat_interval || '30m') : null;
    const maxHours = body.max_runtime_hours || 24;

    const { rows } = await pool.query(
      `INSERT INTO agent_tasks (
        user_id, agent_id, conversation_id, task_prompt, task_type,
        status, heartbeat_interval, max_runtime_hours
      ) VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7)
      RETURNING *`,
      [
        userId,
        body.agent_id,
        body.conversation_id || null,
        body.task_prompt,
        taskType,
        heartbeatInterval,
        maxHours,
      ]
    );

    return NextResponse.json({ task: rows[0] }, { status: 201 });
  } catch (err) {
    console.error('Create task error:', err);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
