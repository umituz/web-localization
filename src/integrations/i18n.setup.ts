import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initSEO } from '@umituz/web-seo';

export interface DetectionOptions {
  order?: string[];
  caches?: string[];
  lookupLocalStorage?: string;
  lookupSessionstorage?: string;
}

export interface SetupI18nOptions {
  resources: Record<string, { translation: Record<string, unknown> }>;
  defaultLng?: string;
  fallbackLng?: string;
  onInit?: (instance: typeof i18n) => void;
  detection?: DetectionOptions;
  seo?: {
    titleKey: string;
    descriptionKey: string;
    defaultImage?: string;
    twitterHandle?: string;
  };
}

/**
 * Static i18n initialization to simplify main app code.
 * @description All common configuration including SEO integration is hidden inside this package.
 */
export function setupI18n(options: SetupI18nOptions): typeof i18n {
  const {
    resources,
    defaultLng = 'en-US',
    fallbackLng = 'en-US',
    onInit,
    detection = {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
    seo,
  } = options;

  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      lng: defaultLng,
      fallbackLng,
      interpolation: {
        escapeValue: false,
      },
      detection,
    })
    .then(() => {
      if (seo) {
        initSEO({
          i18n,
          ...seo,
        });
      }
      if (onInit) onInit(i18n);
    })
    .catch((error) => {
      console.error('Failed to initialize i18n:', error);
      throw error;
    });

  return i18n;
}
