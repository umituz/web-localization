/**
 * Simple Rate Limiter
 * @description Controls the frequency of API requests
 */
export class RateLimiter {
    lastRequestTime = 0;
    minDelay;
    constructor(minDelay = 100) {
        this.minDelay = minDelay;
    }
    async waitForSlot() {
        const now = Date.now();
        const elapsedTime = now - this.lastRequestTime;
        if (elapsedTime < this.minDelay) {
            const waitTime = this.minDelay - elapsedTime;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        this.lastRequestTime = Date.now();
    }
}
