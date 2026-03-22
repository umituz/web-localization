/**
 * Text Validation Utilities
 */
/**
 * Validates if the text is suitable for translation
 */
export declare function isValidText(text: unknown): text is string;
/**
 * Checks if a word should be skipped (e.g., proper nouns, symbols)
 */
export declare function shouldSkipWord(text: string): boolean;
/**
 * Determines if a key needs translation
 */
export declare function needsTranslation(targetValue: unknown, sourceValue: string): boolean;
//# sourceMappingURL=text-validator.util.d.ts.map