import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { LocaleFileRepository } from "../src/infrastructure/persistence/locale-file.repository";
import { LocaleSyncService } from "../src/infrastructure/cli/locale-sync.service";
import { LocaleTranslateService } from "../src/infrastructure/cli/locale-translate.service";
import {
  NullProgressReporter,
} from "../src/infrastructure/cli/progress-reporter";
import { LocaleFileNotFoundError } from "../src/core/errors";
import type { ITranslationStrategy } from "../src/domain/interfaces/translation-service.interface";
import { TranslationStats } from "../src/domain/entities/translation.entity";
import { ProgressEmitter, NullProgressEmitter } from "../src/core/utils/progress-emitter";

let projectRoot: string;
let repository: LocaleFileRepository;
const reporter = new NullProgressReporter();

function makeEchoStrategy() {
  const calls: Array<Record<string, unknown>> = [];
  const strategy: ITranslationStrategy = {
    name: "echo",
    async translate(request) {
      calls.push({ op: "translate", request });
      return {
        originalText: request.text,
        translatedText: `${request.text}!`,
        sourceLanguage: request.sourceLanguage ?? "en",
        targetLanguage: request.targetLanguage,
        success: true,
      };
    },
    async translateBatch(requests) {
      let stats = TranslationStats.initial(requests.length);
      for (const request of requests) {
        stats = stats.withSuccess({ key: request.text, from: request.text, to: `${request.text}!` });
      }
      return stats;
    },
    async translateObject(context) {
      const walker = new (await import("../src/application/services/object-flattener"))
        .ObjectTreeWalker();
      const leaves = walker.collectLeaves(
        context.source,
        context.target,
        "",
        context.targetLanguage,
        context.force ?? false
      );
      const translations = new Map(leaves.map((leaf) => [leaf.text, `${leaf.text}!`]));
      return walker.applyTranslations(
        context.target,
        leaves,
        translations,
        context.onProgress,
        TranslationStats.initial(leaves.length)
      );
    },
    clearCache() {},
    getCacheStats() {
      return { size: 0, maxSize: 1000 };
    },
    dispose() {},
  };
  return { strategy, calls };
}

function writeLocale(name: string, content: string): void {
  mkdirSync(join(projectRoot, "src/locales"), { recursive: true });
  writeFileSync(join(projectRoot, "src/locales", name), content);
}

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), "wl-cli-"));
  repository = new LocaleFileRepository({ projectRoot });
  writeLocale("en-US.ts", `export default { nav: { home: "Home" }, cta: "Go" };`);
});

afterAll(() => {
  rmSync(projectRoot, { recursive: true, force: true });
});

describe("LocaleSyncService", () => {
  it("syncs structure from base to targets and reports the diff", async () => {
    writeLocale("tr-TR.ts", `export default { nav: { home: "Ana Sayfa" }, stale: "x" };`);
    const service = new LocaleSyncService(repository, reporter);

    const result = await service.run({ localesDir: "src/locales", baseLang: "en-US" });
    expect(result.languagesSucceeded).toBe(1);
    expect(result.results[0]).toMatchObject({ language: "tr-TR", keysAdded: 1, keysRemoved: 1, success: true });

    const synced = JSON.parse(
      readFileSync(join(projectRoot, "src/locales/tr-TR.ts"), "utf-8").replace(
        /^[\s\S]*?export default /,
        ""
      ).replace(/;\s*$/, "")
    );
    expect(synced).toEqual({ nav: { home: "Ana Sayfa" }, cta: "" });
  });

  it("does not write in dry-run mode", async () => {
    writeLocale("tr-TR.ts", `export default { nav: { home: "Ana Sayfa" } };`);
    const before = readFileSync(join(projectRoot, "src/locales/tr-TR.ts"), "utf-8");
    const service = new LocaleSyncService(repository, reporter);

    await service.run({ localesDir: "src/locales", baseLang: "en-US", dryRun: true });
    expect(readFileSync(join(projectRoot, "src/locales/tr-TR.ts"), "utf-8")).toBe(before);
  });

  it("filters to requested languages", async () => {
    writeLocale("tr-TR.ts", `export default {};`);
    writeLocale("de-DE.ts", `export default {};`);
    const service = new LocaleSyncService(repository, reporter);

    const result = await service.run({
      localesDir: "src/locales",
      baseLang: "en-US",
      languages: ["tr-TR"],
    });
    expect(result.languagesProcessed).toBe(1);
    expect(result.results[0]?.language).toBe("tr-TR");
  });

  it("throws typed LocaleFileNotFoundError for a missing base file", async () => {
    const service = new LocaleSyncService(repository, reporter);
    await expect(
      service.run({ localesDir: "src/locales", baseLang: "xx-XX" })
    ).rejects.toThrow(LocaleFileNotFoundError);
  });
});

