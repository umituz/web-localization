import { describe, expect, it, vi } from "vitest";
import { GoogleTranslateStrategy } from "../src/application/strategies/google-translate.strategy";
import { TranslationCircuitOpenError } from "../src/core/errors";

function rateLimited(): Response {
  return new Response("Too Many Requests", { status: 429 });
}

function makeStrategy(
  fetchImpl: typeof fetch,
  circuitFailureThreshold: number
): GoogleTranslateStrategy {
  return new GoogleTranslateStrategy({
    fetchImpl,
    timeoutMs: 1000,
    maxRetries: 0,
    minDelayMs: 0,
    circuitFailureThreshold,
  });
}

function requests(texts: readonly string[]) {
  return texts.map((text) => ({ text, targetLanguage: "tr" as never }));
}

describe("circuit breaker", () => {
  it("opens after the configured number of consecutive terminal failures", async () => {
    const fetchImpl = vi.fn(async () => rateLimited());
    const strategy = makeStrategy(fetchImpl as unknown as typeof fetch, 3);

    // One chunk of 4 texts: the batch request fails and every single-item
    // fallback fails too → 4 terminal failures ≥ threshold 3.
    await expect(
      strategy.translateBatch(requests(["a", "b", "c", "d"]))
    ).rejects.toBeInstanceOf(TranslationCircuitOpenError);

    expect(strategy.circuitState.open).toBe(true);
    expect(strategy.circuitState.consecutiveFailures).toBeGreaterThanOrEqual(3);
    expect(strategy.circuitState.lastErrorNote).toContain("429");
  });

  it("fails subsequent calls immediately without touching fetch again", async () => {
    const fetchImpl = vi.fn(async () => rateLimited());
    const strategy = makeStrategy(fetchImpl as unknown as typeof fetch, 3);

    await expect(
      strategy.translateBatch(requests(["a", "b", "c"]))
    ).rejects.toBeInstanceOf(TranslationCircuitOpenError);
    const callsAfterFirstFailure = fetchImpl.mock.calls.length;

    await expect(strategy.translate({ text: "x", targetLanguage: "tr" as never })).rejects.toBeInstanceOf(
      TranslationCircuitOpenError
    );
    await expect(
      strategy.translateBatch(requests(["y", "z"]))
    ).rejects.toBeInstanceOf(TranslationCircuitOpenError);

    expect(fetchImpl.mock.calls.length).toBe(callsAfterFirstFailure);
  });

  it("resets the failure streak when any request succeeds", async () => {
    // Batch endpoint fails; single-text fallback succeeds for 'good*' texts.
    const fetchImpl = vi.fn(async (url: unknown) => {
      const texts = new URL(String(url)).searchParams.getAll("q");
      if (texts.length > 1) return rateLimited();
      return texts[0]?.startsWith("good")
        ? new Response(JSON.stringify([[[`ok-${texts[0]}`, "en", null, null]]]), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
        : rateLimited();
    });
    const strategy = makeStrategy(fetchImpl as unknown as typeof fetch, 3);

    // 2 failures but also successes → streak resets, circuit stays closed.
    const stats = await strategy.translateBatch(requests(["bad-1", "good-1", "bad-2", "good-2"]));
    expect(stats.failureCount).toBe(2);
    expect(stats.successCount).toBe(2);
    expect(strategy.circuitState.open).toBe(false);

    // Another failing batch never crosses the threshold because successes
    // keep resetting the streak within each batch.
    const second = await strategy.translateBatch(requests(["bad-3", "good-3", "bad-4", "good-4"]));
    expect(second.failureCount).toBe(2);
    expect(strategy.circuitState.open).toBe(false);
  });

  it("closes again after dispose (fresh run state)", async () => {
    const fetchImpl = vi.fn(async () => rateLimited());
    const strategy = makeStrategy(fetchImpl as unknown as typeof fetch, 2);

    await expect(strategy.translateBatch(requests(["a", "b"]))).rejects.toBeInstanceOf(
      TranslationCircuitOpenError
    );
    strategy.dispose();

    expect(strategy.circuitState.open).toBe(false);
    expect(strategy.circuitState.consecutiveFailures).toBe(0);
  });
});
