/**
 * Google Translate URL Builder
 * @description Constructs the public Google Translate API URL with the
 * required query parameters. Pure function — no I/O, no fetch.
 *
 * The public endpoint requires:
 * - client=gtx       (use the gtx client; less rate limiting than t)
 * - sl=<source>      (source language code, e.g. "en")
 * - tl=<target>      (target language code, e.g. "tr")
 * - dt=t             (return translation text only)
 * - q=<text>         (URL-encoded text to translate)
 */
export interface GoogleTranslateUrlInput {
  readonly apiBaseUrl: string;
  readonly text: string;
  readonly sourceLanguage: string;
  readonly targetLanguage: string;
}

export function buildGoogleTranslateUrl(input: GoogleTranslateUrlInput): string {
  const params = new URLSearchParams({
    client: "gtx",
    sl: input.sourceLanguage,
    tl: input.targetLanguage,
    dt: "t",
    q: input.text,
  });
  return `${input.apiBaseUrl}?${params.toString()}`;
}
