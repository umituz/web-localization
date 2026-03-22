/**
 * Simple Rate Limiter
 * @description Controls the frequency of API requests
 */

export class RateLimiter {
  private lastRequestTime = 0;
  private minDelay: number;

  constructor(minDelay = 100) {
    this.minDelay = minDelay;
  }

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    const elapsedTime = now - this.lastRequestTime;
    
    if (elapsedTime < this.minDelay) {
      const waitTime = this.minDelay - elapsedTime;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }
}
