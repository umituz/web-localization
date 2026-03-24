/**
 * Translation Entity
 * @description Data structures for translation requests and responses
 */

export interface TranslationRequest {
  readonly text: string;
  readonly targetLanguage: string;
  readonly sourceLanguage?: string;
}

export interface TranslationResponse {
  readonly originalText: string;
  readonly translatedText: string;
  readonly sourceLanguage: string;
  readonly targetLanguage: string;
  readonly success: boolean;
  readonly error?: string;
  readonly cached?: boolean;
}

export interface TranslationItem {
  readonly key: string;
  readonly from: string;
  readonly to: string;
}

export interface TranslationStats {
  totalCount: number;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  translatedKeys: TranslationItem[];
}
