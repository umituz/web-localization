/**
 * Branded Types - Type-safe primitives
 * @description Prevents accidental mixing of similar primitive types (e.g., LanguageCode vs Path).
 */
declare const __brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [__brand]: B };

export type LanguageCode = Brand<string, "LanguageCode">;
export type Iso639Code = Brand<string, "Iso639Code">;
export type AbsolutePath = Brand<string, "AbsolutePath">;

export const LanguageCode = {
  of(value: string): LanguageCode {
    if (!value || value.trim().length === 0) {
      throw new Error("LanguageCode must be a non-empty string");
    }
    return value as LanguageCode;
  },
} as const;

export const Iso639Code = {
  fromLanguageCode(code: LanguageCode): Iso639Code {
    const base = code.includes("-") ? code.split("-")[0] : code;
    return base.toLowerCase() as Iso639Code;
  },
} as const;
