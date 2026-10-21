import { describe, expect, it, vi, afterEach } from "vitest";
import { LRUCache } from "../src/core/utils/lru-cache";
import { Semaphore } from "../src/core/utils/semaphore";
import { RateLimiter } from "../src/core/utils/rate-limiter";
import { RetryPolicy } from "../src/core/utils/retry-policy";
import { sleep } from "../src/core/utils/sleep";
import { TranslationAbortedError, TranslationHttpError } from "../src/core/errors";

afterEach(() => {
  vi.useRealTimers();
});

describe("LRUCache", () => {
  it("evicts least-recently-used entries beyond capacity", () => {
    const cache = new LRUCache<string, number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.get("a");
    cache.set("c", 3);
    expect(cache.has("b")).toBe(false);
    expect(cache.get("a")).toBe(1);
    expect(cache.get("c")).toBe(3);
    expect(cache.stats()).toEqual({ size: 2, maxSize: 2 });
  });

  it("does not mutate stored values (primitives stay primitives)", () => {
    const cache = new LRUCache<string, string>(5);
    cache.set("k", "plain string");
    expect(cache.get("k")).toBe("plain string");
  });

  it("rejects invalid construction", () => {
    expect(() => new LRUCache(0)).toThrow();
    expect(() => new LRUCache(10, -5)).toThrow();
  });

  it("expires entries after the TTL (works for primitive values)", () => {
    vi.useFakeTimers();
    const cache = new LRUCache<string, string>(5, 1000);
    cache.set("k", "v");
    expect(cache.has("k")).toBe(true);
    expect(cache.get("k")).toBe("v");

    vi.advanceTimersByTime(1001);
    expect(cache.has("k")).toBe(false);
    expect(cache.get("k")).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it("TTL refreshes recency without resetting expiry", () => {
    vi.useFakeTimers();
    const cache = new LRUCache<string, string>(5, 1000);
    cache.set("k", "v");
    vi.advanceTimersByTime(600);
    cache.get("k");
    vi.advanceTimersByTime(500);
    expect(cache.get("k")).toBeUndefined();
  });
});

describe("Semaphore", () => {
  it("allows at most N concurrent runs and wakes waiters FIFO", async () => {
    const semaphore = new Semaphore(2);
    const order: number[] = [];
    let active = 0;
    let maxActive = 0;

    const task = (id: number) =>
      semaphore.run(async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await sleep(10);
        order.push(id);
        active--;
      });

    await Promise.all([task(1), task(2), task(3), task(4)]);
    expect(maxActive).toBe(2);
    expect(order).toEqual([1, 2, 3, 4]);
  });

  it("releases the permit when the task throws", async () => {
    const semaphore = new Semaphore(1);
    await expect(
      semaphore.run(async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");

    await semaphore.run(async () => "ok");
    expect(semaphore.availablePermits).toBe(1);
  });

  it("rejects invalid permit counts", () => {
    expect(() => new Semaphore(0)).toThrow();
    expect(() => new Semaphore(1.5)).toThrow();
  });
});

describe("RateLimiter", () => {
  it("spaces requests by at least the minimum delay", async () => {
    vi.useFakeTimers();
    const limiter = new RateLimiter({ minDelayMs: 50 });
    const first = limiter.waitForSlot();
    const second = limiter.waitForSlot();

    let secondDone = false;
    void second.then(() => {
      secondDone = true;
    });

    await vi.advanceTimersByTimeAsync(10);
    expect(secondDone).toBe(false);
    await vi.advanceTimersByTimeAsync(60);
    expect(secondDone).toBe(true);
    await first;
  });

  it("clear() settles queued waiters instead of hanging them (regression)", async () => {
    vi.useFakeTimers();
    const limiter = new RateLimiter({ minDelayMs: 10_000 });
    const first = limiter.waitForSlot();
    const queued = limiter.waitForSlot();

    let queuedSettled = false;
    const queuedPromise = queued.then(() => {
      queuedSettled = true;
    });

    limiter.clear();
    await Promise.race([queuedPromise, sleep(20).then(() => "timeout")]);
    expect(queuedSettled).toBe(true);
    await first.catch(() => undefined);
  });

  it("adapts dynamic delay from recorded response times", () => {
    const limiter = new RateLimiter({ minDelayMs: 100 });
    expect(limiter.currentDelay).toBe(100);
    limiter.recordResponseTime(1000);
    expect(limiter.currentDelay).toBeGreaterThan(100);
    limiter.resetDynamicDelay();
    expect(limiter.currentDelay).toBe(100);
  });
});

describe("RetryPolicy", () => {
  it("returns the first successful result without retrying", async () => {
    const fn = vi.fn(async () => "ok");
    const policy = new RetryPolicy({ maxRetries: 3, initialBackoffMs: 1, backoffMultiplier: 2 });
    expect(await policy.execute(fn)).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries retryable errors up to maxRetries, then throws the last error", async () => {
    let attempts = 0;
    const fn = vi.fn(async () => {
      attempts++;
      throw new TranslationHttpError(500, "server error");
    });
    const policy = new RetryPolicy({
      maxRetries: 2,
      initialBackoffMs: 1,
      backoffMultiplier: 2,
      isRetryable: (err) => err instanceof TranslationHttpError && err.isRetryable,
    });
    await expect(policy.execute(fn)).rejects.toThrow(TranslationHttpError);
    expect(attempts).toBe(3);
  });

  it("does not retry when isRetryable returns false", async () => {
    const fn = vi.fn(async () => {
      throw new TranslationHttpError(400, "bad request");
    });
    const policy = new RetryPolicy({
      maxRetries: 5,
      initialBackoffMs: 1,
      backoffMultiplier: 2,
      isRetryable: () => false,
    });
    await expect(policy.execute(fn)).rejects.toThrow(TranslationHttpError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("aborts immediately via signal", async () => {
    const controller = new AbortController();
    controller.abort();
    const fn = vi.fn(async () => "never");
    const policy = new RetryPolicy({ maxRetries: 3, initialBackoffMs: 1, backoffMultiplier: 2 });
    await expect(policy.execute(fn, controller.signal)).rejects.toThrow(TranslationAbortedError);
    expect(fn).not.toHaveBeenCalled();
  });

  it("aborts during the backoff sleep", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const fn = vi.fn(async () => {
      throw new TranslationHttpError(500, "retryable");
    });
    const policy = new RetryPolicy({
      maxRetries: 5,
      initialBackoffMs: 60_000,
      backoffMultiplier: 2,
      isRetryable: () => true,
    });

    const promise = policy.execute(fn, controller.signal);

    await vi.advanceTimersByTimeAsync(1);
    controller.abort();

    await expect(promise).rejects.toThrow(TranslationAbortedError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not leak abort listeners across retries (regression)", async () => {
    const controller = new AbortController();
    const warning = vi.spyOn(process, "emitWarning").mockImplementation(() => {});
    let calls = 0;
    const policy = new RetryPolicy({
      maxRetries: 8,
      initialBackoffMs: 1,
      backoffMultiplier: 1,
      isRetryable: () => true,
    });
    await expect(
      policy.execute(
        async () => {
          calls++;
          throw new TranslationHttpError(500, "x");
        },
        controller.signal
      )
    ).rejects.toThrow();

    const leaked = warning.mock.calls.filter((c) =>
      String(c[0]).includes("MaxListenersExceededWarning")
    );
    expect(leaked).toHaveLength(0);
    warning.mockRestore();
    expect(calls).toBe(9);
  });
});

describe("sleep", () => {
  it("resolves after the given delay and tolerates negative input", async () => {
    vi.useFakeTimers();
    let resolved = false;
    sleep(50).then(() => {
      resolved = true;
    });
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(50);
    expect(resolved).toBe(true);
    await sleep(-1);
  });
});
