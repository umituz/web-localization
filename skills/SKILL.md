# @umituz/web-localization Integration Skill

**@umituz/web-localization** — Multi-language localization package with Google Translate auto-translation for web applications.

## Overview

This skill helps you integrate the `@umituz/web-localization` package into any React + Vite + TypeScript project with zero errors.

## When to Use This Skill

Trigger this skill when:
- User says: "setup localization", "add i18n", "integrate web-localization", "add multi-language support"
- Project needs: Multi-language support, internationalization (i18n), translation management
- Package mentioned: `@umituz/web-localization`, `web-localization`, `i18n`, `react-i18next`

## Prerequisites

- React + Vite + TypeScript project
- Project already set up and building successfully

## Integration Steps

### Step 1: Install Package

```bash
npm install @umituz/web-localization
```

Peer dependencies (`i18next`, `react-i18next`, `i18next-browser-languagedetector`) are installed automatically by npm ≥ 7.

### Step 2: Create Locales Directory Structure

```bash
mkdir -p src/i18n/locales
```

**CRITICAL**: Use `i18n` folder name, NOT `locales` at the root!

### Step 3: Create TypeScript Locale Files

Create `.ts` files with a **default export** in `src/i18n/locales/`. The CLI (`web-loc sync` / `web-loc translate`) reads and writes exactly this format:

**File: `src/i18n/locales/en-US.ts`**
```typescript
export default {
  nav: {
    home: "Home",
    about: "About",
    contact: "Contact",
  },
  hero: {
    title: "Welcome to Our App",
    subtitle: "Build amazing things",
  },
  common: {
    login: "Login",
    signup: "Sign Up",
    loading: "Loading...",
  },
};
```

**File: `src/i18n/locales/tr-TR.ts`**
```typescript
export default {
  nav: {
    home: "Ana Sayfa",
    about: "Hakkında",
    contact: "İletişim",
  },
  hero: {
    title: "Uygulamamıza Hoş Geldiniz",
    subtitle: "Harika şeyler inşa edin",
  },
  common: {
    login: "Giriş",
    signup: "Kayıt Ol",
    loading: "Yükleniyor...",
  },
};
```

**IMPORTANT RULES:**
- ✅ Use `.ts` files with `export default { ... }`
- ✅ Export the translation object directly — NO `translation` wrapper
- ✅ Use nested objects for organization
- ✅ Values must be plain strings (interpolation like `{{count}}` is fine)
- ❌ DO NOT use JSON files — the `web-loc` CLI only manages `.ts` locale files
- ❌ DO NOT use named exports

### Step 4: Create i18n Configuration File

**File: `src/i18n.ts`** (in `src/` root, parallel to `main.tsx`)

```typescript
import { setupI18n } from '@umituz/web-localization/setup';

import enUS from './i18n/locales/en-US';
import trTR from './i18n/locales/tr-TR';
// Add more languages as needed...

setupI18n({
  resources: {
    'en-US': { translation: enUS },
    'tr-TR': { translation: trTR },
  },
  defaultLng: 'en-US',
  fallbackLng: 'en-US',
});
```

**CRITICAL POINTS:**
- ✅ Import from `@umituz/web-localization/setup` (NOT main package)
- ✅ Wrap the default export yourself: `translation: enUS` (no `.translation` unwrap)
- ✅ DO NOT export the i18n instance (setupI18n handles it)
- ✅ Place in `src/i18n.ts`, NOT `src/i18n/index.ts`

### Step 5: Import i18n in main.tsx

**File: `src/main.tsx`**

```typescript
import React, { Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './i18n'  // ← ADD THIS LINE (before App renders)

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Failed to find the root element')
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <Suspense fallback={null}>
      <App />
    </Suspense>
  </React.StrictMode>,
)
```

**CRITICAL:**
- ✅ Import i18n BEFORE rendering App
- ✅ Use side-effect import: `import './i18n'`
- ✅ Wrap App in `<Suspense>` — `reactUseSuspense` is enabled by default, so components using `useTranslation()` suspend until languages load
- ✅ Alternative: `await setupI18n(...).whenReady()` in an async bootstrap before rendering, then no Suspense is needed
- ❌ DO NOT use I18nextProvider (setupI18n handles it)

### Step 6: Use Translations in Components

```typescript
import { useTranslation } from 'react-i18next';

export const Navbar = () => {
  const { t } = useTranslation();

  return (
    <nav>
      <a href="/">{t('nav.home')}</a>
      <a href="/about">{t('nav.about')}</a>
      <a href="/contact">{t('nav.contact')}</a>
    </nav>
  );
};
```

`useTranslation` comes from `react-i18next` (a peer dependency), not from this package.

### Step 7: Add Optional Language Switcher

```typescript
import { useTranslation } from 'react-i18next';

export const LanguageSwitcher = () => {
  const { i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div>
      <button onClick={() => changeLanguage('en-US')}>English</button>
      <button onClick={() => changeLanguage('tr-TR')}>Türkçe</button>
    </div>
  );
};
```

## Using CLI Tools

The package includes CLI tools for auto-translation:

### Add to package.json Scripts

```json
{
  "scripts": {
    "i18n:sync": "web-loc sync --locales-dir src/i18n/locales --base-lang en-US",
    "i18n:translate": "web-loc translate --locales-dir src/i18n/locales --base-lang en-US"
  }
}
```

### Sync Keys

Ensures all language files have the same keys as base language (adds missing keys as empty strings, removes stale ones, preserves existing translations):

```bash
npm run i18n:sync
```

### Auto-Translate

