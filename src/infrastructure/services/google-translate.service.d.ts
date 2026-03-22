/**
 * Google Translate Service
 * @description Main translation service using Google Translate API
 */
import type { TranslationRequest, TranslationResponse, TranslationStats } from "../../domain/entities/translation.entity";
import type { ITranslationService, TranslationServiceConfig } from "../../domain/interfaces/translation-service.interface";
declare class GoogleTranslateService implements ITranslationService {
    private config;
    private rateLimiter;
    initialize(config: TranslationServiceConfig): void;
    isInitialized(): boolean;
    private ensureInitialized;
    translate(request: TranslationRequest): Promise<TranslationResponse>;
    translateBatch(requests: TranslationRequest[]): Promise<TranslationStats>;
    translateObject(sourceObject: Record<string, unknown>, targetObject: Record<string, unknown>, targetLanguage: string, path?: string, stats?: TranslationStats, onTranslate?: (key: string, from: string, to: string) => void): Promise<void>;
    private callTranslateAPI;
}
export declare const googleTranslateService: GoogleTranslateService;
export { GoogleTranslateService };
//# sourceMappingURL=google-translate.service.d.ts.map