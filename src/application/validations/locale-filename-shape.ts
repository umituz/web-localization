import { LOCALE } from "../../core/constants";

export function isLocaleFilename(value: string, pattern: RegExp = LOCALE.LOCALE_FILE_PATTERN): boolean {
  if (typeof value !== "string" || value.length === 0) return false;
  return pattern.test(value);
}