Uses Google Translate to fill keys that are still empty:

```bash
npm run i18n:translate
```

Preview changes without writing files: add `--dry-run`.

## Common Pitfalls & Solutions

### ❌ Wrong: Using JSON Files
```json
{ "nav": { "home": "Home" } }
```

### ✅ Correct: TypeScript Default Export
```typescript
export default {
  nav: { home: "Home" },
};
```

### ❌ Wrong: Wrong Import Path
```typescript
import { setupI18n } from '@umituz/web-localization';
```

### ✅ Correct: Setup Subpath Export
```typescript
import { setupI18n } from '@umituz/web-localization/setup';
```

### ❌ Wrong: Incorrect Resources Structure
```typescript
resources: {
  'en-US': enUS  // Missing translation wrapper
}
```

### ✅ Correct: Proper Resources Structure
```typescript
resources: {
  'en-US': { translation: enUS }
}
```

### ❌ Wrong: No Suspense boundary
```tsx
ReactDOM.createRoot(root).render(<App />)  // useTranslation suspends uncaught
```

### ✅ Correct: Wrap App in Suspense (or await whenReady first)
```tsx
<Suspense fallback={null}>
  <App />
</Suspense>
```

## Troubleshooting

### Issue: Translations show as keys like "nav.home"

**Causes:**
1. Locale file has no `export default`
2. Missing `translation` wrapper in `src/i18n.ts` resources
3. i18n not imported in `main.tsx`
4. Import path wrong (`@umituz/web-localization` instead of `/setup`)

**Solution:**
- Ensure locale files `export default { ... }`
- Wrap them in `src/i18n.ts`: `{ translation: enUS }`
- Add `import './i18n'` in main.tsx
- Use `@umituz/web-localization/setup` import

### Issue: Build errors about missing modules

**Cause:** Wrong import path

**Solution:**
```typescript
// WRONG
import { setupI18n } from '@umituz/web-localization';

// CORRECT
import { setupI18n } from '@umituz/web-localization/setup';
```

### Issue: Language not persisting

**Cause:** Language detector not configured (optional)

**Solution:** Add detection config to setupI18n:
```typescript
setupI18n({
  // ...
  detection: {
    order: ['localStorage', 'navigator'],
    caches: ['localStorage'],
  },
});
```

### Issue: `web-loc` reports no locale files found

**Cause:** Locales are JSON, or the directory doesn't match `--locales-dir`

**Solution:** The CLI only manages `.ts` files named like `en-US.ts`. Convert JSON locales to `.ts` default exports and point `--locales-dir` at the folder holding them.

## Verification Checklist

After integration, verify:

- [ ] Package installed: `@umituz/web-localization`
- [ ] Folder structure: `src/i18n/locales/*.ts`
- [ ] Locale format: every file has `export default { ... }` (no `translation` wrapper)
- [ ] i18n config: `src/i18n.ts` with `{ translation: enUS }` resources
- [ ] main.tsx: Has `import './i18n'` before App render, App wrapped in `<Suspense>`
- [ ] Component usage: `const { t } = useTranslation()` works
- [ ] CLI: `npm run i18n:sync` then `npm run i18n:translate` succeed
- [ ] Build: `npm run build` succeeds
- [ ] TypeScript: `npx tsc --noEmit` shows no errors
- [ ] Runtime: Translations display correctly (not as keys)

## Full Example Project Structure

```
my-project/
├── src/
│   ├── i18n/
│   │   └── locales/
│   │       ├── en-US.ts             ← Base language (source of truth)
│   │       ├── tr-TR.ts
│   │       └── de-DE.ts
│   ├── i18n.ts                      ← Configuration file
│   ├── main.tsx                     ← Imports i18n, wraps App in Suspense
│   ├── components/
│   │   └── Navbar.tsx               ← Uses useTranslation()
│   └── App.tsx
├── package.json                     ← Has i18n:sync / i18n:translate scripts
└── vite.config.ts
```

## Best Practices

1. **Always use `.ts` locale files** — the `web-loc` CLI reads and writes only that format
2. **Keep translation keys shallow** - Don't nest too deeply (max 3-4 levels)
3. **Use descriptive keys** - `nav.home` is better than `n1`
4. **Sync before translate** - Run `i18n:sync` before `i18n:translate`
5. **Commit locale files** - They should be in version control
6. **Test all languages** - Verify UI works for each supported language
7. **Use interpolation** - Support dynamic values: `{{count}} items`

## Advanced Features

### SEO Integration

The package can auto-update meta tags:

```typescript
import { setupI18n } from '@umituz/web-localization/setup';

setupI18n({
  resources: { /* ... */ },
  seo: {
    titleKey: 'app.title',
    descriptionKey: 'app.description',
    defaultImage: 'https://example.com/og-image.png',
    twitterHandle: '@yourhandle',
  },
});
```

Requires the optional `@umituz/web-seo` peer — if it is not installed, the integration is skipped with a console warning.

## Package Exports Reference

```typescript
// Main package - translation services & typed errors
import { googleTranslateService } from '@umituz/web-localization';

// Setup subpath export - i18n configuration
import { setupI18n } from '@umituz/web-localization/setup';
```

## Additional Resources

- README.md — full API and architecture reference
- CONSUMING.md — platform integration guide (React Native, WebView, CI)
- TEST_SCENARIOS.md — manual test playbook
- i18next documentation: https://www.i18next.com/
- react-i18next documentation: https://react.i18next.com/

---

**Created by:** umituz ⚡
**Version:** 1.2.0
**Last Updated:** 2026-09-20
