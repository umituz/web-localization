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
