import { describe, expect, it, vi } from "vitest";
import { GoogleTranslateStrategy } from "../src/application/strategies/google-translate.strategy";
import { GoogleTranslateHttpClient } from "../src/infrastructure/http/translation-http.client";
import { VariableProtector } from "../src/application/services/variable-protector";
import { GOOGLE_TRANSLATE } from "../src/core/constants";

function v2Response(texts: readonly string[]): Response {
  return new Response(
    JSON.stringify({
      data: { translations: texts.map((translatedText) => ({ translatedText })) },
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}

describe("GoogleTranslateHttpClient with an API key (official v2 API)", () => {
  function makeClient(fetchImpl: typeof fetch): GoogleTranslateHttpClient {
    return new GoogleTranslateHttpClient(new VariableProtector(), {
      timeoutMs: 1000,
      apiKey: "test-key",
      fetchImpl,
    });
  }

  it("sends a POST to the v2 endpoint with the key header", async () => {
    const fetchImpl = vi.fn(async () => v2Response(["merhaba"]));
    const client = makeClient(fetchImpl as unknown as typeof fetch);

    const translated = await client.translate("hello", "en", "tr");

    expect(translated).toBe("merhaba");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(GOOGLE_TRANSLATE.API_V2_URL);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key");
    expect(JSON.parse(String(init.body))).toEqual({
      q: ["hello"],
      source: "en",
      target: "tr",
      format: "text",
    });
  });

  it("translates batches in one request and keeps placeholders intact", async () => {
    const fetchImpl = vi.fn(async () => v2Response(["merhaba {{name}}", "dünya"]));
    const client = makeClient(fetchImpl as unknown as typeof fetch);

    const translated = await client.translateBatch(
      ["hello {{name}}", "world"],
      "en",
      "tr"
    );

    expect(translated).toEqual(["merhaba {{name}}", "dünya"]);
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as { q: string[] };
    expect(body.q).toHaveLength(2);
    // Variables travel as opaque tokens (the protector's whole point) and
    // are restored to {{name}} in the result asserted above.
    expect(body.q[0]).not.toContain("{{");
    expect(body.q[0]).toContain("__WL_VAR_");
  });

  it("surfaces a malformed v2 response as an HTTP error", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ data: { translations: [] } }), { status: 200 })
    );
    const client = makeClient(fetchImpl as unknown as typeof fetch);

    await expect(client.translate("hello", "en", "tr")).rejects.toThrow(/results for 1 texts/);
  });
});

describe("GoogleTranslateStrategy with an API key", () => {
  it("routes single and batch translations through the official endpoint", async () => {
    const fetchImpl = vi.fn(async (url: unknown, init?: RequestInit) => {
      expect(String(url)).toBe(GOOGLE_TRANSLATE.API_V2_URL);
      expect(init?.method).toBe("POST");
      const body = JSON.parse(String(init?.body)) as { q: string[] };
      return v2Response(body.q.map((text) => `tr:${text}`));
    });
    const strategy = new GoogleTranslateStrategy({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      timeoutMs: 1000,
      maxRetries: 0,
      minDelayMs: 0,
      apiKey: "test-key",
    });

    const response = await strategy.translate({ text: "hello", targetLanguage: "tr" as never });
    expect(response.translatedText).toBe("tr:hello");

    const stats = await strategy.translateBatch([
      { text: "one", targetLanguage: "tr" as never },
      { text: "two", targetLanguage: "tr" as never },
    ]);
    expect(stats.successCount).toBe(2);
  });
});
