/**
 * Simple Rate Limiter
 * @description Controls the frequency of API requests
 */
export declare class RateLimiter {
    private lastRequestTime;
    private minDelay;
    constructor(minDelay?: number);
    waitForSlot(): Promise<void>;
}
//# sourceMappingURL=rate-limit.util.d.ts.map