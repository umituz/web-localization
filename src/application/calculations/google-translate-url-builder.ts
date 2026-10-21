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
