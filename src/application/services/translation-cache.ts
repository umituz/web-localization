/**
 * Translation Cache
 * @description LRU cache for translation results. Keyed by source|target|text.
 *
 * Why a separate class:
 * - Testable in isolation
 * - Reusable across strategies (Google, DeepL, etc.)
 * - Cache statistics isolated from translation logic
 */
import { LRUCache } from "../../core/utils/lru-cache";
import { CACHE } from "../../core/constants";

export interface CacheKey {
  readonly source: string;
  readonly target: string;
  readonly text: string;
}

export class TranslationCache {
  private readonly store = new LRUCache<string, string>(CACHE.TRANSLATION_MAX_SIZE);

  get(key: CacheKey): string | null {
    return this.store.get(this.formatKey(key)) ?? null;
  }

  set(key: CacheKey, translation: string): void {
    this.store.set(this.formatKey(key), translation);
  }

  has(key: CacheKey): boolean {
    return this.store.has(this.formatKey(key));
  }

  clear(): void {
    this.store.clear();
  }

  stats(): { size: number; maxSize: number } {
    return this.store.stats();
  }

  private formatKey(key: CacheKey): string {
    return `${key.source}|${key.target}|${key.text}`;
  }
}
