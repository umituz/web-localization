import { LocaleFileRepository } from "../persistence/locale-file.repository";
import { googleTranslateService } from "../../application/strategies/google-translate.strategy";
import { LocaleSyncService, type SyncCommandOptions } from "./locale-sync.service";
import { LocaleTranslateService, type TranslateCommandOptions } from "./locale-translate.service";
import { ConsoleProgressReporter } from "./progress-reporter";

export type SyncOptions = SyncCommandOptions;
export type TranslateOptions = TranslateCommandOptions;

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
    if (options.dryRun) this.reporter.warning("Dry run — no files were modified.");
  }

  async translate(options: TranslateOptions): Promise<void> {
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
    if (options.dryRun) this.reporter.warning("Dry run — no files were modified.");

    googleTranslateService.dispose();
  }
}

export const cliService = new CLIService();
export { CLIService };
