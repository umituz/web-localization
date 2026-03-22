# @umituz/web-localization 🌍

A powerful localization package for web applications with built-in automatic Google Translate integration.

## 🚀 Features

- **Automatic Translation**: Uses Google Translate API to fill in missing translations.
- **Key Synchronization**: Automatically syncs directory structures from a base language (e.g., `en-US.ts`) to other language files.
- **Deep Nesting**: Supports deeply nested JSON structures for complex localization needs.
- **CLI Tools**: Easy-to-use command line interface for developers.

## 📦 Installation

```bash
npm install @umituz/web-localization
```

## 🛠️ Usage

### CLI Commands

First, set up your locales directory:

```bash
mkdir -p src/locales
touch src/locales/en-US.ts src/locales/tr-TR.ts
```

#### Sync Keys

Synchronizes all missing keys from the base language to target languages:

```bash
npx web-loc sync --locales-dir src/locales --base-lang en-US
```

#### Translate Automatically

Uses Google Translate to translate all missing keys:

```bash
npx web-loc translate --locales-dir src/locales --base-lang en-US
```

### Script Usage

You can also use the translation service directly in your scripts:

```typescript
import { googleTranslateService } from "@umituz/web-localization";

await googleTranslateService.initialize({});
const response = await googleTranslateService.translate({
  text: "Hello World",
  targetLanguage: "tr"
});

console.log(response.translatedText); // "Merhaba Dünya"
```

## 📐 Package Structure

Following the `@umituz` new package structure:

- `src/domain`: Entities and Interfaces
- `src/infrastructure`: Services, Utils, Constants
- `src/presentation`: Components and Hooks (React Web helpers coming soon)

---

Developed by **umituz** ⚡
