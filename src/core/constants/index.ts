/**
 * Core Constants - Centralized configuration
 * @description All magic numbers and configuration values live here.
 * Group constants by domain responsibility for clarity.
 */

export const HTTP = {
  DEFAULT_TIMEOUT_MS: 10_000,
  DEFAULT_MAX_RETRIES: 3,
  INITIAL_BACKOFF_MS: 2_000,
  BACKOFF_MULTIPLIER: 2,
} as const;

export const RATE_LIMIT = {
  DEFAULT_MIN_DELAY_MS: 100,
  DEFAULT_CONCURRENCY: 10,
  MAX_HISTORY_SIZE: 10,
  DYNAMIC_DELAY_MULTIPLIER: 1.5,
  DYNAMIC_DELAY_CAP_MULTIPLIER: 3,
} as const;

export const CACHE = {
  TRANSLATION_MAX_SIZE: 1_000,
  TRANSLATION_TTL_MS: 60 * 60 * 1_000, // 1 hour
  FILE_MAX_SIZE: 10_000_000, // 10MB
} as const;

export const LOCALE = {
  DEFAULT_BASE_LANGUAGE: "en-US",
  DEFAULT_LOCALES_DIR: "src/locales",
  DEFAULT_SOURCE_DIR: "src",
  LOCALE_FILE_PATTERN: /^[a-z]{2}(-[A-Z]{2})?\.ts$/,
} as const;

export const GOOGLE_TRANSLATE = {
  API_URL: "https://translate.googleapis.com/translate_a/single",
  BATCH_SIZE: 50,
  VARIABLE_PLACEHOLDER_PATTERN: /\{\{([^}]+)\}\}/g,
} as const;

export const UI = {
  PROGRESS_BAR_WIDTH: 30,
  MAX_DISPLAY_LENGTH: 40,
} as const;
