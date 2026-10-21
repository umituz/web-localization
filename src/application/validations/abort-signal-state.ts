import { TranslationAbortedError } from "../../core/errors";

export function assertNotAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new TranslationAbortedError();
  }
}

export function isAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted ?? false;
}
