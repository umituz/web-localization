import { useCallback, useState } from "react";
import { googleTranslateService } from "../application/strategies/google-translate.strategy";
import { TranslationStats } from "../domain/entities/translation.entity";
import type {
  TranslationRequest,
  TranslationResponse,
} from "../domain/entities/translation.entity";
import type { Iso639Code } from "../core/types/branded";

export interface UseTranslationOptions {
  readonly onSuccess?: (result: TranslationResponse) => void;
  readonly onError?: (error: Error) => void;
}

export interface UseTranslationReturn {
  readonly translate: (
    text: string,
    targetLanguage: string
  ) => Promise<TranslationResponse>;
  readonly isLoading: boolean;
  readonly error: Error | null;
}

export function useTranslation(options?: UseTranslationOptions): UseTranslationReturn {
  const { onSuccess, onError } = options ?? {};
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const translate = useCallback(
    async (text: string, targetLanguage: string): Promise<TranslationResponse> => {
      if (text.trim().length === 0 || targetLanguage.trim().length === 0) {
        return {
          originalText: text,
          translatedText: text,
          sourceLanguage: "en" as Iso639Code,
          targetLanguage: targetLanguage as Iso639Code,
          success: false,
          error: "Text or target language is empty",
        };
      }

      setIsLoading(true);
      setError(null);

      try {
        const request: TranslationRequest = {
          text,
          targetLanguage: targetLanguage as Iso639Code,
        };
        const result = await googleTranslateService.translate(request);

        if (result.success) {
          onSuccess?.(result);
        } else {
          const failure = new Error(result.error ?? "Translation failed");
          setError(failure);
          onError?.(failure);
        }

        return result;
      } catch (err) {
        const failure = err instanceof Error ? err : new Error("Unknown error occurred");
        setError(failure);
        onError?.(failure);
        throw failure;
      } finally {
        setIsLoading(false);
      }
    },
    [onSuccess, onError]
  );

  return { translate, isLoading, error };
}

export interface UseBatchTranslationOptions {
  readonly onSuccess?: (stats: TranslationStats) => void;
  readonly onError?: (error: Error) => void;
  readonly onProgress?: (completed: number, total: number) => void;
}

export interface UseBatchTranslationReturn {
  readonly translateBatch: (
    requests: readonly TranslationRequest[]
  ) => Promise<TranslationStats>;
  readonly translateObject: (
    source: Record<string, unknown>,
    target: Record<string, unknown>,
    targetLanguage: string
  ) => Promise<TranslationStats>;
  readonly isLoading: boolean;
  readonly progress: number;
  readonly total: number;
  readonly error: Error | null;
}

export function useBatchTranslation(
  options?: UseBatchTranslationOptions
): UseBatchTranslationReturn {
  const { onSuccess, onError, onProgress } = options ?? {};
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);

  const translateBatch = useCallback(
    async (requests: readonly TranslationRequest[]): Promise<TranslationStats> => {
      if (requests.length === 0) {
        return TranslationStats.empty();
      }

      setIsLoading(true);
      setError(null);
      setTotal(requests.length);
      setProgress(0);

      try {
        const stats = await googleTranslateService.translateBatch(requests);
        setProgress(stats.processedCount);
        onProgress?.(stats.processedCount, requests.length);

        if (stats.failureCount > 0) {
          const failure = new Error(
            `${stats.failureCount} of ${stats.totalCount} translations failed`
          );
          setError(failure);
          onError?.(failure);
        } else {
          onSuccess?.(stats);
        }

        return stats;
      } catch (err) {
        const failure = err instanceof Error ? err : new Error("Unknown error occurred");
        setError(failure);
        onError?.(failure);
        throw failure;
      } finally {
        setIsLoading(false);
      }
    },
    [onSuccess, onError, onProgress]
  );

  const translateObject = useCallback(
    async (
      source: Record<string, unknown>,
      target: Record<string, unknown>,
      targetLanguage: string
    ): Promise<TranslationStats> => {
      if (typeof source !== "object" || source === null) {
        throw new Error("Source object is invalid");
      }
      if (typeof target !== "object" || target === null) {
        throw new Error("Target object is invalid");
      }
      if (targetLanguage.trim().length === 0) {
        throw new Error("Target language is required");
      }

      setIsLoading(true);
      setError(null);
      setProgress(0);
      setTotal(0);

      try {
        let completed = 0;
        const stats = await googleTranslateService.translateObject({
          source,
          target,
          targetLanguage: targetLanguage as Iso639Code,
          onProgress: () => {
            completed++;
            setProgress(completed);
          },
        });

        setTotal(stats.totalCount);
        setProgress(stats.processedCount);
        onProgress?.(stats.processedCount, stats.totalCount);

        if (stats.failureCount > 0) {
          const failure = new Error(
            `${stats.failureCount} of ${stats.totalCount} translations failed`
          );
          setError(failure);
          onError?.(failure);
        } else {
          onSuccess?.(stats);
        }

        return stats;
      } catch (err) {
        const failure = err instanceof Error ? err : new Error("Unknown error occurred");
        setError(failure);
        onError?.(failure);
        throw failure;
      } finally {
        setIsLoading(false);
      }
    },
    [onSuccess, onError, onProgress]
  );

  return { translateBatch, translateObject, isLoading, progress, total, error };
}
