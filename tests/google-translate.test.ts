import { describe, expect, it, vi } from "vitest";
import { GoogleTranslateStrategy } from "../src/application/strategies/google-translate.strategy";
import { GoogleTranslateHttpClient } from "../src/infrastructure/http/translation-http.client";
import { VariableProtector } from "../src/application/services/variable-protector";
import {
  TranslationAbortedError,
  TranslationHttpError,
  TranslationTimeoutError,
} from "../src/core/errors";

function googleResponse(translated: string): Response {
  return new Response(JSON.stringify([[[translated, "source", null, null]]]), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function makeStrategy(fetchImpl: typeof fetch, overrides: Partial<ConstructorParameters<typeof GoogleTranslateStrategy>[0]> = {}) {
  return new GoogleTranslateStrategy({
    fetchImpl,
    timeoutMs: 1000,
    maxRetries: 0,
    minDelayMs: 0,
    ...overrides,
  });
}

describe("GoogleTranslateStrategy.translate", () => {
  it("translates a single text via the injected fetch", async () => {
    const fetchImpl = vi.fn(async () => googleResponse("Merhaba Dünya"));
    const strategy = makeStrategy(fetchImpl as unknown as typeof fetch);

    const response = await strategy.translate({ text: "Hello World", targetLanguage: "tr" as never });
    expect(response).toMatchObject({
      success: true,
      translatedText: "Merhaba Dünya",
    });
    expect(response.cached ?? false).toBe(false);
    const calledUrl = fetchImpl.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("tl=tr");
    expect(calledUrl).toContain("sl=en");
  });

  it("caches results — second identical request does not hit fetch", async () => {
    const fetchImpl = vi.fn(async () => googleResponse("Merhaba"));
    const strategy = makeStrategy(fetchImpl as unknown as typeof fetch);

    await strategy.translate({ text: "Hello", targetLanguage: "tr" as never });
    const second = await strategy.translate({ text: "Hello", targetLanguage: "tr" as never });
    expect(second.cached).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(strategy.getCacheStats().size).toBe(1);
  });

  it("passes through non-translatable input without calling fetch", async () => {
    const fetchImpl = vi.fn(async () => googleResponse("x"));
    const strategy = makeStrategy(fetchImpl as unknown as typeof fetch);

    const numeric = await strategy.translate({ text: "12345", targetLanguage: "tr" as never });
    expect(numeric.success).toBe(true);
    expect(numeric.translatedText).toBe("12345");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("protects {{placeholders}} end-to-end", async () => {
    const fetchImpl = vi.fn(async (url: unknown) => {

      const q = new URL(String(url)).searchParams.get("q") ?? "";
      return googleResponse(q);
    });
    const strategy = makeStrategy(fetchImpl as unknown as typeof fetch);

    const response = await strategy.translate({
      text: "Hello {{name}}",
      targetLanguage: "tr" as never,
    });
    expect(response.translatedText).toBe("Hello {{name}}");
  });

  it("reports failure (does not throw) for a single translation error", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 503 }));
    const strategy = makeStrategy(fetchImpl as unknown as typeof fetch);

    const response = await strategy.translate({ text: "Hello", targetLanguage: "tr" as never });
    expect(response.success).toBe(false);
    expect(response.translatedText).toBe("Hello");
    expect(response.error).toBeDefined();
  });

  it("rejects immediately when the signal is already aborted", async () => {
    const fetchImpl = vi.fn();
    const strategy = makeStrategy(fetchImpl as unknown as typeof fetch);
    const controller = new AbortController();
    controller.abort();

    await expect(
      strategy.translate({ text: "Hello", targetLanguage: "tr" as never }, controller.signal)
    ).rejects.toThrow(TranslationAbortedError);
  });
});

