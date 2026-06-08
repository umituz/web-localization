/**
 * Translation Text Eligibility
 * @description Determines whether a text is eligible for translation,
 * should be skipped (brand names, etc.), or already has a translation.
 *
 * @description Single-responsibility guard for the translation pipeline.
 * Configurable skip list allows per-project customization.
 */
const DEFAULT_SKIP_LIST: readonly string[] = ["@umituz"];
const PURE_NUMBER_PATTERN = /^\d+$/;

export interface TextEligibility {
  readonly isTranslatable: boolean;
  readonly shouldSkip: boolean;
  readonly needsTranslation: boolean;
}

export interface TranslationTextEligibilityInput {
  readonly value: unknown;
  readonly targetValue: unknown;
  readonly skipList?: readonly string[];
}

/**
 * Evaluate a single text in three independent dimensions.
 */
export function evaluateTextEligibility(input: TranslationTextEligibilityInput): TextEligibility {
  const skipList = input.skipList ?? DEFAULT_SKIP_LIST;
  return {
    isTranslatable: checkIsTranslatable(input.value),
    shouldSkip: checkShouldSkip(input.value, skipList),
    needsTranslation: checkNeedsTranslation(input.targetValue),
  };
}

function checkIsTranslatable(value: unknown): boolean {
  if (typeof value !== "string") return false;
  if (value.trim().length === 0) return false;
  if (PURE_NUMBER_PATTERN.test(value)) return false;
  return true;
}

function checkShouldSkip(value: unknown, skipList: readonly string[]): boolean {
  if (typeof value !== "string" || skipList.length === 0) return false;
  for (const word of skipList) {
    if (value.includes(word)) return true;
  }
  return false;
}

function checkNeedsTranslation(targetValue: unknown): boolean {
  if (typeof targetValue !== "string") return true;
  return targetValue.length === 0;
}
