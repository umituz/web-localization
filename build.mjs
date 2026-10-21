import { rmSync } from "node:fs";
import { build } from "esbuild";

const OUTFILE = "dist/scripts/cli.js";

rmSync("dist", { recursive: true, force: true });

await build({
  entryPoints: ["src/scripts/cli.ts"],
  bundle: true,
  outfile: OUTFILE,
  platform: "node",
  target: "node18",
  format: "esm",
  external: [
    "i18next",
    "react-i18next",
    "i18next-browser-languagedetector",
  ],
  legalComments: "none",
  banner: {
    js: [
      "import { createRequire as __createRequire } from 'node:module';",
      "const require = __createRequire(import.meta.url);",
    ].join("\n"),
  },
  logLevel: "info",
});

console.log(`[build] wrote ${OUTFILE}`);
