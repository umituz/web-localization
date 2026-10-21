import { TranslationAbortedError } from "../errors";
import {
  assertNotAborted,
  isAborted,
} from "../../application/validations/abort-signal-state";

export { assertNotAborted as throwIfAborted, isAborted };
export { assertNotAborted };

export function abortErrorHandler(_signal: AbortSignal): () => void {
  return () => {
    throw new TranslationAbortedError();
  };
}

export type AbortablePromise<T> = Promise<T>;

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
