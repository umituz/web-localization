import { describe, expect, it } from "vitest";
import {
  assertPathWithinProjectRoot,
  assertConfigFieldShape,
  assertFileSizeWithinBound,
  assertNotAborted,
  evaluateTextEligibility,
  isAborted,
  isLocaleFilename,
  isNetworkLevelFailure,
  isRetryableHttpStatus,
} from "../src/application/validations";
import {
  InvalidConfigError,
  LocaleFileSizeError,
  PathTraversalError,
  TranslationAbortedError,
} from "../src/core/errors";

describe("assertPathWithinProjectRoot", () => {
  const root = "/tmp/project";

  it("resolves and returns the absolute path for in-root paths", () => {
    expect(assertPathWithinProjectRoot({ requestedPath: "src/locales/en.ts", projectRoot: root })).toBe(
      "/tmp/project/src/locales/en.ts"
    );
  });

  it("rejects traversal outside the root", () => {
    expect(() =>
      assertPathWithinProjectRoot({ requestedPath: "../../etc/passwd", projectRoot: root })
    ).toThrow(PathTraversalError);
  });

  it("rejects absolute paths outside the root", () => {
    expect(() =>
      assertPathWithinProjectRoot({ requestedPath: "/etc/passwd", projectRoot: root })
    ).toThrow(PathTraversalError);
  });

  it("allows the root itself", () => {
    expect(assertPathWithinProjectRoot({ requestedPath: ".", projectRoot: root })).toBe(root);
  });
});

describe("evaluateTextEligibility", () => {
  it("rejects non-strings, blank strings and pure numbers", () => {
    expect(evaluateTextEligibility({ value: 42 }).isTranslatable).toBe(false);
    expect(evaluateTextEligibility({ value: "   " }).isTranslatable).toBe(false);
    expect(evaluateTextEligibility({ value: "123" }).isTranslatable).toBe(false);
    expect(evaluateTextEligibility({ value: "hello" }).isTranslatable).toBe(true);
  });

  it("skips texts containing skip-list entries", () => {
    expect(evaluateTextEligibility({ value: "Built by @umituz" }).shouldSkip).toBe(true);
    expect(evaluateTextEligibility({ value: "hello" }).shouldSkip).toBe(false);
    expect(evaluateTextEligibility({ value: "hello", skipList: [] }).shouldSkip).toBe(false);
  });

  it("needs translation only when the target is missing or empty", () => {
    expect(evaluateTextEligibility({ value: "x", targetValue: undefined }).needsTranslation).toBe(true);
    expect(evaluateTextEligibility({ value: "x", targetValue: "" }).needsTranslation).toBe(true);
    expect(evaluateTextEligibility({ value: "x", targetValue: "vorhanden" }).needsTranslation).toBe(false);
  });
});

describe("HTTP status retryability", () => {
  it("retries 429 and 5xx only", () => {
    expect(isRetryableHttpStatus(429)).toBe(true);
    expect(isRetryableHttpStatus(500)).toBe(true);
    expect(isRetryableHttpStatus(503)).toBe(true);
    expect(isRetryableHttpStatus(400)).toBe(false);
    expect(isRetryableHttpStatus(404)).toBe(false);
    expect(isRetryableHttpStatus(99)).toBe(false);
    expect(isRetryableHttpStatus(200.5)).toBe(false);
  });

  it("treats status 0 as a network-level failure", () => {
    expect(isNetworkLevelFailure(0)).toBe(true);
    expect(isNetworkLevelFailure(500)).toBe(false);
  });
});

describe("assertFileSizeWithinBound", () => {
  it("throws LocaleFileSizeError beyond the bound", () => {
    expect(() =>
      assertFileSizeWithinBound({ filePath: "a.ts", actualSizeBytes: 11, maxSizeBytes: 10 })
    ).toThrow(LocaleFileSizeError);
    expect(() =>
      assertFileSizeWithinBound({ filePath: "a.ts", actualSizeBytes: 10, maxSizeBytes: 10 })
    ).not.toThrow();
  });
});

describe("assertConfigFieldShape", () => {
  it("validates each primitive type", () => {
    expect(() => assertConfigFieldShape({ fieldName: "a", value: "x", expectedType: "string" })).not.toThrow();
    expect(() => assertConfigFieldShape({ fieldName: "a", value: "", expectedType: "string" })).toThrow(InvalidConfigError);
    expect(() => assertConfigFieldShape({ fieldName: "a", value: 1.5, expectedType: "integer" })).toThrow(InvalidConfigError);
    expect(() => assertConfigFieldShape({ fieldName: "a", value: 1.5, expectedType: "number" })).not.toThrow();
    expect(() => assertConfigFieldShape({ fieldName: "a", value: true, expectedType: "boolean" })).not.toThrow();
  });

  it("enforces bounds and null policy", () => {
    expect(() =>
      assertConfigFieldShape({ fieldName: "n", value: 5, expectedType: "integer", minValue: 1, maxValue: 3 })
    ).toThrow(InvalidConfigError);
    expect(() =>
      assertConfigFieldShape({ fieldName: "n", value: null, expectedType: "string", allowNull: true })
    ).not.toThrow();
    expect(() =>
      assertConfigFieldShape({ fieldName: "n", value: null, expectedType: "string" })
    ).toThrow(InvalidConfigError);
  });
});

describe("abort-signal state", () => {
  it("assertNotAborted throws TranslationAbortedError only when aborted", () => {
    const controller = new AbortController();
    expect(() => assertNotAborted(controller.signal)).not.toThrow();
    controller.abort();
    expect(() => assertNotAborted(controller.signal)).toThrow(TranslationAbortedError);
  });

  it("isAborted handles undefined signals", () => {
    expect(isAborted(undefined)).toBe(false);
  });
});

describe("isLocaleFilename", () => {
  it("accepts ll.ts and ll-CC.ts shapes", () => {
    expect(isLocaleFilename("en.ts")).toBe(true);
    expect(isLocaleFilename("en-US.ts")).toBe(true);
    expect(isLocaleFilename("EN-us.ts")).toBe(false);
    expect(isLocaleFilename("en_US.ts")).toBe(false);
    expect(isLocaleFilename("en-US.json")).toBe(false);
    expect(isLocaleFilename("")).toBe(false);
  });
});
