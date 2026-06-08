/**
 * Sleep utility - Promise-based delay
 * @description Minimal, dependency-free sleep function.
 */
export function sleep(ms: number): Promise<void> {
  if (ms < 0) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
