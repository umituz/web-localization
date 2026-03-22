#!/usr/bin/env node

/**
 * CLI Tool for @umituz/web-localization
 */

import { Command } from "commander";
import { cliService } from "../infrastructure/services/cli.service.js";
import chalk from "chalk";

const program = new Command();

program
  .name("web-loc")
  .description("Localization CLI tool for web applications")
  .version("1.0.0");

program
  .command("sync")
  .description("Synchronize missing keys from base language to other languages")
  .option("-d, --locales-dir <dir>", "Directory containing locale files", "src/locales")
  .option("-b, --base-lang <lang>", "Base language code", "en-US")
  .action(async (options) => {
    try {
      await cliService.sync(options);
    } catch (error) {
      console.error(chalk.red("❌ Sync failed:"), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command("translate")
  .description("Automatically translate missing strings using Google Translate")
  .option("-d, --locales-dir <dir>", "Directory containing locale files", "src/locales")
  .option("-b, --base-lang <lang>", "Base language code", "en-US")
  .option("-f, --force", "Force re-translation of all strings", false)
  .action(async (options) => {
    try {
      await cliService.translate(options);
    } catch (error) {
      console.error(chalk.red("❌ Translation failed:"), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
