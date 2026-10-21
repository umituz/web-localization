import type {
  ITranslationStrategy,
  ObjectTranslationContext,
  TranslationServiceConfig,
} from "../../domain/interfaces/translation-service.interface";
import {
  type TranslationItem,
  type TranslationRequest,
  type TranslationResponse,
  TranslationStats,
} from "../../domain/entities/translation.entity";
import { HTTP, RATE_LIMIT } from "../../core/constants";
import {
  Semaphore,
  RetryPolicy,
  RateLimiter,
  ProgressEmitter,
  NullProgressEmitter,
  throwIfAborted,
} from "../../core/utils";
import { TranslationHttpError, TranslationAbortedError } from "../../core/errors";
import type { Iso639Code } from "../../core/types/branded";
import { TranslationCache } from "../services/translation-cache";
import { VariableProtector } from "../services/variable-protector";
import { TextValidator } from "../services/text-validator";
import { ObjectTreeWalker } from "../services/object-flattener";
import { GoogleTranslateHttpClient } from "../../infrastructure/http/translation-http.client";
import { calculateElapsedMs } from "../calculations/time-elapsed-calculator";

const DEFAULT_SOURCE_LANG: Iso639Code = "en" as Iso639Code;

export interface GoogleTranslateStrategyOptions extends TranslationServiceConfig {
  readonly maxConcurrent?: number;
  readonly fetchImpl?: typeof fetch;
}

export class GoogleTranslateStrategy implements ITranslationStrategy {
  readonly name = "google-translate";

  private readonly cache = new TranslationCache();
  private readonly protector = new VariableProtector();
  private readonly validator = new TextValidator();
  private readonly walker = new ObjectTreeWalker();
  private readonly rateLimiter: RateLimiter;
  private readonly retryPolicy: RetryPolicy;
  private readonly httpClient: GoogleTranslateHttpClient;
  private readonly semaphore: Semaphore;
  private readonly maxConcurrent: number;

  constructor(options: GoogleTranslateStrategyOptions = {}) {
    const minDelay = options.minDelayMs ?? RATE_LIMIT.DEFAULT_MIN_DELAY_MS;
    const timeout = options.timeoutMs ?? HTTP.DEFAULT_TIMEOUT_MS;
    const maxRetries = options.maxRetries ?? HTTP.DEFAULT_MAX_RETRIES;
    this.maxConcurrent = options.maxConcurrent ?? RATE_LIMIT.DEFAULT_CONCURRENCY;

    this.rateLimiter = new RateLimiter({ minDelayMs: minDelay });
    this.retryPolicy = new RetryPolicy({
      maxRetries,
      initialBackoffMs: HTTP.INITIAL_BACKOFF_MS,
      backoffMultiplier: HTTP.BACKOFF_MULTIPLIER,
      isRetryable: (err) => err instanceof TranslationHttpError && err.isRetryable,
    });
    this.httpClient = new GoogleTranslateHttpClient(this.protector, {
      timeoutMs: timeout,
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
    });
    this.semaphore = new Semaphore(this.maxConcurrent);
  }

