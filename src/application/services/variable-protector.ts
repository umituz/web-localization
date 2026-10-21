import { GOOGLE_TRANSLATE } from "../../core/constants";
import {
  buildVariablePlaceholder,
  buildFlexiblePlaceholderMatcher,
} from "../calculations/variable-placeholder-factory";

export interface ProtectedText {
  readonly safeText: string;
  readonly placeholders: ReadonlyMap<string, string>;
}

export class VariableProtector {

  protect(text: string): ProtectedText {
    const placeholders = new Map<string, string>();
    let counter = 0;

    const safeText = text.replace(
      GOOGLE_TRANSLATE.VARIABLE_PLACEHOLDER_PATTERN,
      (_match, inner) => {
        const placeholder = buildVariablePlaceholder(counter);
        placeholders.set(placeholder, `{{${inner}}}`);
        counter++;
        return placeholder;
      }
    );

    return { safeText, placeholders };
  }

  restore(translated: string, placeholders: ReadonlyMap<string, string>): string {
    if (placeholders.size === 0) return translated;

    let result = translated;
    for (const [placeholder, original] of placeholders) {
      const regex = buildFlexiblePlaceholderMatcher(
        this.extractCounter(placeholder)
      );
      result = result.replace(regex, original);
    }
    return result;
  }

  private extractCounter(placeholder: string): number {
    const stripped = placeholder
      .replace("__WL_VAR_", "")
      .replace("__", "");
    return Number.parseInt(stripped, 10);
  }
}
