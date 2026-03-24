import fs from "fs";
import path from "path";
import chalk from "chalk";
import type { TranslationStats } from "../../domain/entities/translation.entity.js";
import { googleTranslateService } from "./google-translate.service.js";
import { parseTypeScriptFile, generateTypeScriptContent } from "../utils/file.util.js";
import {
  DEFAULT_LOCALES_DIR,
  DEFAULT_BASE_LANGUAGE,
  TRANSLATION_CONCURRENCY_LIMIT,
} from "../constants/index.js";

export interface SyncOptions {
  localesDir?: string;
  sourceDir?: string;
  baseLang?: string;
  force?: boolean;
  concurrency?: number;
}

/**
 * Semaphore for controlling concurrent operations
 */
class Semaphore {
  private permits: number;
  private queue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    this.permits++;
    const next = this.queue.shift();
    if (next) {
      this.permits--;
      next();
    }
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

// Extracted outside loop for better performance
const syncObject = (
  source: Record<string, unknown>,
  target: Record<string, unknown>
): Record<string, unknown> => {
  const result = { ...target };
  for (const key in source) {
    if (typeof source[key] === "object" && source[key] !== null) {
      result[key] = syncObject(
        source[key] as Record<string, unknown>,
        (target[key] as Record<string, unknown>) || {}
      );
    } else if (target[key] === undefined) {
      // Let empty string indicate untranslated state
      result[key] = typeof source[key] === "string" ? "" : source[key];
    }
  }
  // Remove extra keys
  for (const key in target) {
    if (source[key] === undefined) {
      delete result[key];
    }
  }
  return result;
};

export class CLIService {
  async sync(options: SyncOptions = {}): Promise<void> {
    const localesDir = path.resolve(process.cwd(), options.localesDir || DEFAULT_LOCALES_DIR);
    const baseLang = options.baseLang || DEFAULT_BASE_LANGUAGE;
    const baseLangPath = path.join(localesDir, `${baseLang}.ts`);

    if (!fs.existsSync(localesDir)) {
      console.error(chalk.red(`❌ Locales directory not found: ${localesDir}`));
      return;
    }

    if (!fs.existsSync(baseLangPath)) {
      console.error(chalk.red(`❌ Base language file not found: ${baseLangPath}`));
      return;
    }

    const baseData = parseTypeScriptFile(baseLangPath);

    // Pre-compile regex for better performance
    const localeFileRegex = /^[a-z]{2}(-[A-Z]{2})?\.ts$/;
    const files = fs.readdirSync(localesDir)
      .filter(f => localeFileRegex.test(f) && f !== `${baseLang}.ts`)
      .sort();

    console.log(chalk.blue(`📊 Found ${files.length} languages to sync with ${baseLang}.\n`));

    // Process files in parallel with controlled concurrency
    const concurrency = options.concurrency || TRANSLATION_CONCURRENCY_LIMIT;
    const semaphore = new Semaphore(concurrency);

    const syncPromises = files.map(async (file) => {
      return semaphore.run(async () => {
        const targetPath = path.join(localesDir, file);
        const targetData = parseTypeScriptFile(targetPath);
        const langCode = path.basename(file, ".ts");

        const syncedData = syncObject(baseData, targetData);
        fs.writeFileSync(targetPath, generateTypeScriptContent(syncedData, langCode));

        // Non-blocking progress update
        process.stdout.write(chalk.green(`   🌍 ${langCode}: Synced structure.\n`));
      });
    });

    await Promise.all(syncPromises);

    console.log(chalk.bold.green("\n✅ Synchronization completed!"));
  }

