export const DEFAULT_SKIP_LIST: readonly string[] = ["@umituz"];
export const EXACT_SKIP_WORDS: readonly string[] = [
  "Google",
  "Apple",
  "Facebook",
  "Instagram",
  "Twitter",
  "YouTube",
  "WhatsApp",
];
const EXACT_SKIP_SET = new Set(EXACT_SKIP_WORDS);
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
  if (typeof value !== "string") return false;
  if (skipList.length > 0) {
    for (const word of skipList) {
      if (value.includes(word)) return true;
    }
  }
  return EXACT_SKIP_SET.has(value.trim());
}

function checkNeedsTranslation(targetValue: unknown): boolean {
  if (typeof targetValue !== "string") return true;
  return targetValue.length === 0;
}
