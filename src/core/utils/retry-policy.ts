import { TranslationAbortedError } from "../errors";
import { assertNotAborted } from "../../application/validations/abort-signal-state";
import { computeExponentialBackoff } from "../../application/calculations/exponential-backoff";

export interface RetryPolicyOptions {
  readonly maxRetries: number;
  readonly initialBackoffMs: number;
  readonly backoffMultiplier: number;
  readonly maxBackoffMs?: number;
  readonly isRetryable?: (error: unknown) => boolean;
}

export class RetryPolicy {
  constructor(private readonly options: RetryPolicyOptions) {}

  async execute<T>(operation: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    const { maxRetries, isRetryable } = this.options;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      assertNotAborted(signal);

      try {
        return await operation();
      } catch (error) {
        if (error instanceof TranslationAbortedError) {
          throw error;
        }

        lastError = error;

        if (isRetryable && !isRetryable(error)) {
          throw error;
        }

        if (attempt === maxRetries) {
          break;
        }

        const delay = computeExponentialBackoff({
          attempt,
          initialDelayMs: this.options.initialBackoffMs,
          multiplier: this.options.backoffMultiplier,
          ...(this.options.maxBackoffMs !== undefined
            ? { capMs: this.options.maxBackoffMs }
            : {}),
        });

        await this.sleepAbortable(delay, signal);
      }
    }

    throw lastError;
  }

  private sleepAbortable(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const onAbort = (): void => {
        clearTimeout(timer);
        reject(new TranslationAbortedError());
      };

      const timer = setTimeout(() => {

        signal?.removeEventListener("abort", onAbort);
        resolve();
      }, ms);

      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }
}
