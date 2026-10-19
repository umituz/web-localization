/**
 * Default translator — the zero-config fallback when no i18n runtime
 * is provided. Humanizes catalog keys into sentence case
 * ("auth.login.welcomeBack" → "Welcome back") and interpolates
 * `{{param}}` placeholders when the humanized text carries one.
 * Params the text cannot place are ignored — real interpolation is
 * the runtime's job via the I18nProvider bridge.
 */

import type { TranslateFn } from "./types";

/** Split a key segment into words: camelCase, snake_case, kebab-case. */
const WORD_SPLIT = /[._-]+|(?<=[a-z0-9])(?=[A-Z])/g;

const humanizeSegment = (segment: string): string => {
  const words = segment.split(WORD_SPLIT).filter(Boolean);
  if (words.length === 0) return segment;
  const sentence = words.join(" ").toLowerCase();
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
};

/** Replace `{{param}}` placeholders with param values. */
const interpolate = (text: string, params?: Record<string, unknown>): string => {
  if (!params) return text;
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
};

export const defaultT: TranslateFn = (key, params) => {
  const segments = key.split(".").filter(Boolean);
  const source = segments[segments.length - 1] ?? key;
  return interpolate(humanizeSegment(source), params);
};
