import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

export interface SetupI18nOptions {
  resources: Record<string, { translation: any }>;
  defaultLng?: string;
  fallbackLng?: string;
  onInit?: (instance: typeof i18n) => void;
  detection?: any;
}

/**
 * Static i18n initialization to simplify main app code.
 * @description All common configuration is hidden inside this package.
 */
export function setupI18n(options: SetupI18nOptions) {
  const {
    resources,
    defaultLng = 'en-US',
    fallbackLng = 'en-US',
    onInit,
    detection = {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    }
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
      if (onInit) onInit(i18n);
    });

  return i18n;
}

export default i18n;
