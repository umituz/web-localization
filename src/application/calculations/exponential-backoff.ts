/**
 * Exponential Backoff Delay Calculator
 * @description Computes delay (ms) for retry attempt N.
 *
 * Formula: `initial * multiplier^attempt`, optionally capped.
 * Pure function, deterministic.
 *
 * Example: initial=2000, multiplier=2
 *   attempt 0 → 2000
 *   attempt 1 → 4000
 *   attempt 2 → 8000
 *   with cap=10000 → [2000, 4000, 8000, 10000, 10000, ...]
 */
export interface ExponentialBackoffInput {
  readonly attempt: number;
  readonly initialDelayMs: number;
  readonly multiplier: number;
  readonly capMs?: number;
}

export function computeExponentialBackoff(input: ExponentialBackoffInput): number {
  const { attempt, initialDelayMs, multiplier, capMs } = input;

  if (attempt < 0) {
    return 0;
  }
  if (!Number.isFinite(initialDelayMs) || initialDelayMs < 0) {
    return 0;
  }
  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    return initialDelayMs;
  }

  const delay = initialDelayMs * Math.pow(multiplier, attempt);

  if (capMs !== undefined && Number.isFinite(capMs)) {
    return Math.min(delay, capMs);
  }
  return delay;
}
