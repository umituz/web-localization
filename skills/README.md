# @umituz/web-localization Skills

This directory contains integration guides and templates for the `@umituz/web-localization` package.

## 📁 Files

- **SKILL.md** - Complete integration guide for AI assistants
- **templates/** - Starter templates for quick setup
  - `i18n.template.ts` - i18n configuration template
  - `en-US.template.json` - Base language template

## 🚀 Quick Start

### For AI Assistants

Read `SKILL.md` and follow the integration steps when asked to set up localization.

### For Developers

1. Copy template files to your project:
```bash
# Copy i18n config
cp skills/templates/i18n.template.ts src/i18n.ts

# Create locales directory
mkdir -p src/i18n/locales

# Copy JSON template
cp skills/templates/en-US.template.json src/i18n/locales/en-US.json
```

2. Install the package:
```bash
npm install @umituz/web-localization
```

3. Import i18n in `main.tsx`:
```typescript
import './i18n';
```

4. Start using translations:
```typescript
import { useTranslation } from 'react-i18next';

const { t } = useTranslation();
console.log(t('nav.home')); // "Home"
```

## 📋 Integration Checklist

Use this checklist to verify proper integration:

- [ ] Package installed: `@umituz/web-localization`
- [ ] File created: `src/i18n.ts`
- [ ] Directory created: `src/i18n/locales/`
- [ ] JSON files created with `translation` wrapper
- [ ] Import added to `main.tsx`: `import './i18n'`
- [ ] Components use `useTranslation()` hook
- [ ] Build succeeds: `npm run build`
- [ ] No TypeScript errors: `npx tsc --noEmit`

## 🛠️ CLI Tools

Add to your `package.json`:

```json
{
  "scripts": {
    "i18n:sync": "web-loc sync --locales-dir src/i18n/locales --base-lang en-US",
    "i18n:translate": "web-loc translate --locales-dir src/i18n/locales --base-lang en-US"
  }
}
```

## 📖 Examples

### Working Examples

Check out these projects using `@umituz/web-localization`:

1. **umituz-react** - Portfolio website
   - Path: `/Users/umituz/Desktop/github/umituz/apps/web/umituz-react`
   - Languages: en-US, tr-TR, de-DE, es-ES

2. **aria-s-mock-data-studio** - Virtual character app
   - Path: `/Users/umituz/Desktop/github/umituz/apps/web/aria-s-mock-data-studio`
   - Languages: en-US, tr-TR, de-DE, fr-FR, es-ES, it-IT, pt-PT, ru-RU, zh-CN, ja-JP, ar-SA

## 🐛 Troubleshooting

### Translations showing as keys (e.g., "nav.home")

**Problem:** JSON files missing `translation` wrapper

**Solution:**
```json
// ❌ WRONG
{
  "nav": { "home": "Home" }
}

// ✅ CORRECT
{
  "translation": {
    "nav": { "home": "Home" }
  }
}
```

### Import errors

**Problem:** Wrong import path

**Solution:**
```typescript
// ❌ WRONG
import { setupI18n } from '@umituz/web-localization';

// ✅ CORRECT
import { setupI18n } from '@umituz/web-localization/setup';
```

### TypeScript errors

**Problem:** Using `.ts` files instead of `.json`

**Solution:** Convert all locale files from `.ts` to `.json` format

## 📞 Support

For issues or questions:
- Check the main README.md
- Review working examples
- Verify against SKILL.md checklist

---

**Package Version:** 1.1.5
**Last Updated:** 2026-03-23
**Author:** umituz ⚡
