import type { TFunction } from "i18next";

export type TranslateFn = (
  key: string,
  params?: Record<string, unknown>,
) => string;

export interface I18nInstanceLike {
  t: TFunction | TranslateFn;
  language: string;
  on(event: "languageChanged", listener: (lng: string) => void): unknown;
  off(event: "languageChanged", listener: (lng: string) => void): unknown;
}
