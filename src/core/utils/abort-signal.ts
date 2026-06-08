/**
 * Cancellation Helper
 * @description Re-exports from validations/abort-signal-state for backward
 * naming convenience. Implementation lives in the validations layer.
 */
import { TranslationAbortedError } from "../errors";
import {
  assertNotAborted,
  isAborted,
} from "../../application/validations/abort-signal-state";

export { assertNotAborted as throwIfAborted, isAborted };
export { assertNotAborted };

/**
 * @deprecated Use `isAborted` from validations/abort-signal-state directly.
 * Kept for compatibility with the original core/utils API surface.
 */
export function abortErrorHandler(_signal: AbortSignal): () => void {
  return () => {
    throw new TranslationAbortedError();
  };
}

export type AbortablePromise<T> = Promise<T>;

/**
 * Races a promise against an AbortSignal.
 */
export function withAbort<T>(promise: Promise<T>, signal: AbortSignal | undefined): AbortablePromise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new TranslationAbortedError());

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new TranslationAbortedError());
    signal.addEventListener("abort", onAbort, { once: true });

    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (err) => {
        signal.removeEventListener("abort", onAbort);
        reject(err);
      }
    );
  });
}
