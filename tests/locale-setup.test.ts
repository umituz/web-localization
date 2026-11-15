import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { LocaleFileRepository } from "../src/infrastructure/persistence/locale-file.repository";
import { LocaleSetupService } from "../src/infrastructure/cli/locale-setup.service";
import { NullProgressReporter } from "../src/infrastructure/cli/progress-reporter";
import { InvalidConfigError } from "../src/core/errors";

let projectRoot: string;
let repository: LocaleFileRepository;
const reporter = new NullProgressReporter();

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), "wl-setup-"));
  repository = new LocaleFileRepository({ projectRoot });
});

afterAll(() => {
  rmSync(projectRoot, { recursive: true, force: true });
});

describe("LocaleSetupService", () => {
  it("creates requested stubs, the base file, and regenerates index.ts", async () => {
    const service = new LocaleSetupService(repository, reporter);

    const result = await service.run({
      localesDir: "src/locales",
      baseLang: "en-US",
      languages: ["tr-TR", "de-DE"],
    });

    expect(result.baseFileCreated).toBe(true);
    expect(result.createdLocales).toEqual(["de-DE", "tr-TR"]);
    expect(result.existingLocales).toEqual([]);
    expect(result.indexLanguages).toEqual(["de-DE", "en-US", "tr-TR"]);

    const trContent = readFileSync(join(projectRoot, "src/locales/tr-TR.ts"), "utf-8");
    expect(trContent).toContain("export default {}");

    const indexContent = readFileSync(join(projectRoot, "src/locales/index.ts"), "utf-8");
    expect(indexContent).toContain(`import trTR from "./tr-TR";`);
    expect(indexContent).toContain(`import deDE from "./de-DE";`);
    expect(indexContent).toContain(`import enUS from "./en-US";`);
    expect(indexContent).toContain(`"tr-TR": trTR,`);
    expect(indexContent).toContain("export type TranslationKey = keyof typeof translations;");
  });

  it("skips locales that already exist", async () => {
    const service = new LocaleSetupService(repository, reporter);
    await service.run({ localesDir: "src/locales", baseLang: "en-US", languages: ["tr-TR"] });

    const second = await service.run({
      localesDir: "src/locales",
      baseLang: "en-US",
      languages: ["tr-TR", "de-DE"],
    });

    expect(second.createdLocales).toEqual(["de-DE"]);
    expect(second.existingLocales).toEqual(["tr-TR"]);
    expect(second.baseFileCreated).toBe(false);
  });

  it("rejects unsupported locale codes with InvalidConfigError", async () => {
    const service = new LocaleSetupService(repository, reporter);
    await expect(
      service.run({ localesDir: "src/locales", baseLang: "en-US", languages: ["xx-ZZ"] })
    ).rejects.toThrow(InvalidConfigError);
  });

  it("requires --languages or --all", async () => {
    const service = new LocaleSetupService(repository, reporter);
    await expect(
      service.run({ localesDir: "src/locales", baseLang: "en-US" })
    ).rejects.toThrow(InvalidConfigError);
  });

  it("--all creates every supported locale except redundant English variants", async () => {
    const service = new LocaleSetupService(repository, reporter);
    const result = await service.run({
      localesDir: "src/locales",
      baseLang: "en-US",
      all: true,
    });

    expect(result.createdLocales).toContain("tr-TR");
    expect(result.createdLocales).toContain("zh-CN");
    expect(result.createdLocales).not.toContain("en-GB");
    expect(result.createdLocales).not.toContain("en-AU");
  });

  it("dry-run writes nothing to disk", async () => {
    const service = new LocaleSetupService(repository, reporter);
    const result = await service.run({
      localesDir: "src/locales",
      baseLang: "en-US",
      languages: ["tr-TR"],
      dryRun: true,
    });

    expect(result.createdLocales).toEqual(["tr-TR"]);
    expect(result.indexWritten).toBe(false);
    expect(existsSync(join(projectRoot, "src/locales/tr-TR.ts"))).toBe(false);
    expect(existsSync(join(projectRoot, "src/locales/index.ts"))).toBe(false);
    expect(existsSync(join(projectRoot, "src/locales/en-US.ts"))).toBe(false);
  });
});
