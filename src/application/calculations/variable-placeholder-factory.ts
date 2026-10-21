export const VARIABLE_PLACEHOLDER_PREFIX = "__WL_VAR_";
export const VARIABLE_PLACEHOLDER_SUFFIX = "__";

export function buildVariablePlaceholder(counter: number): string {
  return `${VARIABLE_PLACEHOLDER_PREFIX}${counter}${VARIABLE_PLACEHOLDER_SUFFIX}`;
}

export function buildFlexiblePlaceholderMatcher(counter: number): RegExp {
  const placeholder = buildVariablePlaceholder(counter);
  const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const flexible = escaped.split("").join("\\s*");
  return new RegExp(flexible, "g");
}

export function buildStrictPlaceholderMatcher(placeholder: string): RegExp {
  const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escaped, "g");
}
