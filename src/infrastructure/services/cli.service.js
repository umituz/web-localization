import fs from "fs";
import path from "path";
import chalk from "chalk";
import { googleTranslateService } from "./google-translate.service";
import { parseTypeScriptFile, generateTypeScriptContent } from "../utils/file.util";
import { DEFAULT_LOCALES_DIR, DEFAULT_BASE_LANGUAGE } from "../constants";
export class CLIService {
    async sync(options = {}) {
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
        const files = fs.readdirSync(localesDir)
            .filter(f => f.match(/^[a-z]{2}-[A-Z]{2}\.ts$/) && f !== `${baseLang}.ts`)
            .sort();
        console.log(chalk.blue(`📊 Found ${files.length} languages to sync with ${baseLang}.\n`));
        for (const file of files) {
            const targetPath = path.join(localesDir, file);
            const targetData = parseTypeScriptFile(targetPath);
            const langCode = file.replace(".ts", "");
            // Deep merge with base data structure
            const syncObject = (source, target) => {
                const result = { ...target };
                for (const key in source) {
                    if (typeof source[key] === "object" && source[key] !== null) {
                        result[key] = syncObject(source[key], target[key] || {});
                    }
                    else if (target[key] === undefined) {
                        result[key] = source[key];
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
            const syncedData = syncObject(baseData, targetData);
            fs.writeFileSync(targetPath, generateTypeScriptContent(syncedData, langCode));
            console.log(chalk.green(`   🌍 ${langCode}: Synced structure.`));
        }
        console.log(chalk.bold.green("\n✅ Synchronization completed!"));
    }
    async translate(options = {}) {
        const localesDir = path.resolve(process.cwd(), options.localesDir || DEFAULT_LOCALES_DIR);
        const baseLang = options.baseLang || DEFAULT_BASE_LANGUAGE;
        const baseLangPath = path.join(localesDir, `${baseLang}.ts`);
        if (!fs.existsSync(baseLangPath)) {
            console.error(chalk.red(`❌ Base language file not found: ${baseLangPath}`));
            return;
        }
        googleTranslateService.initialize({});
        const baseData = parseTypeScriptFile(baseLangPath);
        const files = fs.readdirSync(localesDir)
            .filter(f => f.match(/^[a-z]{2}-[A-Z]{2}\.ts$/) && f !== `${baseLang}.ts`)
            .sort();
        console.log(chalk.blue.bold(`🚀 Starting automatic translation for ${files.length} languages...\n`));
        for (const file of files) {
            const targetPath = path.join(localesDir, file);
            const targetData = parseTypeScriptFile(targetPath);
            const langCode = file.replace(".ts", "");
            const stats = {
                totalCount: 0,
                successCount: 0,
                failureCount: 0,
                skippedCount: 0,
                translatedKeys: []
            };
            console.log(chalk.yellow(`🌍 Translating ${langCode}...`));
            await googleTranslateService.translateObject(baseData, targetData, langCode.split("-")[0], // ISO 639-1
            "", stats, (key, from, to) => {
                process.stdout.write(chalk.gray(`   • ${key}: ${from.substring(0, 15)}... → ${to.substring(0, 15)}...\r`));
            });
            if (stats.successCount > 0) {
                fs.writeFileSync(targetPath, generateTypeScriptContent(targetData, langCode));
                console.log(chalk.green(`   ✅ Successfully translated ${stats.successCount} keys.`));
            }
            else {
                console.log(chalk.gray("   ✨ Already up to date."));
            }
        }
        console.log(chalk.bold.green("\n✅ All translations completed!"));
    }
}
export const cliService = new CLIService();
