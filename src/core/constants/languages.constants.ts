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

export interface LanguageMeta {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  direction: "ltr" | "rtl";
}

export const LANGUAGE_METADATA: Readonly<Record<string, LanguageMeta>> = {
  "ar-SA": { code: "ar-SA", name: "Arabic (Saudi Arabia)", nativeName: "العربية", flag: "🇸🇦", direction: "rtl" },
  "bg-BG": { code: "bg-BG", name: "Bulgarian", nativeName: "Български", flag: "🇧🇬", direction: "ltr" },
  "cs-CZ": { code: "cs-CZ", name: "Czech", nativeName: "Čeština", flag: "🇨🇿", direction: "ltr" },
  "da-DK": { code: "da-DK", name: "Danish", nativeName: "Dansk", flag: "🇩🇰", direction: "ltr" },
  "de-DE": { code: "de-DE", name: "German", nativeName: "Deutsch", flag: "🇩🇪", direction: "ltr" },
  "el-GR": { code: "el-GR", name: "Greek", nativeName: "Ελληνικά", flag: "🇬🇷", direction: "ltr" },
  "en-AU": { code: "en-AU", name: "English (Australia)", nativeName: "English (AU)", flag: "🇦🇺", direction: "ltr" },
  "en-CA": { code: "en-CA", name: "English (Canada)", nativeName: "English (CA)", flag: "🇨🇦", direction: "ltr" },
  "en-GB": { code: "en-GB", name: "English (UK)", nativeName: "English (UK)", flag: "🇬🇧", direction: "ltr" },
  "en-US": { code: "en-US", name: "English (US)", nativeName: "English (US)", flag: "🇺🇸", direction: "ltr" },
  "es-ES": { code: "es-ES", name: "Spanish (Spain)", nativeName: "Español", flag: "🇪🇸", direction: "ltr" },
  "es-MX": { code: "es-MX", name: "Spanish (Mexico)", nativeName: "Español (MX)", flag: "🇲🇽", direction: "ltr" },
  "fi-FI": { code: "fi-FI", name: "Finnish", nativeName: "Suomi", flag: "🇫🇮", direction: "ltr" },
  "fr-CA": { code: "fr-CA", name: "French (Canada)", nativeName: "Français (CA)", flag: "🇨🇦", direction: "ltr" },
  "fr-FR": { code: "fr-FR", name: "French (France)", nativeName: "Français", flag: "🇫🇷", direction: "ltr" },
  "hi-IN": { code: "hi-IN", name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳", direction: "ltr" },
  "hr-HR": { code: "hr-HR", name: "Croatian", nativeName: "Hrvatski", flag: "🇭🇷", direction: "ltr" },
  "hu-HU": { code: "hu-HU", name: "Hungarian", nativeName: "Magyar", flag: "🇭🇺", direction: "ltr" },
  "id-ID": { code: "id-ID", name: "Indonesian", nativeName: "Bahasa Indonesia", flag: "🇮🇩", direction: "ltr" },
  "it-IT": { code: "it-IT", name: "Italian", nativeName: "Italiano", flag: "🇮🇹", direction: "ltr" },
  "ja-JP": { code: "ja-JP", name: "Japanese", nativeName: "日本語", flag: "🇯🇵", direction: "ltr" },
  "ko-KR": { code: "ko-KR", name: "Korean", nativeName: "한국어", flag: "🇰🇷", direction: "ltr" },
  "ms-MY": { code: "ms-MY", name: "Malay", nativeName: "Bahasa Melayu", flag: "🇲🇾", direction: "ltr" },
  "nl-NL": { code: "nl-NL", name: "Dutch", nativeName: "Nederlands", flag: "🇳🇱", direction: "ltr" },
  "no-NO": { code: "no-NO", name: "Norwegian", nativeName: "Norsk", flag: "🇳🇴", direction: "ltr" },
  "pl-PL": { code: "pl-PL", name: "Polish", nativeName: "Polski", flag: "🇵🇱", direction: "ltr" },
  "pt-BR": { code: "pt-BR", name: "Portuguese (Brazil)", nativeName: "Português (BR)", flag: "🇧🇷", direction: "ltr" },
  "pt-PT": { code: "pt-PT", name: "Portuguese (Portugal)", nativeName: "Português", flag: "🇵🇹", direction: "ltr" },
  "ro-RO": { code: "ro-RO", name: "Romanian", nativeName: "Română", flag: "🇷🇴", direction: "ltr" },
  "ru-RU": { code: "ru-RU", name: "Russian", nativeName: "Русский", flag: "🇷🇺", direction: "ltr" },
  "sk-SK": { code: "sk-SK", name: "Slovak", nativeName: "Slovenčina", flag: "🇸🇰", direction: "ltr" },
  "sl-SI": { code: "sl-SI", name: "Slovenian", nativeName: "Slovenščina", flag: "🇸🇮", direction: "ltr" },
  "sv-SE": { code: "sv-SE", name: "Swedish", nativeName: "Svenska", flag: "🇸🇪", direction: "ltr" },
  "th-TH": { code: "th-TH", name: "Thai", nativeName: "ไทย", flag: "🇹🇭", direction: "ltr" },
  "tl-PH": { code: "tl-PH", name: "Tagalog", nativeName: "Tagalog", flag: "🇵🇭", direction: "ltr" },
  "tr-TR": { code: "tr-TR", name: "Turkish", nativeName: "Türkçe", flag: "🇹🇷", direction: "ltr" },
  "uk-UA": { code: "uk-UA", name: "Ukrainian", nativeName: "Українська", flag: "🇺🇦", direction: "ltr" },
  "vi-VN": { code: "vi-VN", name: "Vietnamese", nativeName: "Tiếng Việt", flag: "🇻🇳", direction: "ltr" },
  "zh-CN": { code: "zh-CN", name: "Chinese (Simplified)", nativeName: "简体中文", flag: "🇨🇳", direction: "ltr" },
  "zh-TW": { code: "zh-TW", name: "Chinese (Traditional)", nativeName: "繁體中文", flag: "🇹🇼", direction: "ltr" },
};

export function getLanguageMetadata(localeCode: string): LanguageMeta | undefined {
  return LANGUAGE_METADATA[localeCode];
}

export function getLanguageNativeName(localeCode: string): string {
  return LANGUAGE_METADATA[localeCode]?.nativeName ?? LANGUAGE_NAMES[localeCode] ?? localeCode;
}

export function getLanguageFlag(localeCode: string): string {
  return LANGUAGE_METADATA[localeCode]?.flag ?? "🌐";
}

export function isRtlLocale(localeCode: string): boolean {
  return LANGUAGE_METADATA[localeCode]?.direction === "rtl" || localeCode.toLowerCase().startsWith("ar");
}

export function findMatchingLocale(candidate: string, available?: readonly string[]): string | undefined {
  const catalog = available ?? getSupportedLocaleCodes();
  if (!candidate) return undefined;
  if (catalog.includes(candidate)) return candidate;
  const exactCaseInsensitive = catalog.find((c) => c.toLowerCase() === candidate.toLowerCase());
  if (exactCaseInsensitive) return exactCaseInsensitive;
  const base = candidate.split("-")[0]?.toLowerCase();
  if (!base) return undefined;
  return catalog.find((c) => c.toLowerCase() === base || c.toLowerCase().startsWith(`${base}-`));
}

export function isSupportedLocale(localeCode: string): boolean {
  return localeCode in LANGUAGE_MAP;
}

export function getSupportedLocaleCodes(): readonly string[] {
  return Object.keys(LANGUAGE_MAP);
}
