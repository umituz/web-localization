/**
 * Tests for pure calculation functions (public API surface).
 */
import { describe, expect, it } from "vitest";
import {
  applyTextCase,
  buildFlexiblePlaceholderMatcher,
  buildGoogleTranslateUrl,
  buildStrictPlaceholderMatcher,
  buildVariablePlaceholder,
  computeExponentialBackoff,
  computeRateLimitDelay,
  extractIso639Code,
  extractLocaleCodeFromFilename,
  mergeTranslationSegments,
  calculateElapsedMs,
  isWithinTtl,
  isTtlExpired,
  SlidingWindowAverage,
} from "../src/application/calculations";

describe("computeExponentialBackoff", () => {
  it("multiplies the initial delay by the multiplier per attempt", () => {
    expect(
      computeExponentialBackoff({ attempt: 0, initialDelayMs: 2000, multiplier: 2 })
    ).toBe(2000);
    expect(
      computeExponentialBackoff({ attempt: 1, initialDelayMs: 2000, multiplier: 2 })
    ).toBe(4000);
    expect(
      computeExponentialBackoff({ attempt: 2, initialDelayMs: 2000, multiplier: 2 })
    ).toBe(8000);
  });

  it("caps the delay when capMs is provided", () => {
    expect(
      computeExponentialBackoff({
        attempt: 5,
        initialDelayMs: 2000,
        multiplier: 2,
        capMs: 10000,
      })
    ).toBe(10000);
  });
});

describe("buildGoogleTranslateUrl", () => {
  it("builds a URL with encoded query text", () => {
    const url = buildGoogleTranslateUrl({
      apiBaseUrl: "https://translate.googleapis.com/translate_a/single",
      text: "Hello World",
      sourceLanguage: "en",
      targetLanguage: "tr",
    });
    expect(url).toContain("client=gtx");
    expect(url).toContain("sl=en");
    expect(url).toContain("tl=tr");
    expect(url).toContain("dt=t");
    expect(new URL(url).searchParams.get("q")).toBe("Hello World");
  });
});

describe("mergeTranslationSegments", () => {
  it("joins the first element of each segment", () => {
    // Google's data[0] is an array of [translated, original, ...] segments.
    expect(
      mergeTranslationSegments([["Merhaba", null], [" ", null], ["Dünya", null]])
    ).toBe("Merhaba Dünya");
  });

  it("returns empty string for empty input and skips malformed segments", () => {
    expect(mergeTranslationSegments([])).toBe("");
    expect(mergeTranslationSegments([[], [null], [["nested"]]])).toBe("");
    // Non-array segments (defensive shape) are skipped entirely.
    expect(mergeTranslationSegments(["raw string segment"] as never)).toBe("");
  });
});

describe("variable placeholder factory", () => {
  it("round-trips a placeholder through strict matcher", () => {
    const placeholder = buildVariablePlaceholder(3);
    expect(placeholder).toBe("__WL_VAR_3__");
    const matcher = buildStrictPlaceholderMatcher(placeholder);
    expect("x __WL_VAR_3__ y".replace(matcher, "REPLACED")).toBe("x REPLACED y");
  });

  it("flexible matcher tolerates whitespace inserted by translators", () => {
    const matcher = buildFlexiblePlaceholderMatcher(0);
    expect("a __ W L _ VAR _ 0 __ b".replace(matcher, "OK")).toBe("a OK b");
  });
});

describe("applyTextCase", () => {
  it("applies each named case", () => {
    expect(applyTextCase("hello", "uppercase")).toBe("HELLO");
    expect(applyTextCase("HELLO", "lowercase")).toBe("hello");
    expect(applyTextCase("hello", "capitalize")).toBe("Hello");
    expect(applyTextCase("hello world", "titlecase")).toBe("Hello World");
  });

  it("returns input unchanged for unknown or missing format", () => {
    expect(applyTextCase("hello", undefined)).toBe("hello");
    expect(applyTextCase("hello", "")).toBe("hello");
    expect(applyTextCase("hello", "bogus" as never)).toBe("hello");
  });

  it("stringifies non-string values safely", () => {
    expect(applyTextCase(42, "uppercase")).toBe("42");
    expect(applyTextCase(null, "uppercase")).toBe("");
    expect(applyTextCase(undefined, "uppercase")).toBe("");
  });
});

describe("extractIso639Code", () => {
  it("extracts the primary language subtag", () => {
    expect(extractIso639Code("en-US")).toBe("en");
    expect(extractIso639Code("tr")).toBe("tr");
    expect(extractIso639Code("zh-Hans-CN")).toBe("zh");
  });

  it("handles empty input", () => {
    expect(extractIso639Code("")).toBe("");
  });
});

describe("extractLocaleCodeFromFilename", () => {
  it("strips the .ts extension only", () => {
    expect(extractLocaleCodeFromFilename("en-US.ts")).toBe("en-US");
    expect(extractLocaleCodeFromFilename("data.json")).toBe("data.json");
  });
});

describe("computeRateLimitDelay", () => {
  it("returns 0 when the target delay has already elapsed", () => {
    expect(
      computeRateLimitDelay({ elapsedSinceLastRequestMs: 200, targetDelayMs: 100 })
    ).toBe(0);
  });

  it("returns the remaining wait otherwise", () => {
    expect(
      computeRateLimitDelay({ elapsedSinceLastRequestMs: 40, targetDelayMs: 100 })
    ).toBe(60);
  });
});

describe("SlidingWindowAverage", () => {
  it("averages samples and drops the oldest beyond capacity", () => {
    const window = new SlidingWindowAverage(3);
    window.add(10);
    window.add(20);
    window.add(30);
    expect(window.average()).toBe(20);
    window.add(40); // drops 10
    expect(window.average()).toBe(30);
  });

  it("rejects invalid construction", () => {
    expect(() => new SlidingWindowAverage(0)).toThrow();
  });
});

describe("elapsed / TTL calculators", () => {
  it("calculateElapsedMs clamps clock skew to 0", () => {
    expect(calculateElapsedMs(1000, 999)).toBe(0);
    expect(calculateElapsedMs(1000, 1050)).toBe(50);
    expect(calculateElapsedMs(Number.NaN, 10)).toBe(0);
  });

  it("isWithinTtl / isTtlExpired agree and reject non-positive ttl", () => {
    expect(isWithinTtl(1000, 500, 1200)).toBe(true);
    expect(isWithinTtl(1000, 100, 1200)).toBe(false);
    expect(isTtlExpired(1000, 100, 1200)).toBe(true);
    expect(isWithinTtl(1000, 0)).toBe(false);
  });
});
