/**
 * Supported locale → ISO 639-1/639-3 mapping used by the CLI (translation
 * targets, setup stubs). Shared across web projects; keep in sync with
 * @umituz/react-native-google-translate.
 */
export const LANGUAGE_MAP: Readonly<Record<string, string>> = {
  "ar-SA": "ar",
  "bg-BG": "bg",
  "cs-CZ": "cs",
  "da-DK": "da",
  "de-DE": "de",
  "el-GR": "el",
  "en-AU": "en",
  "en-CA": "en",
  "en-GB": "en",
  "en-US": "en",
  "es-ES": "es",
  "es-MX": "es",
  "fi-FI": "fi",
  "fr-CA": "fr",
  "fr-FR": "fr",
  "hi-IN": "hi",
  "hr-HR": "hr",
  "hu-HU": "hu",
  "id-ID": "id",
  "it-IT": "it",
  "ja-JP": "ja",
  "ko-KR": "ko",
  "ms-MY": "ms",
  "nl-NL": "nl",
  "no-NO": "no",
  "pl-PL": "pl",
  "pt-BR": "pt",
  "pt-PT": "pt",
  "ro-RO": "ro",
  "ru-RU": "ru",
  "sk-SK": "sk",
  "sl-SI": "sl",
  "sv-SE": "sv",
  "th-TH": "th",
  "tl-PH": "tl",
  "tr-TR": "tr",
  "uk-UA": "uk",
  "vi-VN": "vi",
  "zh-CN": "zh-CN",
  "zh-TW": "zh-TW",
};

export const LANGUAGE_NAMES: Readonly<Record<string, string>> = {
  "ar-SA": "Arabic (Saudi Arabia)",
  "bg-BG": "Bulgarian",
  "cs-CZ": "Czech",
  "da-DK": "Danish",
  "de-DE": "German",
  "el-GR": "Greek",
  "en-AU": "English (Australia)",
  "en-CA": "English (Canada)",
  "en-GB": "English (UK)",
  "en-US": "English (US)",
  "es-ES": "Spanish (Spain)",
  "es-MX": "Spanish (Mexico)",
  "fi-FI": "Finnish",
  "fr-CA": "French (Canada)",
  "fr-FR": "French (France)",
  "hi-IN": "Hindi",
  "hr-HR": "Croatian",
  "hu-HU": "Hungarian",
  "id-ID": "Indonesian",
  "it-IT": "Italian",
  "ja-JP": "Japanese",
  "ko-KR": "Korean",
  "ms-MY": "Malay",
  "nl-NL": "Dutch",
  "no-NO": "Norwegian",
  "pl-PL": "Polish",
  "pt-BR": "Portuguese (Brazil)",
  "pt-PT": "Portuguese (Portugal)",
  "ro-RO": "Romanian",
  "ru-RU": "Russian",
  "sk-SK": "Slovak",
  "sl-SI": "Slovenian",
  "sv-SE": "Swedish",
  "th-TH": "Thai",
  "tl-PH": "Tagalog",
  "tr-TR": "Turkish",
  "uk-UA": "Ukrainian",
  "vi-VN": "Vietnamese",
  "zh-CN": "Chinese (Simplified)",
  "zh-TW": "Chinese (Traditional)",
};

export function getLanguageDisplayName(localeCode: string): string {
  return LANGUAGE_NAMES[localeCode] ?? localeCode;
}

export function isSupportedLocale(localeCode: string): boolean {
  return localeCode in LANGUAGE_MAP;
}

export function getSupportedLocaleCodes(): readonly string[] {
  return Object.keys(LANGUAGE_MAP);
}
