import * as fs from "fs";
import * as path from "path";
import { SourceDirectoryNotFoundError } from "../../core/errors";
import { extractKeysFromContent } from "../../application/services/source-key-extractor";

export const DEFAULT_SCAN_SKIP_DIRS: readonly string[] = [
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  "coverage",
  ".next",
  ".nuxt",
  ".expo",
  ".expo-shared",
  "ios",
  "android",
  "assets",
  "locales",
  "__tests__",
  "__mocks__",
  "tests",
  "storybook-static",
  ".cache",
  ".turbo",
  ".vercel",
];

const DEFAULT_SCAN_EXTENSIONS = /\.(ts|tsx|js|jsx|mts|cts|mjs|cjs)$/;

/** Test and spec files exercise fixture keys, never the shipped catalog. */
const TEST_FILE_PATTERN = /\.(test|spec)\.[cm]?[jt]sx?$/;

/** The tool itself ships no consumer catalog — its doc examples are noise. */
const SKIPPED_UMITUZ_PACKAGES = new Set(["web-localization"]);

export interface SourceKeyScannerOptions {
  readonly projectRoot: string;
  /** Directory names never descended into. */
  readonly skipDirs?: readonly string[];
  /** File-name test deciding which files are parsed. */
  readonly filePattern?: RegExp;
  /** Also scan `node_modules/@umituz` for keys shared via internal packages. */
  readonly includeUmituzPackages?: boolean;
  /** Absolute paths (or prefixes) excluded from the scan — e.g. the locales dir. */
  readonly excludeAbsolutePaths?: readonly string[];
}

export class SourceKeyScanner {
  private readonly projectRoot: string;
  private readonly skipDirs: ReadonlySet<string>;
  private readonly filePattern: RegExp;
  private readonly includeUmituzPackages: boolean;
  private readonly excludeAbsolutePaths: readonly string[];

  constructor(options: SourceKeyScannerOptions) {
    this.projectRoot = path.resolve(options.projectRoot);
    this.skipDirs = new Set(options.skipDirs ?? DEFAULT_SCAN_SKIP_DIRS);
    this.filePattern = options.filePattern ?? DEFAULT_SCAN_EXTENSIONS;
    this.includeUmituzPackages = options.includeUmituzPackages ?? true;
    this.excludeAbsolutePaths = (options.excludeAbsolutePaths ?? []).map((p) => path.resolve(p));
  }

  /**
   * Scans `srcDir` (relative to the project root or absolute) and returns every
   * translation key referenced by the code, keyed by dotted path.
   */
  scan(srcDir: string): Map<string, string> {
    const absoluteSrcDir = path.resolve(this.projectRoot, srcDir);
    if (!fs.existsSync(absoluteSrcDir) || !fs.statSync(absoluteSrcDir).isDirectory()) {
      throw new SourceDirectoryNotFoundError(absoluteSrcDir);
    }

    const keyMap = new Map<string, string>();
    this.walkDirectory(absoluteSrcDir, keyMap);

    if (this.includeUmituzPackages) {
      const umituzPackagesDir = path.join(this.projectRoot, "node_modules", "@umituz");
      if (fs.existsSync(umituzPackagesDir)) {
        for (const entry of fs.readdirSync(umituzPackagesDir, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
          if (SKIPPED_UMITUZ_PACKAGES.has(entry.name)) continue;
          this.walkDirectory(path.join(umituzPackagesDir, entry.name), keyMap);
        }
      }
    }

    return keyMap;
  }

  private walkDirectory(dir: string, keyMap: Map<string, string>): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (this.skipDirs.has(entry.name)) continue;
        this.walkDirectory(fullPath, keyMap);
        continue;
      }

      if (!entry.isFile()) continue;
      if (TEST_FILE_PATTERN.test(entry.name)) continue;
      if (!this.filePattern.test(entry.name)) continue;
      if (this.isExcluded(fullPath)) continue;

      const content = fs.readFileSync(fullPath, "utf8");
      for (const key of extractKeysFromContent(content).keys()) {
        if (!keyMap.has(key)) {
          keyMap.set(key, key);
        }
      }
    }
  }

  private isExcluded(fullPath: string): boolean {
    const normalized = path.resolve(fullPath);
    return this.excludeAbsolutePaths.some(
      (excluded) => normalized === excluded || normalized.startsWith(`${excluded}${path.sep}`)
    );
  }
}
