/**
 * Locale Translate Service
 * @description Translates locale files using a translation strategy.
 */
import * as path from "path";
import { Semaphore } from "../../core/utils/semaphore";
import { RATE_LIMIT } from "../../core/constants";
import { ProgressEmitter, NullProgressEmitter } from "../../core/utils";
import { LocaleFileRepository } from "../persistence/locale-file.repository";
import type { ITranslationStrategy } from "../../domain/interfaces/translation-service.interface";
import type { Iso639Code } from "../../core/types/branded";
import type { ProgressReporter } from "./progress-reporter";
import { extractIso639Code } from "../../application/calculations/iso-language-code-extractor";

export interface TranslateCommandOptions {
  readonly localesDir: string;
  readonly baseLang: string;
  readonly force?: boolean;
  readonly concurrency?: number;
  readonly languages?: readonly string[];
  readonly dryRun?: boolean;
  readonly maxKeys?: number;
  readonly abortSignal?: AbortSignal;
}

export interface TranslateResult {
  readonly languagesProcessed: number;
  readonly languagesSucceeded: number;
  readonly languagesFailed: number;
  readonly totalKeysTranslated: number;
  readonly totalKeysFailed: number;
  readonly totalKeysSkipped: number;
  readonly cacheSize: number;
  readonly cacheMaxSize: number;
}

export class LocaleTranslateService {
  constructor(
    private readonly repository: LocaleFileRepository,
    private readonly strategy: ITranslationStrategy,
    private readonly reporter: ProgressReporter
  ) {}

  async run(options: TranslateCommandOptions): Promise<TranslateResult> {
    const localesDir = path.resolve(process.cwd(), options.localesDir);
    const baseLangPath = path.join(localesDir, `${options.baseLang}.ts`);

    const baseData = await this.repository.read(baseLangPath);
    if (baseData === null) {
      throw new Error(`Base language file not found: ${baseLangPath}`);
    }

    const locales = await this.repository.listLocales(localesDir);
    let targets = locales.filter((lang) => lang !== options.baseLang);

    if (options.languages && options.languages.length > 0) {
      const allowSet = new Set(options.languages);
      targets = targets.filter((lang) => allowSet.has(lang));
    }

    this.reporter.info(
      `Starting automatic translation for ${targets.length} languages${options.dryRun ? " (DRY RUN)" : ""}${options.maxKeys ? ` (max ${options.maxKeys} keys/language)` : ""}.`
    );

    if (targets.length === 0) {
      this.reporter.warning("No target languages to translate.");
      return this.emptyResult(this.strategy.getCacheStats().maxSize);
    }

    const semaphore = new Semaphore(options.concurrency ?? RATE_LIMIT.DEFAULT_CONCURRENCY);
    const emitter = new ProgressEmitter();
    emitter.on("keyTranslated", () => {
      // Suppressed by default — consumers can attach their own listener
    });

    let succeeded = 0;
    let failed = 0;
    let totalTranslated = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    await Promise.all(
      targets.map((langCode) =>
        semaphore.run(async () => {
          const targetPath = path.join(localesDir, `${langCode}.ts`);
          try {
            const targetData = (await this.repository.read(targetPath)) ?? {};
            const targetLang = this.extractIsoCode(langCode);

            const stats = await this.strategy.translateObject(
              {
                source: baseData,
                target: targetData,
                targetLanguage: targetLang,
                force: options.force,
              },
              {
                signal: options.abortSignal,
                emitter: new NullProgressEmitter(),
              }
            );

            const translatedHere = Math.min(stats.successCount, options.maxKeys ?? Infinity);
            if (translatedHere > 0) {
              if (!options.dryRun) {
                await this.repository.write(targetPath, targetData, langCode);
              }
              this.reporter.success(
                `${langCode}: translated ${stats.successCount} keys${options.dryRun ? " (dry run, not saved)" : ""}.`
              );
              totalTranslated += translatedHere;
            } else if (stats.failureCount > 0) {
              this.reporter.warning(`${langCode}: ${stats.failureCount} keys failed.`);
              totalFailed += stats.failureCount;
            } else {
              this.reporter.info(`${langCode}: already up to date.`);
            }
            totalSkipped += stats.skippedCount;
            succeeded++;
          } catch (error) {
            failed++;
            const message = error instanceof Error ? error.message : String(error);
            this.reporter.error(`${langCode}: ${message}`);
          }
        })
      )
    );

    const cacheStats = this.strategy.getCacheStats();
    return {
      languagesProcessed: targets.length,
      languagesSucceeded: succeeded,
      languagesFailed: failed,
      totalKeysTranslated: totalTranslated,
      totalKeysFailed: totalFailed,
      totalKeysSkipped: totalSkipped,
      cacheSize: cacheStats.size,
      cacheMaxSize: cacheStats.maxSize,
    };
  }

  private extractIsoCode(langCode: string): Iso639Code {
    return extractIso639Code(langCode).toLowerCase() as Iso639Code;
  }

  private emptyResult(maxSize: number): TranslateResult {
    return {
      languagesProcessed: 0,
      languagesSucceeded: 0,
      languagesFailed: 0,
      totalKeysTranslated: 0,
      totalKeysFailed: 0,
      totalKeysSkipped: 0,
      cacheSize: 0,
      cacheMaxSize: maxSize,
    };
  }
}
