const EXPRESSION_PREFIX = "\u0000@expr:";

/**
 * Wraps a TypeScript expression (e.g. `BRAND.tagline.tr`) so it can travel
 * through sync/translate as a string leaf without being treated as copy.
 */
export function opaqueExpression(source: string): string {
  return `${EXPRESSION_PREFIX}${source}`;
}

export function isOpaqueExpression(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(EXPRESSION_PREFIX);
}

export function opaqueExpressionSource(value: string): string {
  return isOpaqueExpression(value) ? value.slice(EXPRESSION_PREFIX.length) : value;
}

const INTERPOLATION_INNER = /^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*)*$/;

/**
 * True for strings whose `${...}` segments all look like identifier/member
 * chains — these are safe to re-emit as template literals.
 */
export function isInterpolatedTemplate(value: string): boolean {
  const pattern = /\$\{([^}]*)\}/g;
  let match: RegExpExecArray | null;
  let found = false;
  while ((match = pattern.exec(value)) !== null) {
    found = true;
    const inner = match[1]?.trim() ?? "";
    if (!INTERPOLATION_INNER.test(inner)) return false;
  }
  return found;
}
