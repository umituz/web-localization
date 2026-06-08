/**
 * ISO Language Code Extractor
 * @description Extracts the base ISO 639-1 code from a locale tag.
 *
 * Examples:
 *   "en-US" → "en"
 *   "tr-TR" → "tr"
 *   "pt"    → "pt"
 *   "zh-Hans-CN" → "zh" (only the first segment is considered)
 */
export function extractIso639Code(localeTag: string): string {
  if (!localeTag) return "";
  const dashIndex = localeTag.indexOf("-");
  if (dashIndex === -1) return localeTag;
  return localeTag.substring(0, dashIndex);
}

/**
 * Extracts the full locale code (e.g. "en-US") from a TypeScript file name.
 * @example "en-US.ts" → "en-US"
 */
export function extractLocaleCodeFromFilename(filename: string): string {
  if (!filename.endsWith(".ts")) return filename;
  return filename.slice(0, -3);
}
