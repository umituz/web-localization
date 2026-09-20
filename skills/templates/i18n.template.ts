/**
 * i18n Configuration Template
 * Copy this file to your project's src/i18n.ts
 *
 * USAGE:
 * 1. Copy to: src/i18n.ts
 * 2. Add import to main.tsx: import './i18n';
 * 3. Create .ts locale files in src/i18n/locales/
 *    (each with `export default { ... }` — the format web-loc manages)
 */

import { setupI18n } from '@umituz/web-localization/setup';

// Import your .ts locale files here (default exports, no wrapper)
import enUS from './i18n/locales/en-US';
import trTR from './i18n/locales/tr-TR';

// Add more languages as needed:
// import deDE from './i18n/locales/de-DE';
// import frFR from './i18n/locales/fr-FR';
// import esES from './i18n/locales/es-ES';
// import itIT from './i18n/locales/it-IT';
// import ptPT from './i18n/locales/pt-PT';
// import ruRU from './i18n/locales/ru-RU';
// import zhCN from './i18n/locales/zh-CN';
// import jaJP from './i18n/locales/ja-JP';
// import arSA from './i18n/locales/ar-SA';

setupI18n({
  resources: {
    'en-US': { translation: enUS },
    'tr-TR': { translation: trTR },

    // Uncomment and add more languages:
    // 'de-DE': { translation: deDE },
    // 'fr-FR': { translation: frFR },
    // 'es-ES': { translation: esES },
    // 'it-IT': { translation: itIT },
    // 'pt-PT': { translation: ptPT },
    // 'ru-RU': { translation: ruRU },
    // 'zh-CN': { translation: zhCN },
    // 'ja-JP': { translation: jaJP },
    // 'ar-SA': { translation: arSA },
  },
  defaultLng: 'en-US',
  fallbackLng: 'en-US',

  // Optional: Language detection configuration
  detection: {
    order: ['localStorage', 'navigator'],
    caches: ['localStorage'],
    lookupLocalStorage: 'i18nextLng',
  },

  // Optional: SEO integration (requires the @umituz/web-seo peer)
  // seo: {
  //   titleKey: 'app.title',
  //   descriptionKey: 'app.description',
  //   defaultImage: 'https://example.com/og-image.png',
  //   twitterHandle: '@yourhandle',
  // },
});
