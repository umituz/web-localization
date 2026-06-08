/**
 * Time Elapsed Calculator
 * @description Wraps `Date.now()` to make the start time explicit and the
 * measurement unit-testable. Returns 0 if `endMs < startMs` (clock skew).
 */
export function calculateElapsedMs(startMs: number, endMs: number = Date.now()): number {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0;
  const diff = endMs - startMs;
  return diff < 0 ? 0 : diff;
}

/**
 * Cache TTL check: is the cached entry still valid?
 */
export function isWithinTtl(cachedAtMs: number, ttlMs: number, nowMs: number = Date.now()): boolean {
  if (!Number.isFinite(cachedAtMs) || !Number.isFinite(ttlMs) || ttlMs <= 0) return false;
  return nowMs - cachedAtMs < ttlMs;
}

/**
 * Cache TTL expiry check (inverse of isWithinTtl).
 */
export function isTtlExpired(cachedAtMs: number, ttlMs: number, nowMs: number = Date.now()): boolean {
  return !isWithinTtl(cachedAtMs, ttlMs, nowMs);
}
