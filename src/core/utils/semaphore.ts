/**
 * Async Semaphore - Real concurrency control
 * @description Limits the number of concurrent async operations.
 * Unlike the previous RateLimiter, this is a true mutual-exclusion primitive.
 *
 * Use cases:
 * - Limit parallel HTTP requests to N
 * - Throttle file system operations
 * - Bounded resource pools
 */
export class Semaphore {
  private permits: number;
  private readonly waitQueue: Array<() => void> = [];

  constructor(permits: number) {
    if (!Number.isInteger(permits) || permits < 1) {
      throw new Error("Semaphore permits must be a positive integer");
    }
    this.permits = permits;
  }

  /**
   * Acquire a permit. Resolves immediately if one is available, otherwise queues.
   */
  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    return new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  /**
   * Release a permit. Wakes the next waiter (FIFO order) if any.
   */
  release(): void {
    const next = this.waitQueue.shift();
    if (next) {
      // Transfer permit directly — do not increment then decrement
      next();
    } else {
      this.permits++;
    }
  }

  /**
   * Run an async function with automatic permit acquisition/release.
   * Guarantees release even when the function throws.
   */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  /**
   * Number of permits currently available.
   */
  get availablePermits(): number {
    return this.permits;
  }

  /**
   * Number of operations waiting for a permit.
   */
  get queueLength(): number {
    return this.waitQueue.length;
  }
}
