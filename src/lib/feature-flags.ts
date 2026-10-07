/**
 * Runtime feature flags for the realtime communication migration.
 * Mirror of tenant-dashboard/src/lib/feature-flags.ts.
 */

function env(key: string, fallback: string): string {
  if (typeof window !== "undefined") {
    return (process.env as Record<string, string | undefined>)[key] ?? fallback;
  }
  return process.env[key] ?? fallback;
}

export type StreamStatusMode = "sse" | "poll";

export const REALTIME_FLAGS = {
  streamStatus: env("NEXT_PUBLIC_REALTIME_STREAM_STATUS", "poll") as StreamStatusMode,
} as const;

export function isStreamStatusSSE(): boolean {
  return REALTIME_FLAGS.streamStatus === "sse";
}
