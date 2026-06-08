/**
 * Rate Limit Delay Calculator
 * @description Computes how long to wait before the next request can be sent,
 * given how much time has elapsed since the last request.
 *
 * Returns 0 when the minimum delay has already been satisfied (caller can
 * proceed immediately). Returns a positive value otherwise.
 */
export interface RateLimitDelayInput {
  readonly elapsedSinceLastRequestMs: number;
  readonly targetDelayMs: number;
}

export function computeRateLimitDelay(input: RateLimitDelayInput): number {
  const { elapsedSinceLastRequestMs, targetDelayMs } = input;
  if (elapsedSinceLastRequestMs >= targetDelayMs) {
    return 0;
  }
  return targetDelayMs - elapsedSinceLastRequestMs;
}

/**
 * Compute the dynamic target delay based on observed response times.
 * @description Slow responses → larger delay. Fast responses → smaller delay.
 * Capped above to prevent runaway behavior.
 */
export interface DynamicDelayInput {
  readonly averageResponseTimeMs: number;
  readonly minDelayMs: number;
  readonly multiplier: number;
  readonly capMultiplier: number;
}

export function computeDynamicDelay(input: DynamicDelayInput): number {
  const { averageResponseTimeMs, minDelayMs, multiplier, capMultiplier } = input;
  const target = Math.max(minDelayMs, averageResponseTimeMs * multiplier);
  const cap = minDelayMs * capMultiplier;
  return Math.min(target, cap);
}
