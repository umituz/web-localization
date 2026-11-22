export type TranslateFn = (
  key: string,
  params?: Record<string, unknown>,
  options?: unknown,
) => string;

export interface I18nInstanceLike {
  t: TranslateFn | ((...args: unknown[]) => unknown);
  language: string;
  changeLanguage?(lng: string): Promise<unknown> | unknown;
  on(event: "languageChanged", listener: (lng: string) => void): unknown;
  off(event: "languageChanged", listener: (lng: string) => void): unknown;
}
