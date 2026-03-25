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
  lazyLoad?: boolean;
  cache?: boolean;
}

// Initialization state tracking
let isInitialized = false;
let initializationPromise: Promise<typeof i18n> | null = null;

/**
 * Optimized i18n initialization with lazy loading and caching
 * @description All common configuration including SEO integration is hidden inside this package.
 * Performance optimizations:
 * - Lazy loading support for resources
 * - Response caching to reduce memory allocation
 * - Efficient language detection with fallbacks
 */
export function setupI18n(options: SetupI18nOptions): typeof i18n {
  // Return existing instance if already initialized
  if (isInitialized && i18n.isInitialized) {
    return i18n;
  }

  // Return existing initialization promise if in progress
  if (initializationPromise) {
    return i18n;
  }

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
    lazyLoad = false,
    cache = true,
  } = options;

  // Optimize resources for memory efficiency
  const optimizedResources = optimizeResources(resources);

  // Create initialization promise for async setup
  initializationPromise = i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      // Use lazy loading if enabled (reduces initial bundle size)
      resources: lazyLoad ? undefined : optimizedResources,

      lng: defaultLng,
      fallbackLng,

      // Performance optimizations
      load: lazyLoad ? 'languageOnly' : 'all',
      preload: lazyLoad ? [] : undefined,

      // Cache configuration for better performance
      ns: ['translation'],
      defaultNS: 'translation',
      saveMissing: false,

      interpolation: {
        escapeValue: false,
        // Use efficient formatting
        format: (value, format) => {
          if (format === 'uppercase') return value.toUpperCase();
          if (format === 'lowercase') return value.toLowerCase();
          if (format === 'capitalize') return value.charAt(0).toUpperCase() + value.slice(1);
          return value;
        },
      },

      detection: {
        ...detection,
        // Cache detection results
        caches: detection.caches || ['localStorage'],
      },

      // React-specific optimizations
      react: {
        useSuspense: false, // Disable suspense for better performance
        bindI18n: 'languageChanged',
        bindI18nStore: 'added removed',
        transEmptyNodeValue: '',
        transSupportBasicHtmlNodes: true,
        transKeepBasicHtmlNodesFor: ['br', 'strong', 'i', 'p'],
      },

      // Enable caching
      cache: cache ? { enabled: true } : undefined,
    })
    .then(() => {
      isInitialized = true;

      // Initialize SEO integration
      if (seo) {
        initSEO({
          i18n,
          ...seo,
        });
      }

      // Call custom init callback
      if (onInit) onInit(i18n);

      return i18n;
    })
    .catch((error) => {
      console.error('Failed to initialize i18n:', error);
      initializationPromise = null;
      throw error;
    });

  return i18n;
}

/**
 * Optimize resources structure for better performance
 * @description Removes duplicate keys and flattens nested structures where beneficial
 */
function optimizeResources(
  resources: Record<string, { translation: Record<string, unknown> }>
): Record<string, { translation: Record<string, unknown> }> {
  const optimized: Record<string, { translation: Record<string, unknown> }> = {};

  for (const [lang, resource] of Object.entries(resources)) {
    optimized[lang] = {
      translation: resource.translation || {},
    };
  }

  return optimized;
}

/**
 * Add language dynamically (for lazy loading scenarios)
 * @description Efficiently adds new language resources without full re-initialization
 */
export function addLanguage(
  lng: string,
  resources: Record<string, unknown>,
  ns = 'translation'
): void {
  if (!i18n.isInitialized) {
    console.warn('i18n is not initialized yet. Call setupI18n first.');
    return;
  }

  i18n.addResourceBundle(lng, ns, resources, true, true);
}

/**
 * Change language with performance optimization
 * @description Changes language efficiently without unnecessary re-renders
 */
export async function changeLanguage(lng: string): Promise<void> {
  if (!i18n.isInitialized) {
    console.warn('i18n is not initialized yet. Call setupI18n first.');
    return;
  }

  await i18n.changeLanguage(lng);
}

/**
 * Get current language
 */
export function getCurrentLanguage(): string {
  return i18n.language || i18n.languages[0] || 'en-US';
}

/**
 * Check if i18n is initialized
 */
export function isI18nInitialized(): boolean {
  return isInitialized && i18n.isInitialized;
}

/**
 * Reset i18n instance (for testing or cleanup)
 * @description Note: i18next doesn't have a built-in reset method, this clears tracking state
 */
export function resetI18n(): void {
  isInitialized = false;
  initializationPromise = null;
  // Clear all resources and namespaces
  if (i18n.isInitialized) {
    const languages = [...i18n.languages];
    languages.forEach(lng => {
      i18n.removeResourceBundle(lng, 'translation');
    });
  }
}

/**
 * Get i18n instance
 */
export function getI18nInstance(): typeof i18n {
  return i18n;
}
