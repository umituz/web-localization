import type { Iso639Code } from "../../core/types/branded";

export interface TranslationRequest {
  readonly text: string;
  readonly targetLanguage: Iso639Code;
  readonly sourceLanguage?: Iso639Code;
}

export interface TranslationResponse {
  readonly originalText: string;
  readonly translatedText: string;
  readonly sourceLanguage: Iso639Code;
  readonly targetLanguage: Iso639Code;
  readonly success: boolean;
  readonly error?: string;
  readonly cached?: boolean;
}

export interface TranslationItem {
  readonly key: string;
  readonly from: string;
  readonly to: string;
}

export class TranslationStats {
  private constructor(
    public readonly totalCount: number,
    public readonly successCount: number,
    public readonly failureCount: number,
    public readonly skippedCount: number,
    public readonly translatedKeys: readonly TranslationItem[]
  ) {
    if (totalCount < 0 || successCount < 0 || failureCount < 0 || skippedCount < 0) {
      throw new Error("TranslationStats counts cannot be negative");
    }
  }

  static empty(): TranslationStats {
    return new TranslationStats(0, 0, 0, 0, []);
  }

  static initial(totalCount: number): TranslationStats {
    return new TranslationStats(totalCount, 0, 0, 0, []);
  }

  withSuccess(item: TranslationItem): TranslationStats {
    return new TranslationStats(
      this.totalCount,
      this.successCount + 1,
      this.failureCount,
      this.skippedCount,
      [...this.translatedKeys, item]
    );
  }

  withFailure(): TranslationStats {
    return new TranslationStats(
      this.totalCount,
      this.successCount,
      this.failureCount + 1,
      this.skippedCount,
      this.translatedKeys
    );
  }

  withSkip(): TranslationStats {
    return new TranslationStats(
      this.totalCount,
      this.successCount,
      this.failureCount,
      this.skippedCount + 1,
      this.translatedKeys
    );
  }

  merge(other: TranslationStats): TranslationStats {
    return new TranslationStats(
      this.totalCount,
      this.successCount + other.successCount,
      this.failureCount + other.failureCount,
      this.skippedCount + other.skippedCount,
      [...this.translatedKeys, ...other.translatedKeys]
    );
  }

  get processedCount(): number {
    return this.successCount + this.failureCount + this.skippedCount;
  }
}
