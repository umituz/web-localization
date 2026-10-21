export function calculateElapsedMs(startMs: number, endMs: number = Date.now()): number {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0;
  const diff = endMs - startMs;
  return diff < 0 ? 0 : diff;
}

export function isWithinTtl(cachedAtMs: number, ttlMs: number, nowMs: number = Date.now()): boolean {
  if (!Number.isFinite(cachedAtMs) || !Number.isFinite(ttlMs) || ttlMs <= 0) return false;
  return nowMs - cachedAtMs < ttlMs;
}

export function isTtlExpired(cachedAtMs: number, ttlMs: number, nowMs: number = Date.now()): boolean {
  return !isWithinTtl(cachedAtMs, ttlMs, nowMs);
}
