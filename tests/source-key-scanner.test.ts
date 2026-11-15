import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { extractKeysFromContent } from "../src/application/services/source-key-extractor";
import {
  SourceKeyScanner,
  DEFAULT_SCAN_SKIP_DIRS,
} from "../src/infrastructure/scanning/source-key.scanner";
import { SourceDirectoryNotFoundError } from "../src/core/errors";

let projectRoot: string;

function writeProjectFile(relativePath: string, content: string): void {
  const fullPath = join(projectRoot, relativePath);
  mkdirSync(join(fullPath, ".."), { recursive: true });
  writeFileSync(fullPath, content);
}

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), "wl-scan-"));
});

afterAll(() => {
  rmSync(projectRoot, { recursive: true, force: true });
});

describe("extractKeysFromContent", () => {
  it("collects t() calls with single and double quotes", () => {
    const keys = extractKeysFromContent(
      `const a = t('nav.home'); const b = t("nav.about");`
    );
    expect([...keys.keys()]).toEqual(["nav.home", "nav.about"]);
  });

  it("collects t() calls with an options argument", () => {
    const keys = extractKeysFromContent(
      `t("common.greeting", { name: "Umit" }); i18n.t('other.key');`
    );
    expect([...keys.keys()]).toEqual(["common.greeting", "other.key"]);
  });

  it("skips dynamic template interpolations inside quotes", () => {
    const keys = extractKeysFromContent("t(`nav.${section}`);");
    expect(keys.size).toBe(0);
  });

  it("collects dot-notation literals with two or more dots", () => {
    const keys = extractKeysFromContent(
      `const k = "errors.network.timeout"; const j = 'a.b'; const url = "https://x.com";`
    );
    expect([...keys.keys()]).toEqual(["errors.network.timeout"]);
  });

  it("ignores domains and file extensions in dot-notation", () => {
    const keys = extractKeysFromContent(
      `const a = "example.com"; const b = "assets/logo.png";`
    );
    expect(keys.size).toBe(0);
  });

  it("expands template-literal prefixes against array literals", () => {
    const keys = extractKeysFromContent(
      `const tabs = ["home", "profile", "center", "42"];
       const label = t(\`tabs.\${tab}\`);`
    );
    expect([...keys.keys()]).toEqual(["tabs.home", "tabs.profile"]);
  });

  it("does not match word-internal t( endings like object.at()", () => {
    const keys = extractKeysFromContent(`const x = object.at('something');`);
    expect(keys.size).toBe(0);
  });
});

describe("SourceKeyScanner", () => {
  it("walks the source tree and collects keys from matching files", () => {
    writeProjectFile("src/app.tsx", `export const title = t("nav.home");`);
    writeProjectFile("src/lib/util.js", `const k = 'errors.network.timeout';`);

    const scanner = new SourceKeyScanner({ projectRoot, includeUmituzPackages: false });
    const keys = scanner.scan("src");

    expect([...keys.keys()].sort()).toEqual(["errors.network.timeout", "nav.home"]);
  });

  it("skips configured directories", () => {
    writeProjectFile("src/app.tsx", `t("nav.home");`);
    writeProjectFile("src/dist/generated.ts", `t("should.not.appear");`);
    writeProjectFile("src/node_modules/pkg/index.js", `t("vendor.key.ignore");`);

    const scanner = new SourceKeyScanner({ projectRoot, includeUmituzPackages: false });
    const keys = scanner.scan("src");

    expect([...keys.keys()]).toEqual(["nav.home"]);
  });

  it("excludes absolute paths such as the locales directory", () => {
    writeProjectFile("src/app.tsx", `t("nav.home");`);
    writeProjectFile("src/locales/en-US.ts", `export default { "ghost.key.unused": "x" };`);

    const scanner = new SourceKeyScanner({
      projectRoot,
      includeUmituzPackages: false,
      excludeAbsolutePaths: [join(projectRoot, "src/locales")],
    });
    const keys = scanner.scan("src");

    expect([...keys.keys()]).toEqual(["nav.home"]);
  });

  it("scans @umituz packages under node_modules for shared keys", () => {
    writeProjectFile("src/app.tsx", `t("nav.home");`);
    writeProjectFile("node_modules/@umituz/web-design-system/src/button.tsx", `t("ds.button.save");`);
    writeProjectFile("node_modules/other-pkg/src/index.ts", `t("other.key.ignore");`);

    const scanner = new SourceKeyScanner({ projectRoot });
    const keys = scanner.scan("src");

    expect([...keys.keys()].sort()).toEqual(["ds.button.save", "nav.home"]);
  });

  it("throws typed SourceDirectoryNotFoundError for a missing source dir", () => {
    const scanner = new SourceKeyScanner({ projectRoot, includeUmituzPackages: false });
    expect(() => scanner.scan("does-not-exist")).toThrow(SourceDirectoryNotFoundError);
  });

  it("honours custom skipDirs and filePattern", () => {
    writeProjectFile("src/app.ts", `t("nav.home");`);
    writeProjectFile("src/generated/app.ts", `t("gen.key.skipme");`);
    writeProjectFile("src/styles.css", `t("css.key.skipme");`);

    const scanner = new SourceKeyScanner({
      projectRoot,
      includeUmituzPackages: false,
      skipDirs: [...DEFAULT_SCAN_SKIP_DIRS, "generated"],
      filePattern: /\.tsx?$/,
    });
    const keys = scanner.scan("src");

    expect([...keys.keys()]).toEqual(["nav.home"]);
  });
});
