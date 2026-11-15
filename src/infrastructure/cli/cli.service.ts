import { LocaleFileRepository } from "../persistence/locale-file.repository";
import { googleTranslateService } from "../../application/strategies/google-translate.strategy";
import { LocaleSyncService, type SyncCommandOptions } from "./locale-sync.service";
import { LocaleTranslateService, type TranslateCommandOptions } from "./locale-translate.service";
import {
  LocaleSetupService,
  type SetupCommandOptions,
} from "./locale-setup.service";
import { ConsoleProgressReporter } from "./progress-reporter";

export type SyncOptions = SyncCommandOptions;
export type TranslateOptions = TranslateCommandOptions;
export type SetupOptions = SetupCommandOptions;

class CLIService {
  private readonly repository: LocaleFileRepository;
  private readonly reporter = new ConsoleProgressReporter();

  constructor() {
    this.repository = new LocaleFileRepository({ projectRoot: process.cwd() });
  }

  async sync(options: SyncOptions): Promise<void> {
    const service = new LocaleSyncService(this.repository, this.reporter);
    const result = await service.run(options);
    this.reporter.header("Sync Summary");
    this.reporter.data(
      `Languages:  ${result.languagesSucceeded}/${result.languagesProcessed} succeeded, ${result.languagesFailed} failed`
    );
    const totalAdded = result.results.reduce((sum, r) => sum + r.keysAdded, 0);
    const totalRemoved = result.results.reduce((sum, r) => sum + r.keysRemoved, 0);
    this.reporter.data(`Keys:       +${totalAdded} added, -${totalRemoved} removed`);
    if (result.sourceScan) {
      const scan = result.sourceScan;
      this.reporter.data(
        `Source:     ${scan.usedKeyCount} keys referenced; base +${scan.keysAddedToBase.length} added, -${scan.keysPrunedFromBase.length} pruned, ${scan.unusedKeys.length} unused`
      );
    }
    if (options.dryRun) this.reporter.warning("Dry run — no files were modified.");
  }

  async setup(options: SetupOptions): Promise<void> {
    const service = new LocaleSetupService(this.repository, this.reporter);
    const result = await service.run(options);

    this.reporter.header("Setup Summary");
    this.reporter.data(
      `Created:    ${result.createdLocales.join(", ") || "none"}${result.baseFileCreated ? ` (+ base ${options.baseLang})` : ""}`
    );
    this.reporter.data(`Existing:   ${result.existingLocales.join(", ") || "none"}`);
    this.reporter.data(`Index:      ${result.indexLanguages.length} languages`);
    if (options.dryRun) this.reporter.warning("Dry run — no files were modified.");
  }

  async translate(options: TranslateOptions): Promise<void> {
    if (process.env.GOOGLE_TRANSLATE_API_KEY) {
      this.reporter.info(
        "GOOGLE_TRANSLATE_API_KEY detected — using the official Cloud Translation API (key-quota, no IP throttling)."
      );
    }
    if (options.syncFirst) {
      const syncService = new LocaleSyncService(this.repository, this.reporter);
      await syncService.run({
        localesDir: options.localesDir,
        baseLang: options.baseLang,
        concurrency: options.concurrency,
        dryRun: options.dryRun,
      });
    }
    const service = new LocaleTranslateService(
      this.repository,
      googleTranslateService,
      this.reporter
    );
    const result = await service.run(options);

    this.reporter.header("Translation Summary");
    this.reporter.data(
      `Languages:    ${result.languagesSucceeded}/${result.languagesProcessed} succeeded`
    );
    this.reporter.data(`Translated:   ${result.totalKeysTranslated} keys`);
    this.reporter.data(`Failed:       ${result.totalKeysFailed} keys`);
    this.reporter.data(`Skipped:      ${result.totalKeysSkipped} keys`);
    this.reporter.data(
      `Cache:        ${result.cacheSize}/${result.cacheMaxSize} entries`
    );
    if (result.totalKeysTranslated === 0 && result.totalKeysFailed > 0) {
      this.reporter.warning(
        "No keys were translated. If the endpoint kept returning HTTP 429, wait a few minutes and retry — or set GOOGLE_TRANSLATE_API_KEY to use the official API."
      );
    }
    if (options.dryRun) this.reporter.warning("Dry run — no files were modified.");

    googleTranslateService.dispose();
  }
}

export const cliService = new CLIService();
export { CLIService };