describe("GoogleTranslateStrategy.translateBatch", () => {
  it("returns empty stats for an empty batch", async () => {
    const strategy = makeStrategy(vi.fn() as unknown as typeof fetch);
    const stats = await strategy.translateBatch([]);
    expect(stats.totalCount).toBe(0);
  });

  it("mixes successes, failures and skips with correct accounting", async () => {
    let call = 0;
    const fetchImpl = vi.fn(async () => {
      call++;
      if (call === 1) return googleResponse("merhaba");
      throw new TranslationHttpError(0, "network down");
    });
    const strategy = makeStrategy(fetchImpl as unknown as typeof fetch, { maxRetries: 0 });

    const stats = await strategy.translateBatch([
      { text: "hello", targetLanguage: "tr" as never },
      { text: "world", targetLanguage: "tr" as never },
      { text: "42", targetLanguage: "tr" as never },
    ]);

    expect(stats.successCount).toBe(1);
    expect(stats.failureCount).toBe(1);
    expect(stats.skippedCount).toBe(1);
  });
});

describe("GoogleTranslateStrategy.translateObject", () => {
  it("translates a nested object tree and applies results to the target", async () => {
    const fetchImpl = vi.fn(async (url: unknown) => {
      const q = new URL(String(url)).searchParams.get("q") ?? "";
      return googleResponse(`${q}!`);
    });
    const strategy = makeStrategy(fetchImpl as unknown as typeof fetch);

    const source = { nav: { home: "Home" }, cta: "Go" };
    const target: Record<string, unknown> = {};
    const stats = await strategy.translateObject({
      source,
      target,
      targetLanguage: "tr" as never,
    });

    expect(stats.successCount).toBe(2);
    expect(target).toEqual({ nav: { home: "Home!" }, cta: "Go!" });
  });

  it("re-translates everything when force is true", async () => {
    const fetchImpl = vi.fn(async (url: unknown) => {
      const q = new URL(String(url)).searchParams.get("q") ?? "";
      return googleResponse(`${q}!`);
    });
    const strategy = makeStrategy(fetchImpl as unknown as typeof fetch);

    const target = { a: "already" };
    await strategy.translateObject(
      { source: { a: "A" }, target, targetLanguage: "tr" as never, force: true },
      {}
    );
    expect(target.a).toBe("A!");
  });
});

describe("GoogleTranslateHttpClient", () => {
  const protector = new VariableProtector();

  it("throws TranslationHttpError with retryability info on HTTP errors", async () => {
    const client = new GoogleTranslateHttpClient(protector, {
      timeoutMs: 1000,
      fetchImpl: (async () => new Response("rate limited", { status: 429 })) as unknown as typeof fetch,
    });
    const error = await client.translate("hi", "en", "tr").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TranslationHttpError);
    expect((error as TranslationHttpError).isRetryable).toBe(true);
  });

  it("maps a timeout to TranslationTimeoutError, external abort to TranslationAbortedError", async () => {
    const hanging = (_url: unknown, init?: { signal?: AbortSignal }) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError"))
        );
      });

    const controller = new AbortController();
    const abortClient = new GoogleTranslateHttpClient(protector, {
      timeoutMs: 5000,
      fetchImpl: hanging as unknown as typeof fetch,
    });
    setTimeout(() => controller.abort(), 5);
    await expect(
      abortClient.translate("hi", "en", "tr", controller.signal)
    ).rejects.toThrow(TranslationAbortedError);

    const timeoutClient = new GoogleTranslateHttpClient(protector, {
      timeoutMs: 5,
      fetchImpl: hanging as unknown as typeof fetch,
    });
    await expect(timeoutClient.translate("hi", "en", "tr")).rejects.toThrow(
      TranslationTimeoutError
    );
  });

  it("rejects construction when fetch is unavailable", () => {
    const original = globalThis.fetch;

    globalThis.fetch = undefined;
    expect(
      () =>
        new GoogleTranslateHttpClient(protector, {
          timeoutMs: 100,
        })
    ).toThrow(/fetch is not available/);
    globalThis.fetch = original;
  });
});
