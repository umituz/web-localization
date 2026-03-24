/**
 * Google Translate Service with Performance Optimizations
 * @description Main translation service using Google Translate API with caching and pooling
 */

import type {
  TranslationRequest,
  TranslationResponse,
  TranslationStats,
} from "../../domain/entities/translation.entity.js";
import type {
  ITranslationService,
  TranslationServiceConfig,
} from "../../domain/interfaces/translation-service.interface.js";
import { RateLimiter } from "../utils/rate-limit.util.js";
import {
  shouldSkipWord,
  needsTranslation,
  isValidText,
} from "../utils/text-validator.util.js";
import {
  GOOGLE_TRANSLATE_API_URL,
  DEFAULT_MIN_DELAY,
  DEFAULT_TIMEOUT,
  DEFAULT_MAX_RETRIES,
  TRANSLATION_BATCH_SIZE,
  TRANSLATION_CONCURRENCY_LIMIT,
} from "../constants/index.js";

/**
 * Translation cache entry with TTL support
 */
interface CacheEntry {
  translation: string;
  timestamp: number;
  accessCount: number;
}

/**
 * Object pool for reusing Map instances
 */
class MapPool {
  private pool: Map<string, string>[] = [];
  private readonly maxPoolSize = 10;

  acquire(): Map<string, string> {
    return this.pool.pop() || new Map<string, string>();
  }

  release(map: Map<string, string>): void {
    if (map.size === 0 && this.pool.length < this.maxPoolSize) {
      this.pool.push(map);
    }
  }

  clear(): void {
    this.pool.length = 0;
  }
}

class GoogleTranslateService implements ITranslationService {
  private config: TranslationServiceConfig | null = null;
  private _rateLimiter: RateLimiter | null = null;

  // Translation cache with LRU-style eviction
  private translationCache = new Map<string, CacheEntry>();
  private readonly maxCacheSize = 1000;
  private readonly cacheTTL = 1000 * 60 * 60; // 1 hour

  // Object pools
  private readonly mapPool = new MapPool();

  // Performance tracking
  private activeRequests = 0;
  private readonly maxConcurrentRequests = 20;

  initialize(config: TranslationServiceConfig): void {
    this.config = {
      minDelay: DEFAULT_MIN_DELAY,
      timeout: DEFAULT_TIMEOUT,
      ...config,
    };
    this._rateLimiter = new RateLimiter(this.config.minDelay);
  }

  isInitialized(): boolean {
    return this.config !== null && this._rateLimiter !== null;
  }

  private get rateLimiter(): RateLimiter {
    if (!this._rateLimiter) {
      throw new Error("RateLimiter not initialized");
    }
    return this._rateLimiter;
  }

  private ensureInitialized(): void {
    if (!this.isInitialized()) {
      throw new Error(
        "GoogleTranslateService is not initialized. Call initialize() first."
      );
    }
  }

  /**
   * Generate cache key for translation
   */
  private getCacheKey(text: string, targetLang: string, sourceLang: string): string {
    return `${sourceLang}|${targetLang}|${text}`;
  }

  /**
   * Get translation from cache
   */
  private getFromCache(text: string, targetLang: string, sourceLang: string): string | null {
    const key = this.getCacheKey(text, targetLang, sourceLang);
    const entry = this.translationCache.get(key);

    if (!entry) return null;

    // Check if entry has expired
    const now = Date.now();
    if (now - entry.timestamp > this.cacheTTL) {
      this.translationCache.delete(key);
      return null;
    }

    // Update access count and timestamp for LRU
    entry.accessCount++;
    entry.timestamp = now;

    return entry.translation;
  }

  /**
   * Store translation in cache with automatic eviction
   */
  private storeInCache(text: string, targetLang: string, sourceLang: string, translation: string): void {
    // If cache is full, remove least recently used entries
    if (this.translationCache.size >= this.maxCacheSize) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      for (const [key, entry] of this.translationCache) {
        if (entry.timestamp < oldestTime) {
          oldestTime = entry.timestamp;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        this.translationCache.delete(oldestKey);
      }
    }

    const key = this.getCacheKey(text, targetLang, sourceLang);
    this.translationCache.set(key, {
      translation,
      timestamp: Date.now(),
      accessCount: 1,
    });
  }

