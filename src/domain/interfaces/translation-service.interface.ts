/**
 * Translation Service Interface
 * @description Strategy contract. Multiple implementations (Google, DeepL, Azure) can implement this.
 */

import type {
  TranslationRequest,
  TranslationResponse,
  TranslationStats,
} from "../entities/translation.entity";
import type { Iso639Code } from "../../core/types/branded";
import type { ProgressEmitter } from "../../core/utils";

export interface TranslationServiceConfig {
  readonly minDelayMs?: number;
  readonly timeoutMs?: number;
  readonly apiKey?: string;
  readonly maxRetries?: number;
  readonly cacheEnabled?: boolean;
}

/**
 * Callback invoked for each successful translation of a leaf key.
 * @description Lets consumers stream progress without coupling to I/O.
 */
export type TranslationProgressHandler = (key: string, from: string, to: string) => void;

/**
 * Object translation contract for tree-shaped locale files.
 */
export interface ObjectTranslationContext {
  readonly source: Record<string, unknown>;
  readonly target: Record<string, unknown>;
  readonly targetLanguage: Iso639Code;
  readonly force?: boolean;
  readonly onProgress?: TranslationProgressHandler;
}

export interface ObjectTranslationOptions {
  readonly signal?: AbortSignal;
  readonly emitter?: ProgressEmitter;
}

export interface ITranslationStrategy {
  readonly name: string;

  translate(request: TranslationRequest, signal?: AbortSignal): Promise<TranslationResponse>;
  translateBatch(
    requests: readonly TranslationRequest[],
    signal?: AbortSignal,
    emitter?: ProgressEmitter
  ): Promise<TranslationStats>;
  translateObject(
    context: ObjectTranslationContext,
    options?: ObjectTranslationOptions
  ): Promise<TranslationStats>;
  clearCache(): void;
  getCacheStats(): { size: number; maxSize: number };
  dispose(): void;
}
