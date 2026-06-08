/**
 * Locale Filename Shape Validator
 * @description Validates that a filename matches the expected locale file pattern.
 *
 * Default pattern: `xx.ts` or `xx-XX.ts` where xx is lowercase 2-letter
 * and XX is uppercase 2-letter (ISO 639-1 + optional region).
 */
import { LOCALE } from "../../core/constants";

export function isLocaleFilename(value: string, pattern: RegExp = LOCALE.LOCALE_FILE_PATTERN): boolean {
  if (typeof value !== "string" || value.length === 0) return false;
  return pattern.test(value);
}