  async translate(options: SyncOptions = {}): Promise<void> {
    const localesDir = path.resolve(process.cwd(), options.localesDir || DEFAULT_LOCALES_DIR);
    const baseLang = options.baseLang || DEFAULT_BASE_LANGUAGE;
    const baseLangPath = path.join(localesDir, `${baseLang}.ts`);

    if (!fs.existsSync(baseLangPath)) {
      console.error(chalk.red(`❌ Base language file not found: ${baseLangPath}`));
      return;
    }

    googleTranslateService.initialize({});
    const baseData = parseTypeScriptFile(baseLangPath);

    // Pre-compile regex for better performance
    const localeFileRegex = /^[a-z]{2}(-[A-Z]{2})?\.ts$/;
    const files = fs.readdirSync(localesDir)
      .filter(f => localeFileRegex.test(f) && f !== `${baseLang}.ts`)
      .sort();

    console.log(chalk.blue.bold(`🚀 Starting automatic translation for ${files.length} languages...\n`));

    // Process languages in parallel with controlled concurrency
    const concurrency = options.concurrency || TRANSLATION_CONCURRENCY_LIMIT;
    const semaphore = new Semaphore(concurrency);

    // Shared statistics tracking
    const totalStats = {
      totalLanguages: files.length,
      completedLanguages: 0,
      totalSuccess: 0,
      totalFailure: 0,
    };

    const translatePromises = files.map(async (file) => {
      return semaphore.run(async () => {
        const targetPath = path.join(localesDir, file);
        const targetData = parseTypeScriptFile(targetPath);
        const langCode = path.basename(file, ".ts");

        const stats: TranslationStats = {
          totalCount: 0,
          successCount: 0,
          failureCount: 0,
          skippedCount: 0,
          translatedKeys: []
        };

        // Non-blocking progress update with language name
        const langName = langCode.padEnd(6);
        process.stdout.write(chalk.yellow(`🌍 Translating ${langName}...\n`));

        try {
          // Extract ISO 639-1 language code (e.g., "en" from "en-US")
          const targetLang = langCode.includes("-") ? langCode.split("-")[0] : langCode;

          await googleTranslateService.translateObject(
            baseData,
            targetData,
            targetLang,
            "",
            stats,
            (_key, _from, _to) => {
              // Non-blocking per-key progress (only in verbose mode or for debugging)
              // Commented out to reduce console spam
              // process.stdout.write(chalk.gray(`   • ${key}: ${from.substring(0, 15)}... → ${to.substring(0, 15)}...\r`));
            },
            options.force
          );

          // Write translated content
          if (stats.successCount > 0) {
            fs.writeFileSync(targetPath, generateTypeScriptContent(targetData, langCode));
            totalStats.totalSuccess += stats.successCount;
            process.stdout.write(chalk.green(`   ✅ ${langName} Successfully translated ${stats.successCount} keys.\n`));
          } else if (stats.failureCount > 0) {
            totalStats.totalFailure += stats.failureCount;
            process.stdout.write(chalk.red(`   ❌ ${langName} Failed to translate ${stats.failureCount} keys.\n`));
          } else {
            process.stdout.write(chalk.gray(`   ✨ ${langName} Already up to date.\n`));
          }
        } catch (error) {
          totalStats.totalFailure += stats.failureCount;
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          process.stdout.write(chalk.red(`   ❌ ${langName} Error: ${errorMsg}\n`));
        } finally {
          totalStats.completedLanguages++;
        }
      });
    });

    await Promise.all(translatePromises);

    // Final summary
    console.log(chalk.bold.green("\n✅ All translations completed!"));
    console.log(chalk.gray(`   📊 Processed ${totalStats.completedLanguages}/${totalStats.totalLanguages} languages`));
    if (totalStats.totalSuccess > 0) {
      console.log(chalk.green(`   ✅ Total keys translated: ${totalStats.totalSuccess}`));
    }
    if (totalStats.totalFailure > 0) {
      console.log(chalk.red(`   ❌ Total keys failed: ${totalStats.totalFailure}`));
    }

    // Display cache statistics
    const cacheStats = googleTranslateService.getCacheStats();
    console.log(chalk.gray(`   💾 Cache hit rate: ${cacheStats.size}/${cacheStats.maxSize}`));
  }
}

export const cliService = new CLIService();
