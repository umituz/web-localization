import { GOOGLE_TRANSLATE } from "../../core/constants";
import {
  TranslationHttpError,
  TranslationTimeoutError,
  TranslationAbortedError,
} from "../../core/errors";
import { assertNotAborted, isAborted } from "../../application/validations/abort-signal-state";
import {
  buildGoogleTranslateUrl,
  buildGoogleTranslateBatchUrl,
} from "../../application/calculations/google-translate-url-builder";
import { mergeTranslationSegments } from "../../application/calculations/translation-segment-merger";
import type { VariableProtector } from "../../application/services/variable-protector";

export interface GoogleTranslateHttpClientOptions {
  readonly timeoutMs: number;
  readonly apiUrl?: string;
  readonly fetchImpl?: typeof fetch;
}

export class GoogleTranslateHttpClient {
  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly protector: VariableProtector,
    private readonly options: GoogleTranslateHttpClientOptions
  ) {
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    if (typeof this.fetchImpl !== "function") {
      throw new Error(
        "GoogleTranslateHttpClient: fetch is not available. Pass fetchImpl or polyfill."
      );
    }
  }

  async translate(
    text: string,
    sourceLang: string,
    targetLang: string,
    signal?: AbortSignal
  ): Promise<string> {
    assertNotAborted(signal);

    const { safeText, placeholders } = this.protector.protect(text);
    const url = buildGoogleTranslateUrl({
      apiBaseUrl: this.options.apiUrl ?? GOOGLE_TRANSLATE.API_URL,
      text: safeText,
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
    });

    const data = await this.requestJson(url, signal);
    const translatedSafe = mergeTranslationSegments(
      Array.isArray(data) && Array.isArray(data[0]) ? data[0] : []
    );
    return this.protector.restore(translatedSafe, placeholders);
  }

  async translateBatch(
    texts: readonly string[],
    sourceLang: string,
    targetLang: string,
    signal?: AbortSignal
  ): Promise<string[]> {
    assertNotAborted(signal);

    const protectedTexts = texts.map((text) => this.protector.protect(text));
    const url = buildGoogleTranslateBatchUrl({
      apiBaseUrl: this.options.apiUrl ?? GOOGLE_TRANSLATE.API_URL,
      texts: protectedTexts.map((entry) => entry.safeText),
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
    });

    const data = await this.requestJson(url, signal);
    return protectedTexts.map((entry, index) => {
      const segments = Array.isArray(data) && Array.isArray(data[index]) ? data[index] : [];
      const translatedSafe =
        segments.length > 0 ? mergeTranslationSegments(segments) : entry.safeText;
      return this.protector.restore(translatedSafe, entry.placeholders);
    });
  }

  private async requestJson(url: string, signal?: AbortSignal): Promise<unknown> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.options.timeoutMs);
    const onExternalAbort = () => controller.abort();
    signal?.addEventListener("abort", onExternalAbort, { once: true });

    try {
      const response = await this.fetchImpl(url, { signal: controller.signal });

      if (!response.ok) {
        throw new TranslationHttpError(
          response.status,
          `Translation API returned ${response.status}`
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof TranslationHttpError) throw error;
      if (isAborted(signal)) throw new TranslationAbortedError();
      if (controller.signal.aborted && !isAborted(signal)) {
        throw new TranslationTimeoutError(this.options.timeoutMs);
      }

      throw new TranslationHttpError(
        0,
        error instanceof Error ? error.message : "Network request failed",
        error
      );
    } finally {
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", onExternalAbort);
    }
  }
}
