#!/usr/bin/env node

import { Command } from "commander";
import { cliService } from "../infrastructure/cli/cli.service";
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
  .command("sync")
  .description("Synchronize missing keys from base language to other languages")
  .option("-d, --locales-dir <dir>", "Directory containing locale files", "src/locales")
  .option("-b, --base-lang <lang>", "Base language code", "en-US")
  .option("-c, --concurrency <n>", "Max parallel operations", "10")
  .option(
    "-l, --languages <list>",
    "Comma-separated list of languages to sync (default: all)"
  )
  .option("--dry-run", "Show what would change without writing files", false)
  .action(
    async (opts: {
      localesDir: string;
      baseLang: string;
      concurrency: string;
      languages?: string;
      dryRun: boolean;
    }) => {
      try {
        await cliService.sync({
          localesDir: opts.localesDir,
          baseLang: opts.baseLang,
          concurrency: parsePositiveInt(opts.concurrency, 10),
          languages: parseList(opts.languages),
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
  .option("-d, --locales-dir <dir>", "Directory containing locale files", "src/locales")
  .option("-b, --base-lang <lang>", "Base language code", "en-US")
  .option("-f, --force", "Force re-translation of all strings", false)
  .option("-c, --concurrency <n>", "Max parallel operations", "10")
  .option(
    "-l, --languages <list>",
    "Comma-separated list of languages to translate (default: all)"
  )
  .option("--dry-run", "Show what would change without writing files", false)
  .option("--max-keys <n>", "Maximum keys to translate per language (cap)")
  .action(
    async (opts: {
      localesDir: string;
      baseLang: string;
      force: boolean;
      concurrency: string;
      languages?: string;
      dryRun: boolean;
      maxKeys?: string;
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
