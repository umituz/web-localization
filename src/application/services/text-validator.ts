/**
 * Text Validator (thin facade over translation-text-eligibility)
 * @description Public-facing API for translation text checks.
 * The actual logic lives in `validations/translation-text-eligibility.ts`.
 */
import {
  evaluateTextEligibility,
  DEFAULT_SKIP_LIST,
} from "../validations/translation-text-eligibility";

export class TextValidator {
  private readonly skipList: ReadonlySet<string>;

  constructor(skipList: readonly string[] = DEFAULT_SKIP_LIST) {
    this.skipList = new Set(skipList);
  }

  isTranslatable(text: unknown): text is string {
    return evaluateTextEligibility({
      value: text,
      targetValue: undefined,
      skipList: [...this.skipList],
    }).isTranslatable;
  }

  shouldSkip(text: string): boolean {
    return evaluateTextEligibility({
      value: text,
      targetValue: undefined,
      skipList: [...this.skipList],
    }).shouldSkip;
  }

  needsTranslation(targetValue: unknown): boolean {
    return evaluateTextEligibility({
      value: "",
      targetValue,
      skipList: [...this.skipList],
    }).needsTranslation;
  }
}
