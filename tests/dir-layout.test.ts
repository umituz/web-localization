import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { LocaleFileRepository } from "../src/infrastructure/persistence/locale-file.repository";
import { LocaleSyncService } from "../src/infrastructure/cli/locale-sync.service";
import { LocaleTranslateService } from "../src/infrastructure/cli/locale-translate.service";
import { NullProgressReporter } from "../src/infrastructure/cli/progress-reporter";
import { VariableProtector } from "../src/application/services/variable-protector";
import {
  isOpaqueExpression,
  opaqueExpressionSource,
} from "../src/application/services/opaque-expression";
import type { ITranslationStrategy } from "../src/domain/interfaces/translation-service.interface";
import { TranslationStats } from "../src/domain/entities/translation.entity";
import { ObjectTreeWalker } from "../src/application/services/object-flattener";

let projectRoot: string;
let repository: LocaleFileRepository;
const reporter = new NullProgressReporter();

function writeDomain(lang: string, file: string, content: string): void {
  const dir = join(projectRoot, "src/locales", lang);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, file), content);
}

function readDomain(lang: string, file: string): string {
  return readFileSync(join(projectRoot, "src/locales", lang, file), "utf-8");
}

function domainExists(lang: string, file: string): boolean {
  try {
    readFileSync(join(projectRoot, "src/locales", lang, file));
    return true;
  } catch {
    return false;
  }
}

const EN_SHELL = `import { BRAND } from '@/brand'

export default {
  sidebar: {
    tagline: BRAND.tagline.en,
  },
  topbar: {
    searchPlaceholder: 'Search lessons…',
    legal: \`These terms govern your use of \${BRAND.name}. By continuing you accept them.\`,
  },
}
`;

const EN_CATALOG = `export default {
  catalog: {
    title: 'Catalog',
    empty: 'No results yet',
  },
}
`;

const EN_VOCABULARY = `const meanings: Record<string, string> = {}

export default {
  vocabulary: {
    title: 'Vocabulary',
    meanings,
  },
}
`;

const TR_SHELL = `import { BRAND } from '@/brand'

export default {
  sidebar: {
    tagline: BRAND.tagline.tr,
  },
  topbar: {
    searchPlaceholder: 'Ders ara…',
  },
}
`;

const TR_CATALOG = `export default {
  catalog: {
    title: 'Katalog',
  },
}
`;

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), "wl-dir-"));
  repository = new LocaleFileRepository({ projectRoot });
  writeDomain("en", "shell.ts", EN_SHELL);
  writeDomain("en", "catalog.ts", EN_CATALOG);
  writeDomain("en", "vocabulary.ts", EN_VOCABULARY);
  writeDomain("en", "index.ts", `import shell from './shell'

const en = { ...shell }
export default en
`);
  writeDomain("tr", "shell.ts", TR_SHELL);
  writeDomain("tr", "catalog.ts", TR_CATALOG);
  writeDomain("tr", "index.ts", `import shell from './shell'

const tr = { ...shell }
export default tr
`);
});

afterAll(() => {
  rmSync(projectRoot, { recursive: true, force: true });
});

