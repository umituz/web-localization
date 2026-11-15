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

export { GoogleTranslateStrategy, googleTranslateService } from "./application/strategies/google-translate.strategy";
export type { GoogleTranslateStrategyOptions } from "./application/strategies/google-translate.strategy";

export { TextValidator } from "./application/services/text-validator";
export { VariableProtector } from "./application/services/variable-protector";
export { TranslationCache } from "./application/services/translation-cache";
export { ObjectTreeWalker } from "./application/services/object-flattener";
export {
  opaqueExpression,
  isOpaqueExpression,
  opaqueExpressionSource,
  isInterpolatedTemplate,
} from "./application/services/opaque-expression";
export { extractKeysFromContent } from "./application/services/source-key-extractor";
export {
  setByDottedPath,
  flattenToDottedPaths,
  pruneToPaths,
} from "./application/services/dotted-key-helper";
export type { PruneResult } from "./application/services/dotted-key-helper";

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

export { GoogleTranslateHttpClient } from "./infrastructure/http/translation-http.client";

export { SourceKeyScanner } from "./infrastructure/scanning/source-key.scanner";
export type { SourceKeyScannerOptions } from "./infrastructure/scanning/source-key.scanner";

export {
  LocaleFileRepository,
  syncObjectStructure,
  serializeLocaleObject,
  serializeTypeScriptLocale,
} from "./infrastructure/persistence/locale-file.repository";
export type { LocaleWriteOutcome } from "./infrastructure/persistence/locale-file.repository";

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
  SourceDirectoryNotFoundError,
} from "./core/errors";

export type { Result, LanguageCode, Iso639Code, AbsolutePath } from "./core/types";
export { ResultUtils } from "./core/types";

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

export { HTTP, RATE_LIMIT, CACHE, LOCALE, GOOGLE_TRANSLATE, UI } from "./core/constants";
export {
  LANGUAGE_MAP,
  LANGUAGE_NAMES,
  getLanguageDisplayName,
  isSupportedLocale,
  getSupportedLocaleCodes,
} from "./core/constants/languages.constants";

export type {
  SetupI18nOptions,
  DetectionOptions,
  I18nHandle,
} from "./integrations/i18n.setup";
export { setupI18n, resetI18n } from "./integrations/i18n.setup";
