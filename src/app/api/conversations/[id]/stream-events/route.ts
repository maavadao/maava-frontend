import { NextRequest } from "next/server";
import pool from "@/lib/db";

/**
 * GET /api/conversations/[id]/stream-events
 *
 * Server-Sent Events endpoint for stream recovery.
 * Replaces the 1.5 s polling loop in maavadao-frontend.
 *
 * Feature flag: NEXT_PUBLIC_REALTIME_STREAM_STATUS=sse
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const POLL_INTERVAL_MS = 2_000;
const HEARTBEAT_INTERVAL_MS = 15_000;
const STALE_STREAM_MS = 10 * 60 * 1000;
const MAX_LIFETIME_MS = 5 * 60 * 1000;

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const convId = params.id;

  // Verify conversation exists
  const { rows: convRows } = await pool.query(
    `SELECT id FROM conversations WHERE id = $1 AND deleted_at IS NULL`,
    [convId],
  );
  if (convRows.length === 0) {
    return new Response("Not found", { status: 404 });
  }

  const encoder = new TextEncoder();
  const startTime = Date.now();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      function send(event: string, data: Record<string, unknown>) {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      function heartbeat() {
        if (closed) return;
        controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }

      function close() {
        if (closed) return;
        closed = true;
        clearInterval(pollTimer);
        clearInterval(heartbeatTimer);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }

      async function tick() {
        if (closed) return;

        if (Date.now() - startTime > MAX_LIFETIME_MS) {
          send("timeout", { reason: "max_lifetime" });
          close();
          return;
        }

        try {
          const { rows: convRows } = await pool.query(
            `SELECT is_streaming, streaming_started_at FROM conversations WHERE id = $1`,
            [convId],
          );

          const isStreaming = convRows[0]?.is_streaming === true;
          const startedAt = convRows[0]?.streaming_started_at as string | null;

          if (isStreaming && startedAt) {
            const elapsed = Date.now() - new Date(startedAt).getTime();
            if (elapsed > STALE_STREAM_MS) {
              await pool.query(
                `UPDATE conversations SET is_streaming = FALSE, streaming_started_at = NULL WHERE id = $1`,
                [convId],
              );
              send("done", { content: null, messageId: null, reason: "stale" });
              close();
              return;
            }
          }

          const { rows: msgRows } = await pool.query(
            `SELECT id, content FROM messages WHERE conversation_id = $1 AND role = 'assistant' ORDER BY created_at DESC LIMIT 1`,
            [convId],
          );

          const payload = {
            isStreaming,
            content: msgRows[0]?.content ?? null,
            messageId: msgRows[0]?.id ?? null,
            startedAt,
          };

          if (isStreaming) {
            send("status", payload);
          } else {
            send("done", payload);
            close();
          }
        } catch (err) {
          console.error("[stream-events] query error:", err);
          send("error", { message: "internal error" });
          close();
        }
      }

      tick();

      const pollTimer = setInterval(tick, POLL_INTERVAL_MS);
      const heartbeatTimer = setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);

      request.signal.addEventListener("abort", () => {
        close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
