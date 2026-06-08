/**
 * Config Field Shape Guard
 * @description Asserts that a config field has the expected primitive shape.
 * Throws `InvalidConfigError` with the field name and reason on failure.
 *
 * Why: catching misconfiguration at startup (vs. mid-translation) is critical
 * for a good developer experience.
 */
import { InvalidConfigError } from "../../core/errors";

export type ConfigPrimitive = "string" | "number" | "boolean" | "integer";

export interface ConfigFieldCheckInput {
  readonly fieldName: string;
  readonly value: unknown;
  readonly expectedType: ConfigPrimitive;
  readonly minValue?: number;
  readonly maxValue?: number;
  readonly allowNull?: boolean;
}

export function assertConfigFieldShape(input: ConfigFieldCheckInput): void {
  const { fieldName, value, expectedType, minValue, maxValue, allowNull } = input;

  if (value === null || value === undefined) {
    if (allowNull) return;
    throw new InvalidConfigError(fieldName, value, "value is required");
  }

  switch (expectedType) {
    case "string":
      if (typeof value !== "string") {
        throw new InvalidConfigError(fieldName, value, "expected string");
      }
      if (value.length === 0) {
        throw new InvalidConfigError(fieldName, value, "string cannot be empty");
      }
      return;

    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new InvalidConfigError(fieldName, value, "expected finite number");
      }
      assertNumberBounds(fieldName, value, minValue, maxValue);
      return;

    case "integer":
      if (typeof value !== "number" || !Number.isInteger(value)) {
        throw new InvalidConfigError(fieldName, value, "expected integer");
      }
      assertNumberBounds(fieldName, value, minValue, maxValue);
      return;

    case "boolean":
      if (typeof value !== "boolean") {
        throw new InvalidConfigError(fieldName, value, "expected boolean");
      }
      return;
  }
}

function assertNumberBounds(
  fieldName: string,
  value: number,
  minValue: number | undefined,
  maxValue: number | undefined
): void {
  if (minValue !== undefined && value < minValue) {
    throw new InvalidConfigError(fieldName, value, `must be >= ${minValue}`);
  }
  if (maxValue !== undefined && value > maxValue) {
    throw new InvalidConfigError(fieldName, value, `must be <= ${maxValue}`);
  }
}