describe("LocaleTranslateService", () => {
  it("translates empty keys and writes the target file", async () => {
    writeLocale("tr-TR.ts", `export default { nav: { home: "Ana Sayfa" }, cta: "" };`);
    const { strategy } = makeEchoStrategy();
    const service = new LocaleTranslateService(repository, strategy, reporter);

    const result = await service.run({ localesDir: "src/locales", baseLang: "en-US" });
    expect(result.languagesSucceeded).toBe(1);
    expect(result.totalKeysTranslated).toBe(1);

    const written = readFileSync(join(projectRoot, "src/locales/tr-TR.ts"), "utf-8");
    expect(written).toContain("Go!");
    expect(written).toContain("Ana Sayfa");
  });

  it("dry-run performs no writes", async () => {
    writeLocale("tr-TR.ts", `export default { nav: { home: "" } };`);
    const before = readFileSync(join(projectRoot, "src/locales/tr-TR.ts"), "utf-8");
    const { strategy } = makeEchoStrategy();
    const service = new LocaleTranslateService(repository, strategy, reporter);

    const result = await service.run({ localesDir: "src/locales", baseLang: "en-US", dryRun: true });

    expect(result.totalKeysTranslated).toBe(2);
    expect(readFileSync(join(projectRoot, "src/locales/tr-TR.ts"), "utf-8")).toBe(before);
  });

  it("respects maxKeys per language", async () => {
    writeLocale("tr-TR.ts", `export default { nav: { home: "" }, cta: "" };`);
    const { strategy } = makeEchoStrategy();
    const service = new LocaleTranslateService(repository, strategy, reporter);

    const result = await service.run({
      localesDir: "src/locales",
      baseLang: "en-US",
      maxKeys: 1,
    });
    expect(result.totalKeysTranslated).toBeLessThanOrEqual(1);
  });

  it("counts a language as failed when the strategy throws", async () => {
    writeLocale("tr-TR.ts", `export default { nav: { home: "" } };`);
    const failing: ITranslationStrategy = {
      ...(makeEchoStrategy().strategy),
      async translateObject() {
        throw new Error("provider down");
      },
    };
    const service = new LocaleTranslateService(repository, failing, reporter);
    const result = await service.run({ localesDir: "src/locales", baseLang: "en-US" });
    expect(result.languagesFailed).toBe(1);
    expect(result.languagesSucceeded).toBe(0);
  });

  it("throws typed LocaleFileNotFoundError for a missing base file", async () => {
    const { strategy } = makeEchoStrategy();
    const service = new LocaleTranslateService(repository, strategy, reporter);
    await expect(
      service.run({ localesDir: "src/locales", baseLang: "xx-XX" })
    ).rejects.toThrow(LocaleFileNotFoundError);
  });
});

describe("ProgressEmitter", () => {
  it("dispatches typed events and supports unsubscribe", () => {
    const emitter = new ProgressEmitter();
    const seen: string[] = [];
    const off = emitter.on("keyTranslated", (event) => seen.push(`${event.path}:${event.to}`));

    emitter.emit({ type: "start", totalLanguages: 2 });
    emitter.emit({
      type: "keyTranslated",
      language: "tr",
      path: "a",
      from: "x",
      to: "y",
    });
    off();
    emitter.emit({
      type: "keyTranslated",
      language: "tr",
      path: "b",
      from: "x",
      to: "z",
    });

    expect(seen).toEqual(["a:y"]);
    expect(emitter.listenerCount()).toBe(0);
  });

  it("isolates listener exceptions", () => {
    const emitter = new ProgressEmitter();
    emitter.on("error", () => {
      throw new Error("listener bug");
    });
    expect(() =>
      emitter.emit({ type: "error", error: new Error("original") })
    ).not.toThrow();
  });

  it("NullProgressEmitter swallows events", () => {
    const emitter = new NullProgressEmitter();
    expect(() =>
      emitter.emit({ type: "start", totalLanguages: 1 })
    ).not.toThrow();
  });
});
