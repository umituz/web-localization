import type {
  TranslationRequest,
  TranslationResponse,
  TranslationStats,
} from "../entities/translation.entity";

/**
 * Translation Service Config
 */
export interface TranslationServiceConfig {
  minDelay?: number;
  maxRetries?: number;
  timeout?: number;
  apiKey?: string; // Optional if using public API
}

/**
 * Translation Service Interface
 */
export interface ITranslationService {
  initialize(config: TranslationServiceConfig): void;
  isInitialized(): boolean;
  translate(request: TranslationRequest): Promise<TranslationResponse>;
  translateBatch(requests: TranslationRequest[]): Promise<TranslationStats>;
  translateObject(
    sourceObject: Record<string, unknown>,
    targetObject: Record<string, unknown>,
    targetLanguage: string,
    path?: string,
    stats?: TranslationStats,
    onTranslate?: (key: string, from: string, to: string) => void,
    force?: boolean
  ): Promise<void>;
}
