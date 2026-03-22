/**
 * Google Translate Service
 * @description Main translation service using Google Translate API
 */
import { RateLimiter } from "../utils/rate-limit.util";
import { shouldSkipWord, needsTranslation, isValidText, } from "../utils/text-validator.util";
import { GOOGLE_TRANSLATE_API_URL, DEFAULT_MIN_DELAY, DEFAULT_TIMEOUT, } from "../constants";
class GoogleTranslateService {
    config = null;
    rateLimiter = null;
    initialize(config) {
        this.config = {
            minDelay: DEFAULT_MIN_DELAY,
            timeout: DEFAULT_TIMEOUT,
            ...config,
        };
        this.rateLimiter = new RateLimiter(this.config.minDelay);
    }
    isInitialized() {
        return this.config !== null && this.rateLimiter !== null;
    }
    ensureInitialized() {
        if (!this.isInitialized()) {
            throw new Error("GoogleTranslateService is not initialized. Call initialize() first.");
        }
    }
    async translate(request) {
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
        await this.rateLimiter.waitForSlot();
        try {
            const translatedText = await this.callTranslateAPI(text, targetLanguage, sourceLanguage);
            return {
                originalText: text,
                translatedText,
                sourceLanguage,
                targetLanguage,
                success: true,
            };
        }
        catch (error) {
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
    async translateBatch(requests) {
        this.ensureInitialized();
        const stats = {
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
        const chunks = [];
        for (let i = 0; i < requests.length; i += concurrencyLimit) {
            chunks.push(requests.slice(i, i + concurrencyLimit));
        }
        for (const chunk of chunks) {
            const results = await Promise.all(chunk.map(async (request) => {
                await this.rateLimiter.waitForSlot();
                return this.callTranslateAPI(request.text, request.targetLanguage, request.sourceLanguage || "en");
            }));
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
                }
                else if (!translatedText) {
                    stats.failureCount++;
                }
                else {
                    stats.skippedCount++;
                }
            }
        }
        return stats;
    }
    async translateObject(sourceObject, targetObject, targetLanguage, path = "", stats = {
        totalCount: 0,
        successCount: 0,
        failureCount: 0,
        skippedCount: 0,
        translatedKeys: [],
    }, onTranslate) {
        if (!sourceObject || typeof sourceObject !== "object")
            return;
        if (!targetObject || typeof targetObject !== "object")
            return;
        if (!targetLanguage || targetLanguage.trim().length === 0)
            return;
        const keys = Object.keys(sourceObject);
        const textsToTranslate = [];
        for (const key of keys) {
            const enValue = sourceObject[key];
            const targetValue = targetObject[key];
            const currentPath = path ? `${path}.${key}` : key;
            if (typeof enValue === "object" && enValue !== null) {
                if (!targetObject[key] || typeof targetObject[key] !== "object") {
                    targetObject[key] = {};
                }
                await this.translateObject(enValue, targetObject[key], targetLanguage, currentPath, stats, onTranslate);
            }
            else if (typeof enValue === "string") {
                stats.totalCount++;
                if (needsTranslation(targetValue, enValue)) {
                    textsToTranslate.push({ key, enValue, currentPath });
                }
                else {
                    stats.skippedCount++;
                }
            }
        }
        if (textsToTranslate.length > 0) {
            const batchSize = 50;
            for (let i = 0; i < textsToTranslate.length; i += batchSize) {
                const batch = textsToTranslate.slice(i, i + batchSize);
                const results = await this.translateBatch(batch.map(item => ({
                    text: item.enValue,
                    targetLanguage,
                })));
                let resultIndex = 0;
                for (let j = 0; j < batch.length; j++) {
                    const { key, enValue, currentPath } = batch[j];
                    const translatedItem = results.translatedKeys[resultIndex];
                    if (translatedItem && translatedItem.from === enValue && translatedItem.to !== enValue) {
                        targetObject[key] = translatedItem.to;
                        if (onTranslate)
                            onTranslate(currentPath, enValue, translatedItem.to);
                        resultIndex++;
                    }
                }
            }
        }
    }
    async callTranslateAPI(text, targetLanguage, sourceLanguage) {
        const timeout = this.config?.timeout || DEFAULT_TIMEOUT;
        const encodedText = encodeURIComponent(text);
        const url = `${GOOGLE_TRANSLATE_API_URL}?client=gtx&sl=${sourceLanguage}&tl=${targetLanguage}&dt=t&q=${encodedText}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(url, {
                signal: controller.signal,
            });
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }
            const data = await response.json();
            if (Array.isArray(data) &&
                data.length > 0 &&
                Array.isArray(data[0]) &&
                data[0].length > 0 &&
                Array.isArray(data[0][0]) &&
                typeof data[0][0][0] === "string") {
                return data[0][0][0];
            }
            return text;
        }
        finally {
            clearTimeout(timeoutId);
        }
    }
}
export const googleTranslateService = new GoogleTranslateService();
export { GoogleTranslateService };
