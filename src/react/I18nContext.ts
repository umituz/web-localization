import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { defaultT } from "./defaultT";
import type { I18nInstanceLike, TranslateFn } from "./types";
import { isRtlLocale } from "../core/constants/languages.constants";

export interface I18nProviderProps {
  t?: TranslateFn;
  i18n?: I18nInstanceLike;
  initialLanguage?: string;
  onLanguageChange?: (lng: string) => void | Promise<void>;
  children: ReactNode;
}

const I18nContext = createContext<TranslateFn | null>(null);
const I18nLanguageContext = createContext<string | null>(null);
const I18nInstanceContext = createContext<I18nInstanceLike | null>(null);
const I18nChangeLanguageContext = createContext<((lng: string) => Promise<void>) | null>(null);

const StaticI18nProvider = ({
  t,
  initialLanguage,
  onLanguageChange,
  children,
}: {
  t: TranslateFn;
  initialLanguage?: string;
  onLanguageChange?: (lng: string) => void | Promise<void>;
  children: ReactNode;
}) => {
  const [language, setLanguage] = useState<string | null>(initialLanguage ?? null);

  const changeLanguage = useCallback(
    async (lng: string) => {
      setLanguage(lng);
      if (onLanguageChange) {
        await onLanguageChange(lng);
      }
    },
    [onLanguageChange],
  );

  return createElement(
    I18nLanguageContext.Provider,
    { value: language },
    createElement(
      I18nChangeLanguageContext.Provider,
      { value: changeLanguage },
      createElement(I18nContext.Provider, { value: t }, children),
    ),
  );
};

const ReactiveI18nProvider = ({
  i18n,
  onLanguageChange,
  children,
}: {
  i18n: I18nInstanceLike;
  onLanguageChange?: (lng: string) => void | Promise<void>;
  children: ReactNode;
}) => {
  const [language, setLanguage] = useState(i18n.language);

  useEffect(() => {
    const listener = (lng: string) => setLanguage(lng);
    i18n.on("languageChanged", listener);
    return () => {
      i18n.off("languageChanged", listener);
    };
  }, [i18n]);

  const changeLanguage = useCallback(
    async (lng: string) => {
      if (typeof i18n.changeLanguage === "function") {
        await i18n.changeLanguage(lng);
      }
      setLanguage(lng);
      if (onLanguageChange) {
        await onLanguageChange(lng);
      }
    },
    [i18n, onLanguageChange],
  );

  const t = useMemo(() => {
    const raw = i18n.t;
    const bound = typeof raw === "function" ? (raw as (...args: unknown[]) => unknown).bind(i18n) : defaultT;
    return (key: string, params?: Record<string, unknown>) => {
      const res = params ? (bound as TranslateFn)(key, params) : (bound as TranslateFn)(key);
      return typeof res === "string" ? res : String(res ?? key);
    };
  }, [i18n, language]);

  return createElement(
    I18nInstanceContext.Provider,
    { value: i18n },
    createElement(
      I18nLanguageContext.Provider,
      { value: language },
      createElement(
        I18nChangeLanguageContext.Provider,
        { value: changeLanguage },
        createElement(I18nContext.Provider, { value: t }, children),
      ),
    ),
  );
};

export const I18nProvider = ({
  t,
  i18n,
  initialLanguage,
  onLanguageChange,
  children,
}: I18nProviderProps) =>
  i18n
    ? createElement(ReactiveI18nProvider, { i18n, onLanguageChange, children })
    : createElement(StaticI18nProvider, {
        t: t ?? defaultT,
        initialLanguage,
        onLanguageChange,
        children,
      });

export const useT = (): TranslateFn => useContext(I18nContext) ?? defaultT;

export const useI18nLanguage = (): string | null => useContext(I18nLanguageContext);

export const useI18nInstance = (): I18nInstanceLike | null => useContext(I18nInstanceContext);

export const useChangeLanguage = (): ((lng: string) => Promise<void>) => {
  const change = useContext(I18nChangeLanguageContext);
  return (
    change ??
    (async () => {
      return undefined;
    })
  );
};

export const useDirection = (): "ltr" | "rtl" => {
  const lng = useI18nLanguage();
  return lng && isRtlLocale(lng) ? "rtl" : "ltr";
};

export const useIsRtl = (): boolean => {
  return useDirection() === "rtl";
};
