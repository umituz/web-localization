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
