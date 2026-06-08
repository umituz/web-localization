/**
 * Text Case Applier
 * @description Applies named text-case transformations used by i18next
 * interpolation `format` callbacks. Returns the input unchanged when
 * no known case is specified.
 *
 * Supported cases:
 * - "uppercase"   → "hello"   → "HELLO"
 * - "lowercase"   → "HELLO"   → "hello"
 * - "capitalize"  → "hello"   → "Hello"
 * - "titlecase"   → "hello world" → "Hello World"
 * - undefined/""  → unchanged
 */
export type TextCaseFormat = "uppercase" | "lowercase" | "capitalize" | "titlecase" | "" | undefined;

export function applyTextCase(value: unknown, format: TextCaseFormat | string | undefined): string {
  if (typeof value !== "string") {
    return String(value ?? "");
  }
  switch (format) {
    case "uppercase":
      return value.toUpperCase();
    case "lowercase":
      return value.toLowerCase();
    case "capitalize":
      return value.charAt(0).toUpperCase() + value.slice(1);
    case "titlecase":
      return value
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
    default:
      return value;
  }
}
