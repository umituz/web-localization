# Consumer Integration Guide

This package is a TypeScript library for web applications. It is **not** an iOS Swift library. This document explains how various consumers — including iOS apps via WebView, React Native, and pure web — should integrate it.

---

## Table of Contents

1. [Web Applications (primary use case)](#1-web-applications)
2. [React Native](#2-react-native)
3. [iOS / iPadOS via WebView](#3-ios--ipados-via-webview)
4. [Native iOS Swift App (alternative)](#4-native-ios-swift-app-alternative)
5. [CLI usage in CI/CD](#5-cli-usage-in-cicd)

---

## 1. Web Applications

```bash
npm install @umituz/web-localization
```

```ts
import { setupI18n } from "@umituz/web-localization/setup";

const handle = setupI18n({
  resources: {
    en: { translation: { hello: "Hello" } },
    tr: { translation: { hello: "Merhaba" } },
  },
  defaultLng: "en",
  fallbackLng: "en",
});

await handle.whenReady();
// Components use useTranslation from the react-i18next peer:
//   import { useTranslation } from "react-i18next";
```

---

## 2. React Native

React Native apps **can** consume this package — the underlying `i18next` and `react-i18next` packages are React Native compatible. Replace the language detector with a manual one:

```ts
import { setupI18n } from "@umituz/web-localization";
import * as RNLocalize from "react-native-localize";

const userLang = RNLocalize.findBestLanguageTag(["en", "tr"]);

setupI18n({
  resources: { en: { translation: en }, tr: { translation: tr } },
  defaultLng: userLang?.languageTag ?? "en",
  // Disable web-only language detection
  detection: { order: [], caches: [] },
});
```

> **Note**: The CLI (`sync`, `translate`) runs in Node only — it must be invoked from a Node script, not from the React Native runtime.

---

## 3. iOS / iPadOS via WebView

If your iOS app hosts a WKWebView that loads a web bundle, this package works transparently inside it. No Swift code changes are required.

**Setup checklist:**

1. Bundle the web app's static assets inside the iOS app
2. Configure `WKWebView` to allow local file access (`allowFileAccessFromFileURLs`)
3. The web app uses `setupI18n()` as normal
4. Locale storage works via `localStorage` (built into WKWebView)
5. Google Translate API calls are made from the WebView using `fetch` — no Swift networking required

**Performance tips for WKWebView:**

- Pre-warm the WebView with locale resources injected via `evaluateJavaScript`
- Use the `lazyLoad: true` option in `setupI18n` to defer translation files
- Disable Google Translate cache if offline mode is needed (use a custom `fetchImpl`)

---

## 4. Native iOS Swift App (alternative)

If you need **native** iOS localization (no WebView), this package does **not** provide Swift bindings. Recommended paths:

| Approach | When to use |
|----------|-------------|
| **String Catalogs (.xcstrings)** | App has stable, hand-curated translations |
| **WebView + this package** | Auto-translation is required, app has web content |
| **Custom Swift wrapper** | Need offline auto-translation, no web content |
| **Server-side translation** | Backend runs Node, returns translations to iOS app |

### Recommended custom Swift wrapper pattern

```swift
// Pseudo-code: NOT shipped with this package
// Shows the contract an iOS app would call a server endpoint for.

struct TranslationRequest: Encodable {
    let text: String
    let targetLanguage: String
    let sourceLanguage: String?
}

actor LocalizationClient {
    let baseURL: URL
    let session: URLSession

    func translate(_ text: String, to target: String) async throws -> String {
        // Server runs: googleTranslateService.translate(...)
        // ...
    }
}
```

**Server-side setup (Node.js):**

```ts
// server.ts — example
import express from "express";
import { GoogleTranslateStrategy } from "@umituz/web-localization";

const app = express();
const translator = new GoogleTranslateStrategy();

app.post("/translate", express.json(), async (req, res) => {
  try {
    const result = await translator.translate({
      text: req.body.text,
      targetLanguage: req.body.targetLanguage,
    });
    res.json({ translated: result.translatedText });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
```

The iOS app would call `POST /translate` instead of inlining translation logic.

---

## 5. CLI usage in CI/CD

The `web-loc` binary ships with this package and is intended for build-time locale synchronization and translation.

```bash
# In package.json scripts:
"i18n:sync": "web-loc sync --locales-dir src/locales --base-lang en-US",
"i18n:translate": "web-loc translate --locales-dir src/locales --base-lang en-US",
"i18n:translate:tr-only": "web-loc translate --locales-dir src/locales --base-lang en-US --languages tr-TR --dry-run"
```

GitHub Actions example:

```yaml
- name: Sync locales
  run: npx web-loc sync --locales-dir src/locales --base-lang en-US
- name: Auto-translate missing keys
  run: npx web-loc translate --locales-dir src/locales --base-lang en-US --force
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
```

---

## Building a dedicated Swift package

If you want a true native Swift wrapper for Google Translate:

1. Create a new repo: `web-localization-swift`
2. Use `swift-package-manager` to scaffold
3. Implement `LocalizationClient` actor that calls a backend running `@umituz/web-localization`
4. Publish to internal Swift Package Index

This package does not ship Swift code by design — translation is a network-bound, async operation that benefits from a Node.js runtime.
