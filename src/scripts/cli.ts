#!/usr/bin/env node

import { Command } from "commander";
import { cliService } from "../infrastructure/cli/cli.service";
import { LOCALE } from "../core/constants";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  readFileSync(join(__dirname, "../../package.json"), "utf-8")
) as { version: string };

const program = new Command();

program
  .name("web-loc")
  .description("Localization CLI tool for web applications")
  .version(packageJson.version);

program
  .command("setup")
  .description("Create locale stub files and generate the locales index.ts")
  .option("-d, --locales-dir <dir>", "Directory containing locale files", LOCALE.DEFAULT_LOCALES_DIR)
  .option("-b, --base-lang <lang>", "Base language code", LOCALE.DEFAULT_BASE_LANGUAGE)
  .option(
    "-l, --languages <list>",
    "Comma-separated list of locale codes to create (e.g. tr-TR,de-DE)"
  )
  .option("--all", "Create stubs for every supported locale", false)
  .option("--dry-run", "Show what would change without writing files", false)
  .action(
    async (opts: {
      localesDir: string;
      baseLang: string;
      languages?: string;
      all: boolean;
      dryRun: boolean;
    }) => {
      try {
        await cliService.setup({
          localesDir: opts.localesDir,
          baseLang: opts.baseLang,
          languages: parseList(opts.languages),
          all: opts.all,
          dryRun: opts.dryRun,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`[ERR] Setup failed: ${message}\n`);
        process.exit(1);
      }
    }
  );

program
  .command("sync")
  .description("Synchronize missing keys from base language to other languages")
  .option("-d, --locales-dir <dir>", "Directory containing locale files", LOCALE.DEFAULT_LOCALES_DIR)
  .option("-b, --base-lang <lang>", "Base language code", LOCALE.DEFAULT_BASE_LANGUAGE)
  .option("-c, --concurrency <n>", "Max parallel operations", "10")
  .option(
    "-l, --languages <list>",
    "Comma-separated list of languages to sync (default: all)"
  )
  .option(
    "-s, --src-dir <dir>",
    "Scan source code for used translation keys (adds missing keys to the base locale)"
  )
  .option("--prune", "Remove base keys unused by the scanned source (requires --src-dir)", false)
  .option("--dry-run", "Show what would change without writing files", false)
  .action(
    async (opts: {
      localesDir: string;
      baseLang: string;
      concurrency: string;
      languages?: string;
      srcDir?: string;
      prune: boolean;
      dryRun: boolean;
    }) => {
      try {
        await cliService.sync({
          localesDir: opts.localesDir,
          baseLang: opts.baseLang,
          concurrency: parsePositiveInt(opts.concurrency, 10),
          languages: parseList(opts.languages),
          ...(opts.srcDir ? { srcDir: opts.srcDir } : {}),
          ...(opts.srcDir ? { prune: opts.prune } : {}),
          dryRun: opts.dryRun,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`[ERR] Sync failed: ${message}\n`);
        process.exit(1);
      }
    }
  );

program
  .command("translate")
  .description("Automatically translate missing strings using Google Translate")
  .option("-d, --locales-dir <dir>", "Directory containing locale files", LOCALE.DEFAULT_LOCALES_DIR)
  .option("-b, --base-lang <lang>", "Base language code", LOCALE.DEFAULT_BASE_LANGUAGE)
  .option("-f, --force", "Force re-translation of all strings", false)
  .option("-c, --concurrency <n>", "Max parallel operations", "10")
  .option(
    "-l, --languages <list>",
    "Comma-separated list of languages to translate (default: all)"
  )
  .option("--dry-run", "Show what would change without writing files", false)
  .option("--max-keys <n>", "Maximum keys to translate per language (cap)")
  .option("--sync-first", "Run a structural sync before translating", false)
  .option(
    "--refresh-identical",
    "Retranslate multi-word values that are identical to the base language",
    false
  )
  .option("--verbose", "Log the first translated keys per language", false)
  .action(
    async (opts: {
      localesDir: string;
      baseLang: string;
      force: boolean;
      concurrency: string;
      languages?: string;
      dryRun: boolean;
      maxKeys?: string;
      syncFirst: boolean;
      refreshIdentical: boolean;
      verbose: boolean;
    }) => {
      try {
        await cliService.translate({
          localesDir: opts.localesDir,
          baseLang: opts.baseLang,
          force: opts.force,
          concurrency: parsePositiveInt(opts.concurrency, 10),
          languages: parseList(opts.languages),
          dryRun: opts.dryRun,
          ...(opts.maxKeys ? { maxKeys: parsePositiveInt(opts.maxKeys, 0) } : {}),
          syncFirst: opts.syncFirst,
          refreshIdentical: opts.refreshIdentical,
          verbose: opts.verbose,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`[ERR] Translation failed: ${message}\n`);
        process.exit(1);
      }
    }
  );

program.parse();

function parsePositiveInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    process.stderr.write(`[ERR] Invalid integer: ${value}. Using default ${fallback}.\n`);
    return fallback;
  }
  return parsed;
}

function parseList(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
