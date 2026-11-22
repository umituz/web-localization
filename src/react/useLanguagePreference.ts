import { useCallback, useEffect, useState } from "react";
import {
  findMatchingLocale,
  getLanguageMetadata,
  isRtlLocale,
  type LanguageMeta,
} from "../core/constants/languages.constants";
import { useChangeLanguage, useI18nLanguage } from "./I18nContext";

export interface UseLanguagePreferenceOptions {
  storageKey?: string;
  defaultLocale?: string;
  supportedLocales?: readonly string[];
  syncHtmlAttributes?: boolean;
}

export interface UseLanguagePreferenceReturn {
  currentLocale: string;
  setLocale: (locale: string) => Promise<void>;
  direction: "ltr" | "rtl";
  isRtl: boolean;
  metadata?: LanguageMeta;
  supportedLocales?: readonly string[];
}

const DEFAULT_STORAGE_KEY = "i18nextLng";
const DEFAULT_FALLBACK_LOCALE = "en-US";

function getBrowserLocale(
  supportedLocales?: readonly string[],
  fallback = DEFAULT_FALLBACK_LOCALE,
): string {
  if (typeof navigator === "undefined") return fallback;
  const candidates = navigator.languages ?? [navigator.language];
  for (const candidate of candidates) {
    const matched = findMatchingLocale(candidate, supportedLocales);
    if (matched) return matched;
  }
  return fallback;
}

function getStoredLocale(
  key: string,
  supportedLocales?: readonly string[],
): string | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const stored = window.localStorage.getItem(key);
    if (!stored) return null;
    return findMatchingLocale(stored, supportedLocales) ?? null;
  } catch {
    return null;
  }
}

function applyHtmlAttributes(locale: string) {
  if (typeof document === "undefined" || !document.documentElement) return;
  document.documentElement.lang = locale;
  document.documentElement.dir = isRtlLocale(locale) ? "rtl" : "ltr";
}

export function useLanguagePreference(
  options: UseLanguagePreferenceOptions = {},
): UseLanguagePreferenceReturn {
  const {
    storageKey = DEFAULT_STORAGE_KEY,
    defaultLocale = DEFAULT_FALLBACK_LOCALE,
    supportedLocales,
    syncHtmlAttributes = true,
  } = options;

  const contextLang = useI18nLanguage();
  const contextChangeLanguage = useChangeLanguage();

  const [currentLocale, setCurrentLocaleState] = useState<string>(() => {
    if (contextLang) {
      return findMatchingLocale(contextLang, supportedLocales) ?? contextLang;
    }
    const fromStorage = getStoredLocale(storageKey, supportedLocales);
    if (fromStorage) return fromStorage;
    return getBrowserLocale(supportedLocales, defaultLocale);
  });

  useEffect(() => {
    if (contextLang) {
      const matched = findMatchingLocale(contextLang, supportedLocales) ?? contextLang;
      setCurrentLocaleState(matched);
      if (syncHtmlAttributes) {
        applyHtmlAttributes(matched);
      }
    }
  }, [contextLang, supportedLocales, syncHtmlAttributes]);

  useEffect(() => {
    if (syncHtmlAttributes) {
      applyHtmlAttributes(currentLocale);
    }
  }, [currentLocale, syncHtmlAttributes]);

  const setLocale = useCallback(
    async (newLocale: string) => {
      const resolved = findMatchingLocale(newLocale, supportedLocales) ?? newLocale;
      setCurrentLocaleState(resolved);

      if (typeof window !== "undefined" && window.localStorage) {
        try {
          window.localStorage.setItem(storageKey, resolved);
        } catch {
          return;
        }
      }

      if (syncHtmlAttributes) {
        applyHtmlAttributes(resolved);
      }

      await contextChangeLanguage(resolved);
    },
    [contextChangeLanguage, storageKey, supportedLocales, syncHtmlAttributes],
  );

  const isRtl = isRtlLocale(currentLocale);
  const direction: "ltr" | "rtl" = isRtl ? "rtl" : "ltr";
  const metadata = getLanguageMetadata(currentLocale);

  return {
    currentLocale,
    setLocale,
    direction,
    isRtl,
    metadata,
    supportedLocales,
  };
}
