# @umituz/web-localization 🌍

Localization package for web applications: an i18next runtime integration for
React apps, plus a Node CLI (`web-loc`) that keeps locale files in sync and
auto-fills missing translations via Google Translate.

## Features

- **i18n runtime** — `setupI18n()` wires i18next + react-i18next + language
  detection with sensible, overridable defaults.
- **Key synchronization** — `web-loc sync` mirrors the base language's key
  structure onto every other locale file (adds missing keys, removes stale ones).
- **Auto-translation** — `web-loc translate` fills empty keys using Google
  Translate, with `{{placeholder}}` protection, caching, rate limiting,
  bounded concurrency, retries with exponential backoff, and AbortSignal support.
- **Typed errors** — every failure is a `LocalizationError` subclass with a
  stable `code`.
- **Pluggable strategies** — `ITranslationStrategy` lets you swap in DeepL or
  any other provider without touching calling code.

## Installation

```bash
npm install @umituz/web-localization
```

Node.js **>= 18** required. The package is TypeScript-source-shipped
(`main`/`types` point to `src/`), the established convention across the
`@umituz/*` ecosystem — bundlers (Vite, esbuild, webpack, Next with
`transpilePackages`) compile it automatically.

### Peer dependencies

The runtime integrations are **peers**, not hard dependencies — your app
chooses the versions. npm ≥ 7 installs them automatically.

| Peer | Required | Used by |
|---|---|---|
| `i18next` ^23 \|\| ^24 \|\| ^25 | yes | `setupI18n` |
| `react` ^18 \|\| ^19, `react-i18next` ^14 \|\| ^15 | yes | `setupI18n` |
| `i18next-browser-languagedetector` ^7 \|\| ^8 | yes | `setupI18n` |
| `@umituz/web-seo` ^2 | **optional** | `setupI18n` `seo` option |

If you only use the CLI or the translation utilities (`googleTranslateService`,
`GoogleTranslateStrategy`, …), bundlers tree-shake the i18n runtime out of your
bundle when you don't import `setupI18n`. Using only the CLI?
`npm install -D` the package and run it in CI — nothing lands in your app bundle.

## Usage

### 1. Runtime (React app)

```ts
// src/i18n.ts — import once in your entry point
import { setupI18n } from "@umituz/web-localization/setup";
import enUS from "./locales/en-US";   // export default { ... }
import trTR from "./locales/tr-TR";

export const i18n = setupI18n({
  resources: {
    "en-US": { translation: enUS },
    "tr-TR": { translation: trTR },
  },
  defaultLng: "en-US",
  fallbackLng: "en-US",
  detection: { order: ["localStorage", "navigator"], caches: ["localStorage"] },
});

await i18n.whenReady(); // optional — React Suspense handles the rest
```

```tsx
// anywhere in your app
import { useTranslation } from "react-i18next";

function Nav() {
  const { t } = useTranslation();
  return <button>{t("nav.login")}</button>;
}
```

`useTranslation` comes from `react-i18next` (a peer), not from this package.

`setupI18n` is idempotent for the same configuration and throws
`AlreadyInitializedError` if recalled with different resources — call
`resetI18n()` first if you really need to re-initialize (tests, full reloads).

Optional SEO integration (requires `@umituz/web-seo`):

```ts
setupI18n({
  resources,
  seo: { titleKey: "app.title", descriptionKey: "app.description" },
});
```

### 2. CLI (Node / CI)

Locale files are TypeScript modules with a default-exported object
(`src/locales/en-US.ts`):

```ts
export default {
  nav: { home: "Home", about: "About" },
  common: { save: "Save" },
};
```

```bash
# Mirror the base language's key structure onto all other locales
npx web-loc sync --locales-dir src/locales --base-lang en-US

# Auto-translate empty keys via Google Translate
npx web-loc translate --locales-dir src/locales --base-lang en-US

# Preview without writing
npx web-loc translate --locales-dir src/locales --base-lang en-US --dry-run
```

Common options: `--languages tr-TR,de-DE` (subset), `--concurrency 10`,
`--force` (re-translate), `--max-keys 200` (cap per language).

### 3. Translation service (library API)

```ts
import { googleTranslateService } from "@umituz/web-localization";

// No initialization needed — the shared singleton is ready to use.
// Construct `new GoogleTranslateStrategy({ ... })` yourself for isolated
// cache/rate-limiter state.
const response = await googleTranslateService.translate({
  text: "Hello World",
  targetLanguage: "tr",
});
console.log(response.translatedText); // "Merhaba Dünya"
```

The strategy uses Google's **free public endpoint** — no API key, subject to
its rate limits. The `apiKey` config field is deprecated and ignored.

## Platform compatibility

| Surface | Platform |
|---|---|
| Translation utilities (`.`, programmatic) | Any JS runtime with `fetch` (browser, Node 18+, workers) |
| `setupI18n` (`./setup`) | Browser + React. React Native works with `detection: { order: [], caches: [] }` and a manual `defaultLng` |
| CLI (`web-loc`) | Node.js only (build-time tool) |

## Architecture

`src/` follows a layered layout — each layer depends only inward:

- `domain/` — entities (`TranslationStats`) and the `ITranslationStrategy` contract.
- `application/` — pure calculations & validations, plus stateful services
  (cache, placeholder protection, tree walking).
- `infrastructure/` — HTTP client, locale-file repository, CLI services.
- `core/` — cross-cutting primitives: typed errors, branded types, LRU cache,
  semaphore, rate limiter, retry policy.
- `integrations/` — i18next setup composing the above for React apps.
- `scripts/` — the `web-loc` binary entry.

Error handling: every expected failure throws a typed error
(`TranslationHttpError`, `LocaleParseError`, `PathTraversalError`, …) carrying
a stable `code` string — check `instanceof` or dispatch on `error.code`.
Retries fire only for retryable conditions (HTTP 429/5xx, network-level
failures) with exponential backoff and caps; aborts propagate immediately as
`TranslationAbortedError`.

## Development

```bash
npm install
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # vitest
npm run build       # bundles the CLI to dist/scripts/cli.js (esbuild)
```

`prepublishOnly` runs lint + typecheck + tests + build and smoke-tests the
binary — a publish can never ship a broken `web-loc`.

---

Developed by **umituz** ⚡