describe("LocaleFileRepository — directory layout", () => {
  it("lists both flat files and language directories", async () => {
    writeFileSync(join(projectRoot, "src/locales/de-DE.ts"), "export default {}");
    const locales = await repository.listLocales("src/locales");
    expect(locales).toEqual(["de-DE", "en", "tr"]);
  });

  it("ignores directories without ts files", async () => {
    mkdirSync(join(projectRoot, "src/locales/assets"), { recursive: true });
    const locales = await repository.listLocales("src/locales");
    expect(locales).toEqual(["en", "tr"]);
  });

  it("resolves flat files first and falls back to directories", async () => {
    expect(repository.resolveLocalePath("src/locales", "en")).toBe(
      join(projectRoot, "src/locales/en")
    );
    expect(repository.resolveLocalePath("src/locales", "xx-XX")).toBe(
      join(projectRoot, "src/locales/xx-XX.ts")
    );
  });

  it("merges domain files and preserves expressions and templates", async () => {
    const data = await repository.read(join(projectRoot, "src/locales/en"));
    expect(data).toMatchObject({
      sidebar: { tagline: expect.any(String) },
      topbar: {
        searchPlaceholder: "Search lessons…",
        legal: "These terms govern your use of ${BRAND.name}. By continuing you accept them.",
      },
      catalog: { title: "Catalog", empty: "No results yet" },
      vocabulary: { title: "Vocabulary", meanings: expect.any(String) },
    });
    expect(isOpaqueExpression((data.sidebar as Record<string, unknown>).tagline)).toBe(true);
    expect(opaqueExpressionSource((data.sidebar as Record<string, unknown>).tagline)).toBe(
      "BRAND.tagline.en"
    );
    const vocab = data.vocabulary as Record<string, unknown>;
    expect(isOpaqueExpression(vocab.meanings)).toBe(true);
  });

  it("rewrites changed domains in TypeScript style and preserves untouched files", async () => {
    const data = (await repository.read(join(projectRoot, "src/locales/en")))!;
    const vocabBefore = readDomain("en", "vocabulary.ts");
    const indexBefore = readDomain("en", "index.ts");

    const topbar = data.topbar as Record<string, unknown>;
    topbar.searchPlaceholder = "Search lessons, words, grammar";
    delete (data.catalog as Record<string, unknown>).empty;

    const outcome = await repository.write(join(projectRoot, "src/locales/en"), data, "en");

    expect(outcome.createdFiles).toEqual([]);
    const shell = readDomain("en", "shell.ts");
    expect(shell).toContain("tagline: BRAND.tagline.en,");
    expect(shell).toContain(
      "legal: `These terms govern your use of ${BRAND.name}. By continuing you accept them.`,"
    );
    expect(shell).toContain("searchPlaceholder: 'Search lessons, words, grammar',");
    expect(shell).not.toContain("Generated by");
    expect(readDomain("en", "catalog.ts")).not.toContain("empty");
    expect(readDomain("en", "vocabulary.ts")).toBe(vocabBefore);
    expect(readDomain("en", "index.ts")).toBe(indexBefore);
  });

  it("creates domain files for keys without a home and reports them", async () => {
    const data = (await repository.read(join(projectRoot, "src/locales/en")))!;
    data.game = { title: "Games" };

    const outcome = await repository.write(join(projectRoot, "src/locales/en"), data, "en");

    expect(outcome.createdFiles).toEqual([join(projectRoot, "src/locales/en/game.ts")]);
    expect(readDomain("en", "game.ts")).toBe(`export default {
  game: {
    title: 'Games',
  },
}
`);
  });

  it("never overwrites an existing domain file when a key shadows its name", async () => {
    const data = (await repository.read(join(projectRoot, "src/locales/en")))!;
    data.shell = { topbar: { smoke: "" } };

    const outcome = await repository.write(join(projectRoot, "src/locales/en"), data, "en");

    expect(outcome.createdFiles).toEqual([]);
    const shell = readDomain("en", "shell.ts");
    expect(shell).toContain("tagline: BRAND.tagline.en,");
    expect(shell).toContain("topbar: {");
    expect(shell).toContain("shell: {");
    expect(shell).toContain("smoke: ''");

    repository.clearCache();
    const reread = await repository.read(join(projectRoot, "src/locales/en"));
    expect((reread as Record<string, unknown>).shell).toEqual({ topbar: { smoke: "" } });
    expect(reread!.topbar).toBeDefined();
  });

  it("preserves the preamble (imports, local consts) when rewriting a domain", async () => {
    const data = (await repository.read(join(projectRoot, "src/locales/en")))!;
    (data.vocabulary as Record<string, unknown>).newKey = "Fresh";

    await repository.write(join(projectRoot, "src/locales/en"), data, "en");

    const vocabulary = readDomain("en", "vocabulary.ts");
    expect(vocabulary.startsWith("const meanings: Record<string, string> = {}")).toBe(true);
    expect(vocabulary).toContain("meanings: meanings,");
    expect(vocabulary).toContain("newKey: 'Fresh',");

    const shell = readDomain("en", "shell.ts");
    expect(shell.startsWith("import { BRAND } from '@/brand'")).toBe(true);
  });

  it("round-trips serialized output back through the parser", async () => {
    const data = (await repository.read(join(projectRoot, "src/locales/en")))!;
    const outcome = await repository.write(join(projectRoot, "src/locales/en"), data, "en");
    expect(outcome.createdFiles).toEqual([]);

    repository.clearCache();
    const reread = await repository.read(join(projectRoot, "src/locales/en"));
    expect(reread).toEqual(data);
  });
});