  /**
   * Clear translation cache
   */
  clearCache(): void {
    this.translationCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.translationCache.size,
      maxSize: this.maxCacheSize,
    };
  }

  async translate(request: TranslationRequest): Promise<TranslationResponse> {
    this.ensureInitialized();

    const { text, targetLanguage, sourceLanguage = "en" } = request;

    if (!isValidText(text) || shouldSkipWord(text)) {
      return {
        originalText: text,
        translatedText: text,
        sourceLanguage,
        targetLanguage,
        success: true,
      };
    }

    if (!targetLanguage || targetLanguage.trim().length === 0) {
      return {
        originalText: text,
        translatedText: text,
        sourceLanguage,
        targetLanguage,
        success: false,
        error: "Invalid target language",
      };
    }

    // Check cache first
    const cachedTranslation = this.getFromCache(text, targetLanguage, sourceLanguage);
    if (cachedTranslation !== null) {
      return {
        originalText: text,
        translatedText: cachedTranslation,
        sourceLanguage,
        targetLanguage,
        success: true,
        cached: true,
      };
    }

    // Wait for rate limit slot with normal priority
    await this.rateLimiter.waitForSlot(5);

    try {
      const startTime = Date.now();
      const translatedText = await this.callTranslateAPI(
        text,
        targetLanguage,
        sourceLanguage
      );
      const responseTime = Date.now() - startTime;

      // Record response time for dynamic rate adjustment
      this.rateLimiter.recordResponseTime(responseTime);

      // Store in cache
      this.storeInCache(text, targetLanguage, sourceLanguage, translatedText);

      return {
        originalText: text,
        translatedText,
        sourceLanguage,
        targetLanguage,
        success: true,
      };
    } catch (error) {
      return {
        originalText: text,
        translatedText: text,
        sourceLanguage,
        targetLanguage,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async translateBatch(requests: TranslationRequest[]): Promise<TranslationStats> {
    this.ensureInitialized();

    const stats: TranslationStats = {
      totalCount: requests.length,
      successCount: 0,
      failureCount: 0,
      skippedCount: 0,
      translatedKeys: [],
    };

    if (!Array.isArray(requests) || requests.length === 0) {
      return stats;
    }

    // Filter out requests that can be served from cache
    const uncachedRequests: TranslationRequest[] = [];
    const cacheIndexMap = new Map<number, string>(); // Maps original index to cached translation

    for (let i = 0; i < requests.length; i++) {
      const request = requests[i];
      const cachedTranslation = this.getFromCache(
        request.text,
        request.targetLanguage,
        request.sourceLanguage || "en"
      );

      if (cachedTranslation !== null) {
        // Serve from cache
        cacheIndexMap.set(i, cachedTranslation);
        stats.successCount++;
        stats.translatedKeys.push({
          key: request.text,
          from: request.text,
          to: cachedTranslation,
        });
      } else {
        uncachedRequests.push(request);
      }
    }

    stats.skippedCount = cacheIndexMap.size;

    // Process uncached requests with controlled parallelism
    if (uncachedRequests.length > 0) {
      const chunks: TranslationRequest[][] = [];

      for (let i = 0; i < uncachedRequests.length; i += TRANSLATION_CONCURRENCY_LIMIT) {
        chunks.push(uncachedRequests.slice(i, i + TRANSLATION_CONCURRENCY_LIMIT));
      }

      for (const chunk of chunks) {
        const results = await Promise.allSettled(
          chunk.map(async (request) => {
            await this.rateLimiter.waitForSlot(5);
            const startTime = Date.now();
            const result = await this.callTranslateAPI(
              request.text,
              request.targetLanguage,
              request.sourceLanguage || "en"
            );
            const responseTime = Date.now() - startTime;

            // Record response time for dynamic rate adjustment
            this.rateLimiter.recordResponseTime(responseTime);

            return result;
          })
        );

        for (let i = 0; i < chunk.length; i++) {
          const request = chunk[i];
          const result = results[i];

          if (result.status === "fulfilled") {
            const translatedText = result.value;
            if (translatedText && translatedText !== request.text) {
              stats.successCount++;
              stats.translatedKeys.push({
                key: request.text,
                from: request.text,
                to: translatedText,
              });

              // Cache the successful translation
              this.storeInCache(
                request.text,
                request.targetLanguage,
                request.sourceLanguage || "en",
                translatedText
              );
            } else {
              stats.skippedCount++;
            }
          } else {
            stats.failureCount++;
          }
        }
      }
    }

    return stats;
  }

  async translateObject(
    sourceObject: Record<string, unknown>,
    targetObject: Record<string, unknown>,
    targetLanguage: string,
    path = "",
    stats: TranslationStats = {
      totalCount: 0,
      successCount: 0,
      failureCount: 0,
      skippedCount: 0,
      translatedKeys: [],
    },
    onTranslate?: (key: string, from: string, to: string) => void,
    force = false
  ): Promise<void> {
    if (!sourceObject || typeof sourceObject !== "object") return;
    if (!targetObject || typeof targetObject !== "object") return;
    if (!targetLanguage || targetLanguage.trim().length === 0) return;

    // First pass: collect all texts to translate (flattens nested structure)
    const textsToTranslate: Array<{
      key: string;
      enValue: string;
      currentPath: string;
    }> = [];

    const nestedObjects: Array<{
      key: string;
      sourceObj: Record<string, unknown>;
      targetObj: Record<string, unknown>;
      currentPath: string;
    }> = [];

    // Collect texts and nested objects
    const keys = Object.keys(sourceObject);
    for (const key of keys) {
      const enValue = sourceObject[key];
      const targetValue = targetObject[key];
      const currentPath = path ? `${path}.${key}` : key;

      if (typeof enValue === "object" && enValue !== null) {
        // Prepare nested object for processing
        if (!targetObject[key] || typeof targetObject[key] !== "object") {
          targetObject[key] = {};
        }
        nestedObjects.push({
          key,
          sourceObj: enValue as Record<string, unknown>,
          targetObj: targetObject[key] as Record<string, unknown>,
          currentPath,
        });
      } else if (typeof enValue === "string") {
        stats.totalCount++;
        if (force || needsTranslation(targetValue)) {
          textsToTranslate.push({ key, enValue, currentPath });
        } else {
          stats.skippedCount++;
        }
      }
    }

    // Process nested objects recursively
    for (const nested of nestedObjects) {
      await this.translateObject(
        nested.sourceObj,
        nested.targetObj,
        targetLanguage,
        nested.currentPath,
        stats,
        onTranslate,
        force
      );
    }

    // Process texts in batches
    if (textsToTranslate.length > 0) {
      for (let i = 0; i < textsToTranslate.length; i += TRANSLATION_BATCH_SIZE) {
        const batch = textsToTranslate.slice(i, i + TRANSLATION_BATCH_SIZE);
        const results = await this.translateBatch(
          batch.map((item) => ({
            text: item.enValue,
            targetLanguage,
          }))
        );

        // Use object pool for map
        const translationMap = this.mapPool.acquire();
        try {
          // Create a map for quick lookup of translations
          for (const item of results.translatedKeys) {
            translationMap.set(item.from, item.to);
          }

          for (let j = 0; j < batch.length; j++) {
            const { key, enValue, currentPath } = batch[j];
            const translatedText = translationMap.get(enValue);

            if (translatedText && translatedText !== enValue) {
              targetObject[key] = translatedText;
              stats.successCount++;
              if (onTranslate) onTranslate(currentPath, enValue, translatedText);
            } else {
              stats.failureCount++;
            }
          }
        } finally {
          // Clear and release map back to pool
          translationMap.clear();
          this.mapPool.release(translationMap);
        }
      }
    }
  }

  private async callTranslateAPI(
    text: string,
    targetLanguage: string,
    sourceLanguage: string,
    retries = DEFAULT_MAX_RETRIES,
    backoffMs = 2000
  ): Promise<string> {
    // Increment active requests counter
    this.activeRequests++;

    try {
      // 1. Variable Protection (Extract {{variables}})
      // Use object pool for map to reduce GC pressure
      const varMap = this.mapPool.acquire();
      let counter = 0;

      try {
        // Find all {{something}} patterns
        // Use more specific pattern to avoid false matches
        const safeText = text.replace(/\{\{([^}]+)\}\}/g, (match) => {
          const placeholder = `__VAR${counter}__`;
          varMap.set(placeholder, match);
          counter++;
          return placeholder;
        });

        const timeout = this.config?.timeout || DEFAULT_TIMEOUT;
        const encodedText = encodeURIComponent(safeText);
        const url = `${GOOGLE_TRANSLATE_API_URL}?client=gtx&sl=${sourceLanguage}&tl=${targetLanguage}&dt=t&q=${encodedText}`;

        for (let attempt = 0; attempt < retries; attempt++) {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);

          try {
            const response = await fetch(url, {
              signal: controller.signal,
            });

            if (!response.ok) {
              if (response.status === 429 || response.status >= 500) {
                if (attempt < retries - 1) {
                  clearTimeout(timeoutId);
                  // Exponential backoff
                  const delay = backoffMs * Math.pow(2, attempt);
                  await this.sleep(delay);
                  continue;
                }
              }
              throw new Error(`API request failed: ${response.status}`);
            }

            const data = await response.json();

            let translatedStr = safeText;
            if (
              Array.isArray(data) &&
              data.length > 0 &&
              Array.isArray(data[0]) &&
              data[0].length > 0 &&
              typeof data[0][0][0] === "string"
            ) {
              translatedStr = data[0].map((item: unknown[]) => item[0] as string).join('');
            }

            // 2. Re-inject Variables
            if (varMap.size > 0) {
              // Sometimes Google adds spaces, like __VAR0__ -> __ VAR0 __
              // Use pre-compiled regex patterns for better performance
              for (const [placeholder, originalVar] of varMap.entries()) {
                // Escape special regex characters in placeholder
                const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                // Allow optional spaces between each character
                const regex = new RegExp(escapedPlaceholder.split('').join('\\s*'), 'g');
                translatedStr = translatedStr.replace(regex, originalVar);
              }
            }

            return translatedStr;
          } catch (error) {
            clearTimeout(timeoutId);
            if (attempt === retries - 1) {
              throw error;
            }
            const delay = backoffMs * Math.pow(2, attempt);
            await this.sleep(delay);
          } finally {
            clearTimeout(timeoutId);
          }
        }

        return text;
      } finally {
        // Clear and release map back to pool
        varMap.clear();
        this.mapPool.release(varMap);
      }
    } finally {
      // Decrement active requests counter
      this.activeRequests--;
    }
  }

  /**
   * Optimized sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get number of active requests
   */
  getActiveRequestCount(): number {
    return this.activeRequests;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.clearCache();
    this.mapPool.clear();
    if (this._rateLimiter) {
      this._rateLimiter.clear();
    }
  }
}

export const googleTranslateService = new GoogleTranslateService();
export { GoogleTranslateService };
