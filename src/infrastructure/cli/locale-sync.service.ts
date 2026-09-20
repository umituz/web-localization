/**
 * Locale Sync Service
 * @description Synchronizes locale file structure with a base language.
 */
import * as path from "path";
import { Semaphore } from "../../core/utils/semaphore";
import { LocaleFileNotFoundError } from "../../core/errors";
import { RATE_LIMIT } from "../../core/constants";
import { LocaleFileRepository, syncObjectStructure } from "../persistence/locale-file.repository";
import type { ProgressReporter } from "./progress-reporter";

export interface SyncCommandOptions {
  readonly localesDir: string;
  readonly baseLang: string;
  readonly concurrency?: number;
  readonly languages?: readonly string[];
  readonly dryRun?: boolean;
}

export interface SyncLanguageResult {
  readonly language: string;
  readonly keysAdded: number;
  readonly keysRemoved: number;
  readonly success: boolean;
  readonly error?: string;
}

export interface SyncResult {
  readonly languagesProcessed: number;
  readonly languagesSucceeded: number;
  readonly languagesFailed: number;
  readonly results: readonly SyncLanguageResult[];
}

export class LocaleSyncService {
  constructor(
    private readonly repository: LocaleFileRepository,
    private readonly reporter: ProgressReporter
  ) {}

  async run(options: SyncCommandOptions): Promise<SyncResult> {
    // Resolve against the repository's root, not process.cwd() — the
    // repository enforces its own project root, so a cwd-relative path would
    // be rejected as path traversal when they differ.
    const localesDir = path.resolve(this.repository.root, options.localesDir);
    const baseLangPath = path.join(localesDir, `${options.baseLang}.ts`);

    const baseData = await this.repository.read(baseLangPath);
    if (baseData === null) {
      throw new LocaleFileNotFoundError(baseLangPath);
    }

    const locales = await this.repository.listLocales(localesDir);
    let targets = locales.filter((lang) => lang !== options.baseLang);

    if (options.languages && options.languages.length > 0) {
      const allowSet = new Set(options.languages);
      targets = targets.filter((lang) => allowSet.has(lang));
    }

    this.reporter.info(
      `Found ${targets.length} languages to sync with ${options.baseLang}${options.dryRun ? " (DRY RUN)" : ""}.`
    );

    if (targets.length === 0) {
      this.reporter.warning("No target languages to sync.");
      return { languagesProcessed: 0, languagesSucceeded: 0, languagesFailed: 0, results: [] };
    }

    const semaphore = new Semaphore(options.concurrency ?? RATE_LIMIT.DEFAULT_CONCURRENCY);
    const results: SyncLanguageResult[] = [];

    await Promise.all(
      targets.map((langCode) =>
        semaphore.run(async () => {
          const targetPath = path.join(localesDir, `${langCode}.ts`);
          try {
            const targetData = (await this.repository.read(targetPath)) ?? {};
            const synced = syncObjectStructure(baseData, targetData);

            const { added, removed } = diffKeys(baseData, targetData);
            const result: SyncLanguageResult = {
              language: langCode,
              keysAdded: added,
              keysRemoved: removed,
              success: true,
            };

            if (added > 0 || removed > 0) {
              if (!options.dryRun) {
                await this.repository.write(targetPath, synced, langCode);
              }
              this.reporter.success(
                `${langCode}: +${added} keys, -${removed} keys${options.dryRun ? " (dry run, not saved)" : ""}.`
              );
            } else {
              this.reporter.info(`${langCode}: already in sync.`);
            }

            results.push(result);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.reporter.error(`${langCode}: ${message}`);
            results.push({
              language: langCode,
              keysAdded: 0,
              keysRemoved: 0,
              success: false,
              error: message,
            });
          }
        })
      )
    );

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.length - succeeded;

    return {
      languagesProcessed: results.length,
      languagesSucceeded: succeeded,
      languagesFailed: failed,
      results,
    };
  }
}

function diffKeys(
  source: Record<string, unknown>,
  target: Record<string, unknown>
): { added: number; removed: number } {
  let added = 0;
  let removed = 0;

  const walk = (src: Record<string, unknown>, tgt: Record<string, unknown>) => {
    for (const key of Object.keys(src)) {
      const sv = src[key];
      const tv = tgt[key];
      if (isPlainObject(sv) && sv !== null) {
        walk(sv as Record<string, unknown>, isPlainObject(tv) ? (tv as Record<string, unknown>) : {});
        continue;
      }
      if (tv === undefined) added++;
    }
    for (const key of Object.keys(tgt)) {
      if (!(key in src)) removed++;
    }
  };

  walk(source, target);
  return { added, removed };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
