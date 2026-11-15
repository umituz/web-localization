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
  /**
   * Google Cloud Translation API key. When present (option or the
   * GOOGLE_TRANSLATE_API_KEY environment variable) requests go through the
   * official v2 endpoint, which is key-authenticated and quota-limited per
   * key instead of per IP — the unofficial endpoint's HTTP 429 IP bans stop
   * being a failure mode.
   */
  readonly apiKey?: string;
}

interface V2ResponseBody {
  readonly data?: {
    readonly translations?: readonly { readonly translatedText?: unknown }[];
  };
}

export class GoogleTranslateHttpClient {
  private readonly fetchImpl: typeof fetch;
  private readonly apiKey: string | undefined;

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
    this.apiKey =
      options.apiKey ??
      (typeof process !== "undefined" && typeof process.env?.GOOGLE_TRANSLATE_API_KEY === "string"
        ? process.env.GOOGLE_TRANSLATE_API_KEY
        : undefined);
  }

  get usingOfficialApi(): boolean {
    return this.apiKey !== undefined && this.apiKey.length > 0;
  }

  async translate(
    text: string,
    sourceLang: string,
    targetLang: string,
    signal?: AbortSignal
  ): Promise<string> {
    assertNotAborted(signal);

    const { safeText, placeholders } = this.protector.protect(text);
    if (this.usingOfficialApi) {
      const [official] = await this.translateOfficial([safeText], sourceLang, targetLang, signal);
      return this.protector.restore(official ?? "", placeholders);
    }

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

    if (this.usingOfficialApi) {
      const protectedTexts = texts.map((text) => this.protector.protect(text));
      const translated = await this.translateOfficial(
        protectedTexts.map((entry) => entry.safeText),
        sourceLang,
        targetLang,
        signal
      );
      const results: string[] = [];
      for (let index = 0; index < protectedTexts.length; index++) {
        const entry = protectedTexts[index];
        if (!entry) {
          throw new TranslationHttpError(0, "Translation batch state is inconsistent");
        }
        results.push(this.protector.restore(translated[index] ?? "", entry.placeholders));
      }
      return results;
    }

    const protectedTexts = texts.map((text) => this.protector.protect(text));
    const url = buildGoogleTranslateBatchUrl({
      apiBaseUrl: this.options.apiUrl ?? GOOGLE_TRANSLATE.API_BATCH_URL,
      texts: protectedTexts.map((entry) => entry.safeText),
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
    });

    const data = await this.requestJson(url, signal);
    if (!Array.isArray(data)) {
      throw new TranslationHttpError(
        0,
        "Translation API returned a malformed batch response"
      );
    }

    const results: string[] = [];
    for (let index = 0; index < protectedTexts.length; index++) {
      const entry = protectedTexts[index];
      const item = data[index];
      if (!entry) {
        throw new TranslationHttpError(
          0,
          "Translation batch state is inconsistent"
        );
      }

      const translatedSafe =
        typeof item === "string" && item.length > 0
          ? item
          : Array.isArray(item) && item.length > 0
            ? mergeTranslationSegments(item)
            : null;

      if (translatedSafe === null) {
        results.push(
          await this.translate(texts[index] ?? entry.safeText, sourceLang, targetLang, signal)
        );
        continue;
      }
      results.push(this.protector.restore(translatedSafe, entry.placeholders));
    }
    return results;
  }

  /**
   * Official Cloud Translation v2: POST JSON, key in the x-goog-api-key
   * header, plain-text format so protected placeholders survive verbatim.
   * Accepts up to 128 segments per request (chunked here when larger).
   */
  private async translateOfficial(
    texts: readonly string[],
    sourceLang: string,
    targetLang: string,
    signal?: AbortSignal
  ): Promise<string[]> {
    const results: string[] = [];
    for (let offset = 0; offset < texts.length; offset += GOOGLE_TRANSLATE.API_V2_MAX_TEXTS) {
      const chunk = texts.slice(offset, offset + GOOGLE_TRANSLATE.API_V2_MAX_TEXTS);
      const body = JSON.stringify({
        q: chunk,
        source: sourceLang,
        target: targetLang,
        format: "text",
      });
      const data = await this.requestJson(
        this.options.apiUrl ?? GOOGLE_TRANSLATE.API_V2_URL,
        signal,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(this.apiKey ? { "x-goog-api-key": this.apiKey } : {}),
          },
          body,
        }
      );
      const parsed = (typeof data === "object" && data !== null ? data : {}) as V2ResponseBody;
      const translations = parsed.data?.translations ?? [];
      if (translations.length !== chunk.length) {
        throw new TranslationHttpError(
          0,
          `Translation API returned ${translations.length} results for ${chunk.length} texts`
        );
      }
      for (const entry of translations) {
        results.push(typeof entry.translatedText === "string" ? entry.translatedText : "");
      }
    }
    return results;
  }

  private async requestJson(
    url: string,
    signal?: AbortSignal,
    init?: RequestInit
  ): Promise<unknown> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.options.timeoutMs);
    const onExternalAbort = () => controller.abort();
    signal?.addEventListener("abort", onExternalAbort, { once: true });

    try {
      const response = await this.fetchImpl(url, { ...init, signal: controller.signal });

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