describe("LocaleSyncService — directory layout", () => {
  it("syncs missing keys into the owning target domain file", async () => {
    const service = new LocaleSyncService(repository, reporter);

    const result = await service.run({ localesDir: "src/locales", baseLang: "en" });

    expect(result.languagesSucceeded).toBe(1);
    expect(result.results[0]).toMatchObject({ language: "tr", keysAdded: 4, success: true });

    const trShell = readDomain("tr", "shell.ts");
    expect(trShell).toContain("tagline: BRAND.tagline.tr,");
    expect(trShell).toContain("legal: ''");
    const trCatalog = readDomain("tr", "catalog.ts");
    expect(trCatalog).toContain("empty: ''");
    const trVocabulary = readDomain("tr", "vocabulary.ts");
    expect(trVocabulary).toContain("title: ''");
  });

  it("propagates new base domains as files and warns about barrels", async () => {
    writeDomain(
      "en",
      "game.ts",
      `export default {
  game: {
    title: 'Games',
  },
}
`
    );
    const service = new LocaleSyncService(repository, reporter);

    const result = await service.run({ localesDir: "src/locales", baseLang: "en" });

    expect(result.languagesSucceeded).toBe(1);
    expect(domainExists("tr", "game.ts")).toBe(true);
    expect(readDomain("tr", "game.ts")).toContain("game: {");
  });

  it("prunes removed keys from every domain file", async () => {
    const service = new LocaleSyncService(repository, reporter);

    writeFileSync(
      join(projectRoot, "src/app.tsx"),
      `const a = t("catalog.title");\nconst b = t("topbar.searchPlaceholder");\n`
    );

    await service.run({
      localesDir: "src/locales",
      baseLang: "en",
      srcDir: "src",
      prune: true,
    });

    expect(readDomain("en", "catalog.ts")).toContain("title: 'Catalog'");
    expect(readDomain("en", "catalog.ts")).not.toContain("empty");
    const shell = readDomain("en", "shell.ts");
    expect(shell).toContain("searchPlaceholder: 'Search lessons…'");
    expect(shell).not.toContain("legal");
    expect(shell).not.toContain("tagline");
  });
});

function makeEchoStrategy(): ITranslationStrategy {
  return {
    name: "echo",
    async translate(request) {
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
        stats = stats.withSuccess({
          key: request.text,
          from: request.text,
          to: `${request.text}!`,
        });
      }
      return stats;
    },
    async translateObject(context) {
      const walker = new ObjectTreeWalker();
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
}

describe("LocaleTranslateService — directory layout", () => {
  it("translates empty leaves, keeps expressions, writes the owning domain", async () => {
    const service = new LocaleTranslateService(repository, makeEchoStrategy(), reporter);

    const result = await service.run({ localesDir: "src/locales", baseLang: "en" });

    expect(result.languagesSucceeded).toBe(1);
    expect(result.totalKeysTranslated).toBeGreaterThan(0);

    const trShell = readDomain("tr", "shell.ts");
    expect(trShell).toContain("tagline: BRAND.tagline.tr,");
    const trCatalog = readDomain("tr", "catalog.ts");
    expect(trCatalog).toContain("empty: 'No results yet!'");
  });

  it("does not translate opaque expressions even with force", async () => {
    const service = new LocaleTranslateService(repository, makeEchoStrategy(), reporter);

    await service.run({ localesDir: "src/locales", baseLang: "en", force: true });

    expect(readDomain("tr", "shell.ts")).toContain("tagline: BRAND.tagline.tr,");
    expect(readDomain("tr", "shell.ts")).not.toContain("tagline: '");
  });
});

describe("VariableProtector — template interpolation", () => {
  const protector = new VariableProtector();

  it("protects and restores ${...} interpolations", () => {
    const original = "These terms govern your use of ${BRAND.name}. {{count}} rules apply.";
    const { safeText, placeholders } = protector.protect(original);

    expect(safeText).not.toContain("${BRAND.name}");
    expect(safeText).not.toContain("{{count}}");

    const restored = protector.restore(safeText, placeholders);
    expect(restored).toBe(original);
  });

  it("restores placeholders even when google reorders them", () => {
    const original = "${BRAND.name} — {{plan}} plan";
    const { safeText, placeholders } = protector.protect(original);

    const reordered = safeText.split(" — ").reverse().join(" — ");
    const restored = protector.restore(reordered, placeholders);
    expect(restored).toBe("{{plan}} plan — ${BRAND.name}");
  });
});
