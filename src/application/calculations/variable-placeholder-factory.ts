/**
 * Variable Placeholder Factory
 * @description Generates and recognizes safe placeholders that protect
 * `{{token}}` interpolation variables from being altered by translators.
 *
 * Why: Translation APIs may translate, add spaces, or strip interpolation
 * tokens. By replacing them with placeholders that look like noise, we
 * guarantee they pass through unchanged.
 *
 * Placeholder format: `__WL_VAR_<index>__` — uppercase, underscores only.
 * This makes accidental translation extremely unlikely.
 */

export const VARIABLE_PLACEHOLDER_PREFIX = "__WL_VAR_";
export const VARIABLE_PLACEHOLDER_SUFFIX = "__";

/**
 * Build a placeholder for a given counter value.
 */
export function buildVariablePlaceholder(counter: number): string {
  return `${VARIABLE_PLACEHOLDER_PREFIX}${counter}${VARIABLE_PLACEHOLDER_SUFFIX}`;
}

/**
 * Build a regex that matches a placeholder, allowing optional whitespace
 * between characters (translators often insert spaces).
 *
 * Example: buildFlexiblePlaceholderMatcher(0) matches "  _  _ W L _ VAR _ 0 _ _ "
 */
export function buildFlexiblePlaceholderMatcher(counter: number): RegExp {
  const placeholder = buildVariablePlaceholder(counter);
  const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const flexible = escaped.split("").join("\\s*");
  return new RegExp(flexible, "g");
}

/**
 * Build a strict (no whitespace) regex for a specific placeholder string.
 * Used for detection, not restoration.
 */
export function buildStrictPlaceholderMatcher(placeholder: string): RegExp {
  const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escaped, "g");
}
