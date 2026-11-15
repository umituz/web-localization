export abstract class LocalizationError extends Error {
  abstract readonly code: string;

  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = this.constructor.name;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class LocaleFileNotFoundError extends LocalizationError {
  readonly code = "LOCALE_FILE_NOT_FOUND";
  constructor(public readonly filePath: string) {
    super(`Locale file not found: ${filePath}`);
  }
}

export class LocaleParseError extends LocalizationError {
  readonly code = "LOCALE_PARSE_ERROR";
  constructor(
    public readonly filePath: string,
    public readonly position: number,
    public readonly reason: string
  ) {
    super(`Failed to parse ${filePath} at position ${position}: ${reason}`);
  }
}

export class LocaleFileSizeError extends LocalizationError {
  readonly code = "LOCALE_FILE_TOO_LARGE";
  constructor(
    public readonly filePath: string,
    public readonly size: number,
    public readonly maxSize: number
  ) {
    super(`Locale file ${filePath} is ${size} bytes, exceeds maximum of ${maxSize}`);
  }
}

export class PathTraversalError extends LocalizationError {
  readonly code = "PATH_TRAVERSAL_BLOCKED";
  constructor(public readonly attemptedPath: string, public readonly projectRoot: string) {
    super(
      `Path traversal blocked: ${attemptedPath} resolves outside project root ${projectRoot}`
    );
  }
}

export class TranslationHttpError extends LocalizationError {
  readonly code = "TRANSLATION_HTTP_ERROR";
  constructor(
    public readonly statusCode: number,
    message: string,
    cause?: unknown
  ) {
    super(message, cause);
  }

  get isRetryable(): boolean {
    return this.statusCode === 429 || this.statusCode >= 500;
  }
}

export class TranslationValidationError extends LocalizationError {
  readonly code = "TRANSLATION_VALIDATION_ERROR";
  constructor(
    public readonly text: string,
    public readonly reason: string
  ) {
    super(`Translation validation failed for text "${text}": ${reason}`);
  }
}

export class TranslationTimeoutError extends LocalizationError {
  readonly code = "TRANSLATION_TIMEOUT";
  constructor(public readonly timeoutMs: number) {
    super(`Translation request timed out after ${timeoutMs}ms`);
  }
}

export class TranslationAbortedError extends LocalizationError {
  readonly code = "TRANSLATION_ABORTED";
  constructor() {
    super("Translation was aborted");
  }
}

/**
 * The translation endpoint refused too many consecutive requests (typically
 * HTTP 429 IP throttling on the unofficial endpoint). The strategy opens its
 * circuit and every further call fails immediately — retrying the whole key
 * queue against a throttling endpoint would take hours and produce nothing.
 */
export class TranslationCircuitOpenError extends LocalizationError {
  readonly code = "TRANSLATION_CIRCUIT_OPEN";
  constructor(failures: number, lastErrorNote?: string) {
    super(
      `Translation API refused ${failures} consecutive requests${
        lastErrorNote ? ` (last: ${lastErrorNote})` : ""
      }. The endpoint is rate-limiting this client — stop and retry later, or set GOOGLE_TRANSLATE_API_KEY to use the official API.`
    );
  }
}

export class InvalidConfigError extends LocalizationError {
  readonly code = "INVALID_CONFIG";
  constructor(
    public readonly field: string,
    public readonly value: unknown,
    public readonly reason: string
  ) {
    super(`Invalid config value for "${field}": ${reason} (got: ${JSON.stringify(value)})`);
  }
}

export class AlreadyInitializedError extends LocalizationError {
  readonly code = "ALREADY_INITIALIZED";
  constructor(public readonly context: string) {
    super(`${context} is already initialized`);
  }
}

export class SourceDirectoryNotFoundError extends LocalizationError {
  readonly code = "SOURCE_DIR_NOT_FOUND";
  constructor(public readonly sourceDir: string) {
    super(`Source directory not found: ${sourceDir}`);
  }
}
