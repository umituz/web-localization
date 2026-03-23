/**
 * i18n Configuration Template
 * Copy this file to your project's src/i18n.ts
 *
 * USAGE:
 * 1. Copy to: src/i18n.ts
 * 2. Add import to main.tsx: import './i18n';
 * 3. Create JSON files in src/i18n/locales/
 */

import { setupI18n } from '@umituz/web-localization/setup';

// Import your JSON locale files here
import enUS from './i18n/locales/en-US.json';
import trTR from './i18n/locales/tr-TR.json';

// Add more languages as needed:
// import deDE from './i18n/locales/de-DE.json';
// import frFR from './i18n/locales/fr-FR.json';
// import esES from './i18n/locales/es-ES.json';
// import itIT from './i18n/locales/it-IT.json';
// import ptPT from './i18n/locales/pt-PT.json';
// import ruRU from './i18n/locales/ru-RU.json';
// import zhCN from './i18n/locales/zh-CN.json';
// import jaJP from './i18n/locales/ja-JP.json';
// import arSA from './i18n/locales/ar-SA.json';

setupI18n({
  resources: {
    'en-US': { translation: enUS.translation },
    'tr-TR': { translation: trTR.translation },

    // Uncomment and add more languages:
    // 'de-DE': { translation: deDE.translation },
    // 'fr-FR': { translation: frFR.translation },
    // 'es-ES': { translation: esES.translation },
    // 'it-IT': { translation: itIT.translation },
    // 'pt-PT': { translation: ptPT.translation },
    // 'ru-RU': { translation: ruRU.translation },
    // 'zh-CN': { translation: zhCN.translation },
    // 'ja-JP': { translation: jaJP.translation },
    // 'ar-SA': { translation: arSA.translation },
  },
  defaultLng: 'en-US',
  fallbackLng: 'en-US',

  // Optional: Language detection configuration
  detection: {
    order: ['localStorage', 'navigator'],
    caches: ['localStorage'],
    lookupLocalStorage: 'i18nextLng',
  },

  // Optional: SEO integration (requires @umituz/web-seo)
  // seo: {
  //   titleKey: 'app.title',
  //   descriptionKey: 'app.description',
  //   defaultImage: 'https://example.com/og-image.png',
  //   twitterHandle: '@yourhandle',
  // },
});
