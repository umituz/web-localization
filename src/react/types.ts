export type TranslateFn = (
  key: string,
  params?: Record<string, unknown>,
) => string;

export interface I18nInstanceLike {
  t: (key: string, params?: Record<string, unknown>) => string;
  language: string;
  on(event: "languageChanged", listener: (lng: string) => void): unknown;
  off(event: "languageChanged", listener: (lng: string) => void): unknown;
}
