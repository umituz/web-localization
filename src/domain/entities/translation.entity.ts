/**
 * Translation Domain Entities
 * @description Pure data structures representing the translation domain.
 * No behavior — use services in application/infrastructure layers for operations.
 *
 * Immutability: all entities are deeply readonly. Stats uses a builder-style
 * immutable class.
 */

import type { Iso639Code } from "../../core/types/branded";

/**
 * Request to translate a single text.
 */
export interface TranslationRequest {
  readonly text: string;
  readonly targetLanguage: Iso639Code;
  readonly sourceLanguage?: Iso639Code;
}

/**
 * Response from a single translation request.
 */
export interface TranslationResponse {
  readonly originalText: string;
  readonly translatedText: string;
  readonly sourceLanguage: Iso639Code;
  readonly targetLanguage: Iso639Code;
  readonly success: boolean;
  readonly error?: string;
  readonly cached?: boolean;
}

/**
 * Single translated entry, typically a leaf key in a nested locale file.
 */
export interface TranslationItem {
  readonly key: string;
  readonly from: string;
  readonly to: string;
}

/**
 * Immutable statistics for a translation batch.
 * @description Built via factory + `with*` methods. Never mutated.
 *
 * Why a class: type-safe factory methods return the same shape; private
 * constructor forces use of factories (no accidental `new` with bad data).
 */
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

  /**
   * Derived: total processed = success + failure + skipped.
   */
  get processedCount(): number {
    return this.successCount + this.failureCount + this.skippedCount;
  }
}
