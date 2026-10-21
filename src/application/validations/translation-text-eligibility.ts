export const DEFAULT_SKIP_LIST: readonly string[] = ["@umituz"];
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
