import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { defaultT } from "./defaultT";
import type { I18nInstanceLike, TranslateFn } from "./types";

export interface I18nProviderProps {
  t?: TranslateFn;
  i18n?: I18nInstanceLike;
  children: ReactNode;
}

const I18nContext = createContext<TranslateFn | null>(null);
const I18nLanguageContext = createContext<string | null>(null);

const StaticI18nProvider = ({ t, children }: { t: TranslateFn; children: ReactNode }) =>
  createElement(I18nContext.Provider, { value: t }, children);

const ReactiveI18nProvider = ({ i18n, children }: { i18n: I18nInstanceLike; children: ReactNode }) => {
  const [language, setLanguage] = useState(i18n.language);

  useEffect(() => {
    const listener = (lng: string) => setLanguage(lng);
    i18n.on("languageChanged", listener);
    return () => {
      i18n.off("languageChanged", listener);
    };
  }, [i18n]);

  const t = useMemo(() => {
    const bound = i18n.t.bind(i18n);
    return (key: string, params?: Record<string, unknown>) => bound(key, params);
  }, [i18n, language]);

  return createElement(
    I18nLanguageContext.Provider,
    { value: language },
    createElement(I18nContext.Provider, { value: t }, children),
  );
};

export const I18nProvider = ({ t, i18n, children }: I18nProviderProps) =>
  i18n
    ? createElement(ReactiveI18nProvider, { i18n, children })
    : createElement(StaticI18nProvider, { t: t ?? defaultT, children });

export const useT = (): TranslateFn => useContext(I18nContext) ?? defaultT;

export const useI18nLanguage = (): string | null => useContext(I18nLanguageContext);
