/**
 * Advanced Rate Limiter with Queue and Dynamic Adjustment
 * @description Controls the frequency of API requests with intelligent queue management
 */

import { DEFAULT_MIN_DELAY } from "../constants/index.js";

interface QueuedRequest {
  resolve: () => void;
  priority: number;
  timestamp: number;
}

export class RateLimiter {
  private lastRequestTime = 0;
  private readonly minDelay: number;
  private queue: QueuedRequest[] = [];
  private processingQueue = false;
  private dynamicDelay: number;
  private responseTimeHistory: number[] = [];
  private readonly maxHistorySize = 10;

  constructor(minDelay = DEFAULT_MIN_DELAY) {
    if (minDelay < 0) {
      throw new Error("minDelay must be non-negative");
    }
    this.minDelay = minDelay;
    this.dynamicDelay = minDelay;
  }

  /**
   * Wait for available slot with priority support
   * @param priority - Lower number = higher priority (default: 10)
   */
  async waitForSlot(priority = 10): Promise<void> {
    // If queue is empty and we can proceed immediately, fast path
    if (this.queue.length === 0 && !this.processingQueue) {
      const now = Date.now();
      const elapsedTime = now - this.lastRequestTime;

      if (elapsedTime >= this.minDelay) {
        this.lastRequestTime = now;
        return;
      }
    }

    // Add to queue
    return new Promise<void>((resolve) => {
      this.queue.push({
        resolve: () => resolve(),
        priority,
        timestamp: Date.now(),
      });

      // Sort by priority (lower first) then timestamp (older first)
      this.queue.sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        return a.timestamp - b.timestamp;
      });

      // Start processing if not already running
      if (!this.processingQueue) {
        this.processQueue();
      }
    });
  }

  /**
   * Process queued requests with controlled timing
   */
  private async processQueue(): Promise<void> {
    if (this.processingQueue) return;
    this.processingQueue = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const elapsedTime = now - this.lastRequestTime;
      const delayNeeded = Math.max(0, this.dynamicDelay - elapsedTime);

      if (delayNeeded > 0) {
        await this.sleep(delayNeeded);
      }

      const request = this.queue.shift();
      if (request) {
        this.lastRequestTime = Date.now();
        request.resolve();
      }
    }

    this.processingQueue = false;
  }

  /**
   * Record response time for dynamic delay adjustment
   */
  recordResponseTime(responseTimeMs: number): void {
    this.responseTimeHistory.push(responseTimeMs);

    // Keep history size bounded
    if (this.responseTimeHistory.length > this.maxHistorySize) {
      this.responseTimeHistory.shift();
    }

    // Calculate average response time
    const avgResponseTime = this.responseTimeHistory.reduce((a, b) => a + b, 0) / this.responseTimeHistory.length;

    // Adjust delay dynamically (with safety bounds)
    // If responses are fast, decrease delay; if slow, increase delay
    const targetDelay = Math.max(this.minDelay, avgResponseTime * 1.5);
    this.dynamicDelay = Math.min(targetDelay, this.minDelay * 3);
  }

  /**
   * Reset dynamic delay to minimum
   */
  resetDynamicDelay(): void {
    this.dynamicDelay = this.minDelay;
    this.responseTimeHistory = [];
  }

  /**
   * Get current queue length
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Optimized sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise<void>(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear all pending requests (for cleanup)
   */
  clear(): void {
    this.queue = [];
    this.processingQueue = false;
  }
}
