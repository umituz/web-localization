/**
 * Tests for translation application services:
 * TranslationCache, VariableProtector, TextValidator, ObjectTreeWalker,
 * TranslationStats.
 */
import { describe, expect, it } from "vitest";
import { TranslationCache } from "../src/application/services/translation-cache";
import { VariableProtector } from "../src/application/services/variable-protector";
import { TextValidator } from "../src/application/services/text-validator";
import { ObjectTreeWalker } from "../src/application/services/object-flattener";
import { TranslationStats } from "../src/domain/entities/translation.entity";

describe("TranslationCache", () => {
  it("keys entries by source|target|text", () => {
    const cache = new TranslationCache();
    cache.set({ source: "en", target: "tr", text: "hi" }, "merhaba");
    expect(cache.get({ source: "en", target: "tr", text: "hi" })).toBe("merhaba");
    expect(cache.get({ source: "en", target: "de", text: "hi" })).toBeNull();
    expect(cache.has({ source: "en", target: "tr", text: "hi" })).toBe(true);
    cache.clear();
    expect(cache.get({ source: "en", target: "tr", text: "hi" })).toBeNull();
  });

  it("returns null (not undefined) for misses to match the public contract", () => {
    const cache = new TranslationCache();
    expect(cache.get({ source: "en", target: "tr", text: "missing" })).toBeNull();
  });
});

describe("VariableProtector", () => {
  const protector = new VariableProtector();

  it("protects {{placeholders}} and restores them after translation", () => {
    const { safeText, placeholders } = protector.protect("Hello {{name}}, you have {{count}} items");
    expect(safeText).not.toContain("{{name}}");
    expect(safeText).not.toContain("{{count}}");
    expect(placeholders.size).toBe(2);

    const restored = protector.restore("Merhaba __WL_VAR_0__, __WL_VAR_1__ öğen var", placeholders);
    expect(restored).toBe("Merhaba {{name}}, {{count}} öğen var");
  });

  it("leaves text without placeholders untouched", () => {
    const { safeText, placeholders } = protector.protect("plain text");
    expect(safeText).toBe("plain text");
    expect(placeholders.size).toBe(0);
    expect(protector.restore("translated", placeholders)).toBe("translated");
  });

  it("restores placeholders split by translator whitespace", () => {
    const { placeholders } = protector.protect("{{name}}");
    expect(protector.restore("__ WL _ VAR _ 0 __", placeholders)).toBe("{{name}}");
  });
});

describe("TextValidator", () => {
  const validator = new TextValidator();

  it("isTranslatable narrows to real, non-numeric strings", () => {
    expect(validator.isTranslatable("hello")).toBe(true);
    expect(validator.isTranslatable(123)).toBe(false);
    expect(validator.isTranslatable("")).toBe(false);
    expect(validator.isTranslatable("42")).toBe(false);
  });

  it("shouldSkip honors the configurable skip list", () => {
    expect(validator.shouldSkip("Powered by @umituz")).toBe(true);
    const custom = new TextValidator(["AcmeCorp"]);
    expect(custom.shouldSkip("AcmeCorp Suite")).toBe(true);
    expect(custom.shouldSkip("Powered by @umituz")).toBe(false);
  });

  it("needsTranslation only for missing/empty targets", () => {
    expect(validator.needsTranslation("")).toBe(true);
    expect(validator.needsTranslation(undefined)).toBe(true);
    expect(validator.needsTranslation("existing")).toBe(false);
  });
});

describe("ObjectTreeWalker", () => {
  const walker = new ObjectTreeWalker();

  it("collects leaf strings needing translation from nested structures", () => {
    const source = {
      nav: { home: "Home", nested: { deep: "Deep" } },
      count: 5,
      skip: true,
    };
    const target = { nav: { home: "Ana Sayfa" } }; // home already translated
    const leaves = walker.collectLeaves(source, target, "", "tr" as never, false);

    // Only the untranslated nested leaf is collected; home is done, and
    // non-strings (count, skip) are ignored.
    expect(leaves.map((l) => l.path)).toEqual(["nav.nested.deep"]);
  });

  it("collects everything when force is true", () => {
    const source = { a: "x", b: "y" };
    const target = { a: "translated", b: "done" };
    const leaves = walker.collectLeaves(source, target, "", "tr" as never, true);
    expect(leaves).toHaveLength(2);
  });

  it("applyTranslations writes into the target tree and reports stats", () => {
    const source = { a: "hello", b: "world" };
    const target: Record<string, unknown> = {};
    const leaves = walker.collectLeaves(source, target, "", "tr" as never, false);

    const translations = new Map([["hello", "merhaba"]]);
    const progressed: string[] = [];
    const stats = walker.applyTranslations(
      target,
      leaves,
      translations,
      (path) => progressed.push(path),
      TranslationStats.initial(leaves.length)
    );

    expect(target.a).toBe("merhaba");
    expect(stats.successCount).toBe(1);
    expect(stats.failureCount).toBe(1); // "world" had no translation
    expect(progressed).toEqual(["a"]);
  });
});

describe("TranslationStats", () => {
  it("is immutable and validates counts", () => {
    const stats = TranslationStats.initial(3);
    const next = stats.withSuccess({ key: "a", from: "x", to: "y" });
    expect(stats.successCount).toBe(0);
    expect(next.successCount).toBe(1);
    expect(next.translatedKeys).toEqual([{ key: "a", from: "x", to: "y" }]);
    expect(next.processedCount).toBe(1);
  });

  it("merges two stats", () => {
    const a = TranslationStats.initial(2).withSuccess({ key: "a", from: "x", to: "y" });
    const b = TranslationStats.initial(2).withSkip().withFailure();
    const merged = a.merge(b);
    expect(merged.successCount).toBe(1);
    expect(merged.skippedCount).toBe(1);
    expect(merged.failureCount).toBe(1);
    expect(merged.translatedKeys).toHaveLength(1);
  });

  it("empty() starts at zero", () => {
    expect(TranslationStats.empty().totalCount).toBe(0);
  });
});
