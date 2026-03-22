/**
 * Text Validation Utilities
 */

/**
 * Validates if the text is suitable for translation
 */
export function isValidText(text: unknown): text is string {
  if (typeof text !== "string") return false;
  if (text.trim().length === 0) return false;
  if (/^\d+$/.test(text)) return false; // Don't translate pure numbers
  return true;
}

/**
 * Checks if a word should be skipped (e.g., proper nouns, symbols)
 */
export function shouldSkipWord(text: string): boolean {
  const skiplist = ["@umituz"];
  return skiplist.some(word => text.includes(word));
}

/**
 * Determines if a key needs translation
 */
export function needsTranslation(targetValue: unknown, sourceValue: string): boolean {
  if (typeof targetValue !== "string") return true;
  if (targetValue.length === 0) return true; // Empty string means untranslated
  // Do NOT return true if target === source anymore, to avoid infinite translations for words that are identical in both languages
  return false;
}
