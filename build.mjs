/**
 * Build script for @umituz/web-localization
 *
 * What it builds and why:
 * - `dist/scripts/cli.js` — the `web-loc` binary, bundled with esbuild into a
 *   single self-contained ESM file. Bundling solves two problems:
 *     1. `tsc` emits extensionless ESM imports which Node cannot resolve
 *        (`ERR_MODULE_NOT_FOUND`) — a bundler inlines everything, so there are
 *        no relative imports left to resolve at runtime.
 *     2. CLI-only dependencies (commander) are inlined, keeping the published
 *        package's runtime dependency footprint at zero (peers only).
 *
 * The library itself ships as raw TypeScript source (`main`/`types` point to
 * `src/index.ts`) — that is the established convention across the
 * `@umituz/*` ecosystem, so no JS/d.ts build output is produced for it.
 */
import { rmSync } from "node:fs";
import { build } from "esbuild";

const OUTFILE = "dist/scripts/cli.js";

// Deterministic builds: always start from a clean dist.
rmSync("dist", { recursive: true, force: true });

await build({
  entryPoints: ["src/scripts/cli.ts"],
  bundle: true,
  outfile: OUTFILE,
  platform: "node",
  target: "node18",
  format: "esm",
  // Peers are never bundled — they belong to the consuming application.
  external: [
    "i18next",
    "react-i18next",
    "i18next-browser-languagedetector",
    "@umituz/web-seo",
  ],
  // Node built-ins stay external automatically with platform=node.
  legalComments: "none",
  // CJS dependencies (commander) call `require("node:*")`. In an ESM bundle
  // esbuild replaces those with a shim that throws unless a real `require`
  // exists. Providing one via banner is the documented workaround
  // (https://github.com/evanw/esbuild/issues/1921).
  banner: {
    js: [
      "import { createRequire as __createRequire } from 'node:module';",
      "const require = __createRequire(import.meta.url);",
    ].join("\n"),
  },
  logLevel: "info",
});

console.log(`[build] wrote ${OUTFILE}`);
