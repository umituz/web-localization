/**
 * @umituz/web-localization
 * Google Translate integrated localization package for web applications.
 *
 * Public API surface — explicit, named exports only.
 * Internal modules are not re-exported to keep the contract stable.
 */

// ============================================================================
// Domain: Translation Types
// ============================================================================
export type {
  TranslationRequest,
  TranslationResponse,
  TranslationItem,
} from "./domain/entities/translation.entity";
export { TranslationStats } from "./domain/entities/translation.entity";

export type {
  TranslationServiceConfig,
  TranslationProgressHandler,
  ObjectTranslationContext,
  ObjectTranslationOptions,
  ITranslationStrategy,
} from "./domain/interfaces/translation-service.interface";

// ============================================================================
// Application: Translation Strategies
// ============================================================================
export { GoogleTranslateStrategy, googleTranslateService } from "./application/strategies/google-translate.strategy";
export type { GoogleTranslateStrategyOptions } from "./application/strategies/google-translate.strategy";

// ============================================================================
// Application: Text Processing
// ============================================================================
export { TextValidator } from "./application/services/text-validator";
export { VariableProtector } from "./application/services/variable-protector";
export { TranslationCache } from "./application/services/translation-cache";
export { ObjectTreeWalker } from "./application/services/object-flattener";

// ============================================================================
// Application: Calculations
// ============================================================================
export {
  computeExponentialBackoff,
  SlidingWindowAverage,
  applyTextCase,
  buildVariablePlaceholder,
  buildFlexiblePlaceholderMatcher,
  buildStrictPlaceholderMatcher,
  mergeTranslationSegments,
  computeRateLimitDelay,
  computeDynamicDelay,
  selectOldestEvictionKey,
  shouldEvictToMakeRoom,
  calculateElapsedMs,
  isWithinTtl,
  isTtlExpired,
  buildGoogleTranslateUrl,
  extractIso639Code,
  extractLocaleCodeFromFilename,
} from "./application/calculations";
export type {
  ExponentialBackoffInput,
  TextCaseFormat,
  RateLimitDelayInput,
  DynamicDelayInput,
  GoogleTranslateUrlInput,
} from "./application/calculations";

// ============================================================================
// Application: Validations
// ============================================================================
export {
  assertPathWithinProjectRoot,
  evaluateTextEligibility,
  isRetryableHttpStatus,
  isNetworkLevelFailure,
  assertFileSizeWithinBound,
  assertConfigFieldShape,
  assertNotAborted,
  isAborted,
  isLocaleFilename,
} from "./application/validations";
export type {
  PathTraversalCheckInput,
  TextEligibility,
  TranslationTextEligibilityInput,
  FileSizeBoundInput,
  ConfigPrimitive,
  ConfigFieldCheckInput,
} from "./application/validations";

// ============================================================================
// Infrastructure: HTTP
// ============================================================================
export { GoogleTranslateHttpClient } from "./infrastructure/http/translation-http.client";

// ============================================================================
// Infrastructure: File System
// ============================================================================
export {
  LocaleFileRepository,
  syncObjectStructure,
  serializeLocaleObject,
} from "./infrastructure/persistence/locale-file.repository";

// ============================================================================
// Core: Errors
// ============================================================================
export {
  LocalizationError,
  LocaleFileNotFoundError,
  LocaleParseError,
  LocaleFileSizeError,
  PathTraversalError,
  TranslationHttpError,
  TranslationValidationError,
  TranslationTimeoutError,
  TranslationAbortedError,
  InvalidConfigError,
  AlreadyInitializedError,
} from "./core/errors";

// ============================================================================
// Core: Types
// ============================================================================
export type { Result, LanguageCode, Iso639Code, AbsolutePath } from "./core/types";
export { ResultUtils } from "./core/types";

// ============================================================================
// Core: Utilities
// ============================================================================
export {
  Semaphore,
  sleep,
  LRUCache,
  RetryPolicy,
  RateLimiter,
  throwIfAborted,
  withAbort,
  ProgressEmitter,
  NullProgressEmitter,
} from "./core/utils";
export type {
  RetryPolicyOptions,
  RateLimiterOptions,
  TTLEntry,
  AbortablePromise,
  ProgressEvent,
  ProgressEventType,
} from "./core/utils";

// ============================================================================
// Core: Constants
// ============================================================================
export { HTTP, RATE_LIMIT, CACHE, LOCALE, GOOGLE_TRANSLATE, UI } from "./core/constants";

// ============================================================================
// Integrations: i18n Setup
// ============================================================================
export type {
  SetupI18nOptions,
  DetectionOptions,
  SeoIntegrationOptions,
  I18nHandle,
} from "./integrations/i18n.setup";
export { setupI18n, resetI18n } from "./integrations/i18n.setup";
