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
