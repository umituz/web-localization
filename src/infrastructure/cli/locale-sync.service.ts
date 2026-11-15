import * as path from "path";
import { Semaphore } from "../../core/utils/semaphore";
import { LocaleFileNotFoundError } from "../../core/errors";
import { RATE_LIMIT } from "../../core/constants";
import {
  LocaleFileRepository,
  isPluralVariantOfSource,
  syncObjectStructure,
} from "../persistence/locale-file.repository";
import { SourceKeyScanner } from "../scanning/source-key.scanner";
import {
  flattenToDottedPaths,
  pruneToPaths,
  setByDottedPath,
} from "../../application/services/dotted-key-helper";
import type { ProgressReporter } from "./progress-reporter";

const MAX_REPORTED_KEYS = 10;

export interface SyncCommandOptions {
  readonly localesDir: string;
  readonly baseLang: string;
  readonly concurrency?: number;
  readonly languages?: readonly string[];
  readonly dryRun?: boolean;
  /**
   * Source directory scanned for used translation keys (e.g. "src"). When
   * provided, keys referenced by code but missing from the base locale are
   * added with an empty value for human follow-up.
   */
  readonly srcDir?: string;
  /** Remove base keys not referenced by the scanned source. Requires srcDir. */
  readonly prune?: boolean;
}

export interface SourceScanSummary {
  readonly srcDir: string;
  readonly usedKeyCount: number;
  readonly keysAddedToBase: readonly string[];
  readonly unusedKeys: readonly string[];
  readonly keysPrunedFromBase: readonly string[];
  readonly baseFileUpdated: boolean;
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
  readonly sourceScan?: SourceScanSummary;
}

export class LocaleSyncService {
  constructor(
    private readonly repository: LocaleFileRepository,
    private readonly reporter: ProgressReporter
  ) {}

  async run(options: SyncCommandOptions): Promise<SyncResult> {

    const localesDir = path.resolve(this.repository.root, options.localesDir);
    const baseLangPath = this.repository.resolveLocalePath(options.localesDir, options.baseLang);

    let baseData = await this.repository.read(baseLangPath);
    if (baseData === null) {
      throw new LocaleFileNotFoundError(baseLangPath);
    }

    const createdDomainFiles: string[] = [];

    let sourceScan: SourceScanSummary | undefined;
    if (options.srcDir) {
      const scanOutcome = await this.applySourceScan({
        srcDir: options.srcDir,
        prune: options.prune === true,
        dryRun: options.dryRun === true,
        localesDir,
        baseLangPath,
        baseLang: options.baseLang,
        baseData,
      });
      baseData = scanOutcome.baseData;
      sourceScan = scanOutcome.summary;
      createdDomainFiles.push(...scanOutcome.createdFiles);
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
      return {
        languagesProcessed: 0,
        languagesSucceeded: 0,
        languagesFailed: 0,
        results: [],
        ...(sourceScan ? { sourceScan } : {}),
      };
    }

    const semaphore = new Semaphore(options.concurrency ?? RATE_LIMIT.DEFAULT_CONCURRENCY);
    const results: SyncLanguageResult[] = [];

    await Promise.all(
      targets.map((langCode) =>
        semaphore.run(async () => {
          const targetPath = this.repository.resolveLocalePath(options.localesDir, langCode);
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
                const outcome = await this.repository.write(targetPath, synced, langCode);
                createdDomainFiles.push(...outcome.createdFiles);
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

    if (createdDomainFiles.length > 0) {
      this.reporter.warning(
        `New domain files created — add an import + spread for each to the language's index.ts barrel:\n  ${createdDomainFiles.join("\n  ")}`
      );
    }

    return {
      languagesProcessed: results.length,
      languagesSucceeded: succeeded,
      languagesFailed: failed,
      results,
      ...(sourceScan ? { sourceScan } : {}),
    };
  }

  private async applySourceScan(params: {
    srcDir: string;
    prune: boolean;
    dryRun: boolean;
    localesDir: string;
    baseLangPath: string;
    baseLang: string;
    baseData: Record<string, unknown>;
  }): Promise<{
    baseData: Record<string, unknown>;
    summary: SourceScanSummary;
    createdFiles: readonly string[];
  }> {
    const scanner = new SourceKeyScanner({
      projectRoot: this.repository.root,
      excludeAbsolutePaths: [params.localesDir],
    });

    const usedKeys = scanner.scan(params.srcDir);
    this.reporter.info(
      `Source scan (${params.srcDir}): ${usedKeys.size} unique keys referenced in code.`
    );

    const leaves = flattenToDottedPaths(params.baseData);

    // Keys used in code but absent from the base locale: add as empty strings
    // so `web-loc translate` never invents source copy — humans fill the base.
    const keysAddedToBase: string[] = [];
    for (const dottedPath of usedKeys.keys()) {
      if (leaves.has(dottedPath)) continue;
      if (setByDottedPath(params.baseData, dottedPath, "")) {
        keysAddedToBase.push(dottedPath);
      }
    }
    if (keysAddedToBase.length > 0) {
      this.reporter.success(
        `${params.baseLang}: +${keysAddedToBase.length} keys from source (${formatKeyList(keysAddedToBase)}) — fill their base text, then run translate.`
      );
    }

    // Base keys never referenced by code.
    const unusedKeys = [...leaves.keys()].filter((p) => !usedKeys.has(p)).sort();

    let keysPrunedFromBase: string[] = [];
    if (params.prune) {
      if (usedKeys.size === 0) {
        this.reporter.warning(
          "Source scan found 0 keys — pruning skipped to protect the base file."
        );
      } else if (unusedKeys.length > 0) {
        const pruneResult = pruneToPaths(params.baseData, new Set(usedKeys.keys()));
        params.baseData = pruneResult.pruned;
        keysPrunedFromBase = [...pruneResult.removedPaths].sort();
        this.reporter.success(
          `${params.baseLang}: pruned ${keysPrunedFromBase.length} unused keys (${formatKeyList(keysPrunedFromBase)}).`
        );
      }
    } else if (unusedKeys.length > 0) {
      this.reporter.warning(
        `${params.baseLang}: ${unusedKeys.length} keys unused in source (${formatKeyList(unusedKeys)}) — pass --prune to remove.`
      );
    }

    const baseFileUpdated =
      keysAddedToBase.length > 0 || keysPrunedFromBase.length > 0;
    let createdFiles: readonly string[] = [];
    if (baseFileUpdated && !params.dryRun) {
      const outcome = await this.repository.write(
        params.baseLangPath,
        params.baseData,
        params.baseLang
      );
      createdFiles = outcome.createdFiles;
    }

    return {
      baseData: params.baseData,
      summary: {
        srcDir: params.srcDir,
        usedKeyCount: usedKeys.size,
        keysAddedToBase,
        unusedKeys,
        keysPrunedFromBase,
        baseFileUpdated,
      },
      createdFiles,
    };
  }
}

function formatKeyList(keys: readonly string[]): string {
  const shown = keys.slice(0, MAX_REPORTED_KEYS).map((key) => `"${key}"`).join(", ");
  return keys.length > MAX_REPORTED_KEYS ? `${shown}, … (+${keys.length - MAX_REPORTED_KEYS} more)` : shown;
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
      if (key in src) continue;
      if (isPluralVariantOfSource(src, key)) continue;
      removed++;
    }
  };

  walk(source, target);
  return { added, removed };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
