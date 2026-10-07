const DEBUG_ENABLED = process.env.NODE_ENV !== 'production';

export function debugLog(...args: unknown[]) {
  if (!DEBUG_ENABLED) return;
  console.log(...args);
}

export function debugWarn(...args: unknown[]) {
  if (!DEBUG_ENABLED) return;
  console.warn(...args);
}