  async translate(
    request: TranslationRequest,
    signal?: AbortSignal
  ): Promise<TranslationResponse> {
    throwIfAborted(signal);

    const source = request.sourceLanguage ?? DEFAULT_SOURCE_LANG;
    const cacheKey = { source, target: request.targetLanguage, text: request.text };

    if (!this.validator.isTranslatable(request.text) || this.validator.shouldSkip(request.text)) {
      return this.passthroughResponse(request, source);
    }

    const cached = this.cache.get(cacheKey);
    if (cached !== null) {
      return {
        originalText: request.text,
        translatedText: cached,
        sourceLanguage: source,
        targetLanguage: request.targetLanguage,
        success: true,
        cached: true,
      };
    }

    try {
      const translated = await this.fetchOneWithLimits(request, signal);
      throwIfAborted(signal);
      this.cache.set(cacheKey, translated);
      return {
        originalText: request.text,
        translatedText: translated,
        sourceLanguage: source,
        targetLanguage: request.targetLanguage,
        success: true,
      };
    } catch (error) {
      if (error instanceof TranslationAbortedError) throw error;
      return {
        originalText: request.text,
        translatedText: request.text,
        sourceLanguage: source,
        targetLanguage: request.targetLanguage,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async translateBatch(
    requests: readonly TranslationRequest[],
    signal?: AbortSignal,
    emitter: ProgressEmitter = new NullProgressEmitter()
  ): Promise<TranslationStats> {
    if (requests.length === 0) {
      return TranslationStats.empty();
    }

    let stats = TranslationStats.initial(requests.length);

    const uncached: TranslationRequest[] = [];
    for (const req of requests) {
      throwIfAborted(signal);

      if (!this.validator.isTranslatable(req.text) || this.validator.shouldSkip(req.text)) {
        stats = stats.withSkip();
        continue;
      }

      const source = req.sourceLanguage ?? DEFAULT_SOURCE_LANG;
      const cached = this.cache.get({ source, target: req.targetLanguage, text: req.text });
      if (cached !== null) {
        const item: TranslationItem = { key: req.text, from: req.text, to: cached };
        stats = stats.withSuccess(item);
        emitter.emit({
          type: "keyTranslated",
          language: req.targetLanguage as string,
          path: req.text,
          from: req.text,
          to: cached,
        });
      } else {
        uncached.push(req);
      }
    }

    if (uncached.length === 0) {
      return stats;
    }

    const fetched = await Promise.allSettled(
      uncached.map((req) => this.fetchOneWithLimits(req, signal))
    );

    for (let i = 0; i < uncached.length; i++) {
      throwIfAborted(signal);

      const req = uncached[i];
      const result = fetched[i];
      if (!req || !result) continue;

      if (result.status === "fulfilled" && result.value && result.value !== req.text) {
        const source = req.sourceLanguage ?? DEFAULT_SOURCE_LANG;
        this.cache.set(
          { source, target: req.targetLanguage, text: req.text },
          result.value
        );
        const item: TranslationItem = { key: req.text, from: req.text, to: result.value };
        stats = stats.withSuccess(item);
        emitter.emit({
          type: "keyTranslated",
          language: req.targetLanguage as string,
          path: req.text,
          from: req.text,
          to: result.value,
        });
      } else if (result.status === "rejected") {
        if (result.reason instanceof TranslationAbortedError) throw result.reason;
        stats = stats.withFailure();
      } else {
        stats = stats.withFailure();
      }
    }

    return stats;
  }

  async translateObject(
    context: ObjectTranslationContext,
    options: { signal?: AbortSignal; emitter?: ProgressEmitter } = {}
  ): Promise<TranslationStats> {
    const { source, target, targetLanguage, force = false, onProgress } = context;
    const emitter = options.emitter ?? new NullProgressEmitter();

    throwIfAborted(options.signal);
    const leaves = this.walker.collectLeaves(source, target, "", targetLanguage, force);

    emitter.emit({
      type: "languageStart",
      language: targetLanguage as string,
      keyCount: leaves.length,
    });

    if (leaves.length === 0) {
      emitter.emit({
        type: "languageComplete",
        language: targetLanguage as string,
        successCount: 0,
        failureCount: 0,
        skippedCount: 0,
      });
      return TranslationStats.empty();
    }

    const requests: TranslationRequest[] = leaves.map((leaf) => ({
      text: leaf.text,
      targetLanguage,
    }));

    const translationStats = await this.translateBatch(requests, options.signal, emitter);

    const translationMap = new Map<string, string>();
    for (const item of translationStats.translatedKeys) {
      translationMap.set(item.from, item.to);
    }

    const applied = this.walker.applyTranslations(
      target,
      leaves,
      translationMap,
      onProgress,
      TranslationStats.initial(leaves.length)
    );

    emitter.emit({
      type: "languageComplete",
      language: targetLanguage as string,
      successCount: applied.successCount,
      failureCount: applied.failureCount,
      skippedCount: applied.skippedCount,
    });

    return applied;
  }

  getCacheStats(): { size: number; maxSize: number } {
    return this.cache.stats();
  }

  clearCache(): void {
    this.cache.clear();
  }

  dispose(): void {
    this.cache.clear();
    this.rateLimiter.clear();
  }

  private async fetchOneWithLimits(
    req: TranslationRequest,
    signal?: AbortSignal
  ): Promise<string> {
    return this.semaphore.run(async () => {
      throwIfAborted(signal);
      await this.rateLimiter.waitForSlot();
      const startTime = Date.now();
      try {
        const result = await this.retryPolicy.execute(
          () =>
            this.httpClient.translate(
              req.text,
              req.sourceLanguage ?? DEFAULT_SOURCE_LANG,
              req.targetLanguage,
              signal
            ),
          signal
        );
        this.rateLimiter.recordResponseTime(calculateElapsedMs(startTime));
        return result;
      } catch (error) {
        throw error instanceof Error ? error : new Error(String(error));
      }
    });
  }

  private passthroughResponse(
    request: TranslationRequest,
    source: Iso639Code
  ): TranslationResponse {
    return {
      originalText: request.text,
      translatedText: request.text,
      sourceLanguage: source,
      targetLanguage: request.targetLanguage,
      success: true,
    };
  }
}

export const googleTranslateService = new GoogleTranslateStrategy();
