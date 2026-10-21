import { RATE_LIMIT } from "../constants";
import { sleep } from "./sleep";
import {
  computeRateLimitDelay,
  computeDynamicDelay,
} from "../../application/calculations/rate-limit-delay-calculator";
import { SlidingWindowAverage } from "../../application/calculations/sliding-window-average";

interface QueuedRequest {
  readonly priority: number;
  readonly enqueuedAt: number;
  readonly resolve: () => void;
}

export interface RateLimiterOptions {
  readonly minDelayMs?: number;
  readonly maxHistorySize?: number;
  readonly dynamicDelayMultiplier?: number;
  readonly dynamicDelayCapMultiplier?: number;
}

export class RateLimiter {
  private readonly minDelayMs: number;
  private readonly maxHistorySize: number;
  private readonly dynamicDelayMultiplier: number;
  private readonly dynamicDelayCapMultiplier: number;
  private readonly responseWindow: SlidingWindowAverage;

  private lastRequestTime = 0;
  private dynamicDelay: number;
  private readonly queue: QueuedRequest[] = [];
  private processing = false;

  constructor(options: RateLimiterOptions = {}) {
    this.minDelayMs = Math.max(0, options.minDelayMs ?? RATE_LIMIT.DEFAULT_MIN_DELAY_MS);
    this.maxHistorySize = options.maxHistorySize ?? RATE_LIMIT.MAX_HISTORY_SIZE;
    this.dynamicDelayMultiplier =
      options.dynamicDelayMultiplier ?? RATE_LIMIT.DYNAMIC_DELAY_MULTIPLIER;
    this.dynamicDelayCapMultiplier =
      options.dynamicDelayCapMultiplier ?? RATE_LIMIT.DYNAMIC_DELAY_CAP_MULTIPLIER;
    this.dynamicDelay = this.minDelayMs;
    this.responseWindow = new SlidingWindowAverage(this.maxHistorySize);
  }

  async waitForSlot(priority = 10): Promise<void> {
    return new Promise<void>((resolve) => {
      this.enqueue({ priority, enqueuedAt: Date.now(), resolve });
      if (!this.processing) {
        void this.processQueue();
      }
    });
  }

  recordResponseTime(responseTimeMs: number): void {
    this.responseWindow.add(responseTimeMs);
    this.dynamicDelay = computeDynamicDelay({
      averageResponseTimeMs: this.responseWindow.average(),
      minDelayMs: this.minDelayMs,
      multiplier: this.dynamicDelayMultiplier,
      capMultiplier: this.dynamicDelayCapMultiplier,
    });
  }

  resetDynamicDelay(): void {
    this.dynamicDelay = this.minDelayMs;
    this.responseWindow.clear();
  }

  clear(): void {
    const pending = this.queue.splice(0, this.queue.length);
    this.processing = false;
    for (const request of pending) {
      request.resolve();
    }
  }

  get queueLength(): number {
    return this.queue.length;
  }

  get currentDelay(): number {
    return this.dynamicDelay;
  }

  private enqueue(request: QueuedRequest): void {
    let insertAt = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      const existing = this.queue[i];
      if (
        request.priority < existing.priority ||
        (request.priority === existing.priority && request.enqueuedAt < existing.enqueuedAt)
      ) {
        insertAt = i;
        break;
      }
    }
    this.queue.splice(insertAt, 0, request);
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      while (this.queue.length > 0) {
        const delayNeeded = computeRateLimitDelay({
          elapsedSinceLastRequestMs: Date.now() - this.lastRequestTime,
          targetDelayMs: this.dynamicDelay,
        });

        if (delayNeeded > 0) {
          await sleep(delayNeeded);
        }

        const next = this.queue.shift();
        if (!next) break;

        this.lastRequestTime = Date.now();
        next.resolve();
      }
    } finally {
      this.processing = false;
    }
  }
}
