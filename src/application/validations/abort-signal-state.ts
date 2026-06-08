/**
 * Abort Signal State Guard
 * @description Centralized check for whether an AbortSignal has been triggered.
 * Throws `TranslationAbortedError` if so. This is the only place this error
 * is constructed for "aborted" conditions, ensuring consistent behavior.
 */
import { TranslationAbortedError } from "../../core/errors";

export function assertNotAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new TranslationAbortedError();
  }
}

export function isAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted ?? false;
}
