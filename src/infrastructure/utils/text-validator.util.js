/**
 * Text Validation Utilities
 */
/**
 * Validates if the text is suitable for translation
 */
export function isValidText(text) {
    if (typeof text !== "string")
        return false;
    if (text.trim().length === 0)
        return false;
    if (/^\d+$/.test(text))
        return false; // Don't translate pure numbers
    return true;
}
/**
 * Checks if a word should be skipped (e.g., proper nouns, symbols)
 */
export function shouldSkipWord(text) {
    const skiplist = ["@umituz"];
    return skiplist.some(word => text.includes(word));
}
/**
 * Determines if a key needs translation
 */
export function needsTranslation(targetValue, sourceValue) {
    if (typeof targetValue !== "string")
        return true;
    if (targetValue.trim().length === 0)
        return true;
    if (targetValue === sourceValue && !/^\d+$/.test(sourceValue))
        return true;
    return false;
}
