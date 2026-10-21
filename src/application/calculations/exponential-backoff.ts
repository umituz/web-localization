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
