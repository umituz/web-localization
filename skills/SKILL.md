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

### Step 2: Create Locales Directory Structure

```bash
mkdir -p src/i18n/locales
```

**CRITICAL**: Use `i18n` folder name, NOT `locales` at the root!

### Step 3: Create JSON Locale Files

Create JSON files (NOT TypeScript files) in `src/i18n/locales/`:

**File: `src/i18n/locales/en-US.json`**
```json
{
  "translation": {
    "nav": {
      "home": "Home",
      "about": "About",
      "contact": "Contact"
    },
    "hero": {
      "title": "Welcome to Our App",
      "subtitle": "Build amazing things"
    },
    "common": {
      "login": "Login",
      "signup": "Sign Up",
      "loading": "Loading..."
    }
  }
}
```

**File: `src/i18n/locales/tr-TR.json`**
```json
{
  "translation": {
    "nav": {
      "home": "Ana Sayfa",
      "about": "Hakkında",
      "contact": "İletişim"
    },
    "hero": {
      "title": "Uygulamamıza Hoş Geldiniz",
      "subtitle": "Harika şeyler inşa edin"
    },
    "common": {
      "login": "Giriş",
      "signup": "Kayıt Ol",
      "loading": "Yükleniyor..."
    }
  }
}
```

**IMPORTANT RULES:**
- ✅ Use `.json` extension, NOT `.ts`
- ✅ Wrap all content in `{"translation": { ... }}` structure
- ✅ Use nested JSON objects for organization
- ❌ DO NOT use TypeScript files
- ❌ DO NOT export default from JSON files

### Step 4: Create i18n Configuration File

**File: `src/i18n.ts`** (in `src/` root, parallel to `main.tsx`)

```typescript
import { setupI18n } from '@umituz/web-localization/setup';

import enUS from './i18n/locales/en-US.json';
import trTR from './i18n/locales/tr-TR.json';
// Add more languages as needed...

setupI18n({
  resources: {
    'en-US': { translation: enUS.translation },
    'tr-TR': { translation: trTR.translation },
  },
  defaultLng: 'en-US',
  fallbackLng: 'en-US',
});
```

**CRITICAL POINTS:**
- ✅ Import from `@umituz/web-localization/setup` (NOT main package)
- ✅ Unwrap JSON files: `translation: enUS.translation`
- ✅ DO NOT export i18n instance (setupI18n handles it)
- ✅ Place in `src/i18n.ts`, NOT `src/i18n/index.ts`

### Step 5: Import i18n in main.tsx

**File: `src/main.tsx`**

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './i18n'  // ← ADD THIS LINE

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Failed to find the root element')
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

**CRITICAL:**
- ✅ Import i18n BEFORE rendering App
- ✅ Use side-effect import: `import './i18n'`
- ❌ DO NOT wrap App in Suspense
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

Ensures all language files have the same keys as base language:

```bash
npm run i18n:sync
```

### Auto-Translate

Uses Google Translate to fill missing translations:

```bash
npm run i18n:translate
```

## Common Pitfalls & Solutions

### ❌ Wrong: Using TypeScript Files
```typescript
// DON'T DO THIS
export default {
  nav: { home: "Home" }
};
```

### ✅ Correct: Using JSON Files
```json
{
  "translation": {
    "nav": { "home": "Home" }
  }
}
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
  'en-US': { translation: enUS.translation }
}
```

### ❌ Wrong: Suspense Wrapper
```tsx
<Suspense fallback="Loading...">
  <App />
</Suspense>
```

### ✅ Correct: Direct Import
```tsx
import './i18n';  // Just import, no wrapper needed
```

## Troubleshooting

### Issue: Translations show as keys like "nav.home"

**Causes:**
1. Using `.ts` files instead of `.json`
2. Missing `translation` wrapper in JSON
3. i18n not imported in `main.tsx`
4. Import path wrong (`@umituz/web-localization` instead of `/setup`)

**Solution:**
- Convert all locale files to JSON
- Add `{"translation": { ... }}` wrapper
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

## Verification Checklist

After integration, verify:

- [ ] Package installed: `@umituz/web-localization`
- [ ] Folder structure: `src/i18n/locales/*.json`
- [ ] JSON format: All files have `{"translation": { ... }}` wrapper
- [ ] i18n config: `src/i18n.ts` with correct imports
- [ ] main.tsx: Has `import './i18n'` before App render
- [ ] Component usage: `const { t } = useTranslation()` works
- [ ] Build: `npm run build` succeeds
- [ ] TypeScript: `npx tsc --noEmit` shows no errors
- [ ] Runtime: Translations display correctly (not as keys)

## Full Example Project Structure

```
my-project/
├── src/
│   ├── i18n/
│   │   └── locales/
│   │       ├── en-US.json
│   │       ├── tr-TR.json
│   │       └── de-DE.json
│   ├── i18n.ts                    ← Configuration file
│   ├── main.tsx                   ← Imports i18n
│   ├── components/
│   │   └── Navbar.tsx             ← Uses useTranslation()
│   └── App.tsx
├── package.json
└── vite.config.ts
```

## Best Practices

1. **Always use JSON files** - Never use TypeScript for locales
2. **Keep translation key flat** - Don't nest too deeply (max 3-4 levels)
3. **Use descriptive keys** - `nav.home` is better than `n1`
4. **Sync before translate** - Run `i18n:sync` before `i18n:translate`
5. **Commit JSON files** - They should be in version control
6. **Test all languages** - Verify UI works for each supported language
7. **Use interpolation** - Support dynamic values: `{{count}} items`

## Advanced Features

### SEO Integration

The package can auto-update meta tags:

```typescript
import { setupI18n } from '@umituz/web-localization/setup';

setupI18n({
  resources: { ... },
  seo: {
    titleKey: 'app.title',
    descriptionKey: 'app.description',
    defaultImage: 'https://example.com/og-image.png',
    twitterHandle: '@yourhandle',
  },
});
```

Requires `@umituz/web-seo` package.

## Package Exports Reference

```typescript
// Main package - CLI tools and services
import { googleTranslateService } from '@umituz/web-localization';

// Setup subpath export - i18n configuration
import { setupI18n } from '@umituz/web-localization/setup';
```

## Additional Resources

- i18next documentation: https://www.i18next.com/
- react-i18next documentation: https://react.i18next.com/
- Package location: `/Users/umituz/Desktop/github/umituz/apps/web/npm-packages/web-localization`

---

**Created by:** umituz ⚡
**Version:** 1.0.0
**Last Updated:** 2026-03-23
