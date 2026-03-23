/**
 * Simple Rate Limiter
 * @description Controls the frequency of API requests
 */

import { DEFAULT_MIN_DELAY } from "../constants/index.js";

export class RateLimiter {
  private lastRequestTime = 0;
  private readonly minDelay: number;

  constructor(minDelay = DEFAULT_MIN_DELAY) {
    if (minDelay < 0) {
      throw new Error("minDelay must be non-negative");
    }
    this.minDelay = minDelay;
  }

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    const elapsedTime = now - this.lastRequestTime;

    if (elapsedTime < this.minDelay) {
      const waitTime = this.minDelay - elapsedTime;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      // Set to the time when we can make the next request
      this.lastRequestTime = Date.now();
    } else {
      // No wait needed, update to current time
      this.lastRequestTime = now;
    }
  }
}
