/**
 * Google Translate Service
 * @description Main translation service using Google Translate API
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
} from "../constants/index.js";

class GoogleTranslateService implements ITranslationService {
  private config: TranslationServiceConfig | null = null;
  private rateLimiter: RateLimiter | null = null;

  initialize(config: TranslationServiceConfig): void {
    this.config = {
      minDelay: DEFAULT_MIN_DELAY,
      timeout: DEFAULT_TIMEOUT,
      ...config,
    };
    this.rateLimiter = new RateLimiter(this.config.minDelay);
  }

  isInitialized(): boolean {
    return this.config !== null && this.rateLimiter !== null;
  }

  private ensureInitialized(): void {
    if (!this.isInitialized()) {
      throw new Error(
        "GoogleTranslateService is not initialized. Call initialize() first."
      );
    }
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

    await this.rateLimiter!.waitForSlot();

    try {
      const translatedText = await this.callTranslateAPI(
        text,
        targetLanguage,
        sourceLanguage
      );

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

    // Process requests concurrently with controlled parallelism
    const concurrencyLimit = 10;
    const chunks: TranslationRequest[][] = [];

    for (let i = 0; i < requests.length; i += concurrencyLimit) {
      chunks.push(requests.slice(i, i + concurrencyLimit));
    }

    for (const chunk of chunks) {
      const results = await Promise.all(
        chunk.map(async (request) => {
          await this.rateLimiter!.waitForSlot();
          return this.callTranslateAPI(
            request.text,
            request.targetLanguage,
            request.sourceLanguage || "en"
          );
        })
      );

      for (let i = 0; i < chunk.length; i++) {
        const request = chunk[i];
        const translatedText = results[i];

        if (translatedText && translatedText !== request.text) {
          stats.successCount++;
          stats.translatedKeys.push({
            key: request.text,
            from: request.text,
            to: translatedText,
          });
        } else if (!translatedText) {
          stats.failureCount++;
        } else {
          stats.skippedCount++;
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

    const keys = Object.keys(sourceObject);
    const textsToTranslate: Array<{key: string; enValue: string; currentPath: string}> = [];

    for (const key of keys) {
      const enValue = sourceObject[key];
      const targetValue = targetObject[key];
      const currentPath = path ? `${path}.${key}` : key;

      if (typeof enValue === "object" && enValue !== null) {
        if (!targetObject[key] || typeof targetObject[key] !== "object") {
          targetObject[key] = {};
        }
        await this.translateObject(
          enValue as Record<string, unknown>,
          targetObject[key] as Record<string, unknown>,
          targetLanguage,
          currentPath,
          stats,
          onTranslate,
          force
        );
      } else if (typeof enValue === "string") {
        stats.totalCount++;
        if (force || needsTranslation(targetValue, enValue)) {
          textsToTranslate.push({key, enValue, currentPath});
        } else {
          stats.skippedCount++;
        }
      }
    }

    if (textsToTranslate.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < textsToTranslate.length; i += batchSize) {
        const batch = textsToTranslate.slice(i, i + batchSize);
        const results = await this.translateBatch(
          batch.map(item => ({
            text: item.enValue,
            targetLanguage,
          }))
        );

        const translatedItems = results.translatedKeys;
        let resultIndex = 0;
        for (let j = 0; j < batch.length; j++) {
          const {key, enValue, currentPath} = batch[j];

          // Find matching translation item
          const translatedItem = translatedItems[resultIndex];
          resultIndex++;

          if (translatedItem && translatedItem.from === enValue && translatedItem.to !== enValue) {
            targetObject[key] = translatedItem.to;
            stats.successCount++;
            if (onTranslate) onTranslate(currentPath, enValue, translatedItem.to);
          } else {
            stats.failureCount++;
          }
        }
      }
    }
  }

  private async callTranslateAPI(
    text: string,
    targetLanguage: string,
    sourceLanguage: string,
    retries = 3,
    backoffMs = 2000
  ): Promise<string> {
    // 1. Variable Protection (Extract {{variables}})
    const varMap = new Map<string, string>();
    let counter = 0;
    
    // Find all {{something}} patterns
    const safeText = text.replace(/\{\{([^}]+)\}\}/g, (match) => {
      const placeholder = `_VAR${counter}_`; // Using a simple token less likely to be split
      varMap.set(placeholder, match);
      counter++;
      return placeholder;
    });

    const timeout = this.config?.timeout || DEFAULT_TIMEOUT;
    const encodedText = encodeURIComponent(safeText);
    const url = `${GOOGLE_TRANSLATE_API_URL}?client=gtx&sl=${sourceLanguage}&tl=${targetLanguage}&dt=t&q=${encodedText}`;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          signal: controller.signal,
        });

        if (!response.ok) {
          if (response.status === 429 || response.status >= 500) {
            if (attempt < retries) {
              clearTimeout(timeoutId);
              // Exponential backoff
              const delay = backoffMs * Math.pow(2, attempt);
              await new Promise(resolve => setTimeout(resolve, delay));
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
          // Sometimes Google adds spaces, like _VAR0_ -> _ VAR0 _
          for (const [placeholder, originalVar] of varMap.entries()) {
            const regex = new RegExp(placeholder.split('').join('\\s*'), 'g');
            translatedStr = translatedStr.replace(regex, originalVar);
          }
        }

        return translatedStr;
      } catch (error) {
        clearTimeout(timeoutId);
        if (attempt === retries) {
          throw error;
        }
        const delay = backoffMs * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      } finally {
        clearTimeout(timeoutId);
      }
    }
    
    return text;
  }
}

export const googleTranslateService = new GoogleTranslateService();
export { GoogleTranslateService };
