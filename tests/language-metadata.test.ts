import { describe, expect, it } from "vitest";
import {
  LANGUAGE_MAP,
  LANGUAGE_METADATA,
  findMatchingLocale,
  getLanguageDisplayName,
  getLanguageFlag,
  getLanguageMetadata,
  getLanguageNativeName,
  isRtlLocale,
} from "../src/core/constants/languages.constants";

describe("language constants and metadata", () => {
  it("provides metadata for supported locales", () => {
    const metaTr = getLanguageMetadata("tr-TR");
    expect(metaTr).toBeDefined();
    expect(metaTr?.code).toBe("tr-TR");
    expect(metaTr?.nativeName).toBe("Türkçe");
    expect(metaTr?.flag).toBe("🇹🇷");
    expect(metaTr?.direction).toBe("ltr");

    const metaAr = getLanguageMetadata("ar-SA");
    expect(metaAr).toBeDefined();
    expect(metaAr?.direction).toBe("rtl");
    expect(metaAr?.nativeName).toBe("العربية");
  });

  it("extracts native name with sensible fallback", () => {
    expect(getLanguageNativeName("tr-TR")).toBe("Türkçe");
    expect(getLanguageNativeName("de-DE")).toBe("Deutsch");
    expect(getLanguageNativeName("ja-JP")).toBe("日本語");
    expect(getLanguageNativeName("unknown-XX")).toBe("unknown-XX");
  });

  it("extracts flag with fallback globe", () => {
    expect(getLanguageFlag("tr-TR")).toBe("🇹🇷");
    expect(getLanguageFlag("en-US")).toBe("🇺🇸");
    expect(getLanguageFlag("de-DE")).toBe("🇩🇪");
    expect(getLanguageFlag("unknown-XX")).toBe("🌐");
  });

  it("identifies RTL locales correctly", () => {
    expect(isRtlLocale("ar-SA")).toBe(true);
    expect(isRtlLocale("ar")).toBe(true);
    expect(isRtlLocale("tr-TR")).toBe(false);
    expect(isRtlLocale("en-US")).toBe(false);
  });

  it("matches locales by exact code, case insensitivity, or prefix", () => {
    expect(findMatchingLocale("tr-TR")).toBe("tr-TR");
    expect(findMatchingLocale("TR-TR")).toBe("tr-TR");
    expect(findMatchingLocale("tr")).toBe("tr-TR");
    expect(findMatchingLocale("de")).toBe("de-DE");
    expect(findMatchingLocale("en")).toBe("en-AU");
    expect(findMatchingLocale("ar")).toBe("ar-SA");
    expect(findMatchingLocale("unknown")).toBeUndefined();
  });

  it("matches against custom available locales when specified", () => {
    const custom = ["en-US", "tr-TR", "de-DE"] as const;
    expect(findMatchingLocale("en", custom)).toBe("en-US");
    expect(findMatchingLocale("de", custom)).toBe("de-DE");
    expect(findMatchingLocale("fr", custom)).toBeUndefined();
  });

  it("covers all LANGUAGE_MAP keys in LANGUAGE_METADATA", () => {
    const keys = Object.keys(LANGUAGE_MAP);
    for (const key of keys) {
      expect(LANGUAGE_METADATA[key]).toBeDefined();
      expect(LANGUAGE_METADATA[key]?.code).toBe(key);
      expect(LANGUAGE_METADATA[key]?.nativeName.length).toBeGreaterThan(0);
      expect(LANGUAGE_METADATA[key]?.flag.length).toBeGreaterThan(0);
    }
  });

  it("keeps getLanguageDisplayName working for backward compatibility", () => {
    expect(getLanguageDisplayName("tr-TR")).toBe("Turkish");
    expect(getLanguageDisplayName("en-US")).toBe("English (US)");
  });
});
