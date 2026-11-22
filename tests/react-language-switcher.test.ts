import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  I18nProvider,
  LanguageSwitcher,
  Translate,
  T,
  useDirection,
  useI18nLanguage,
  useIsRtl,
} from "../src/react";

describe("Translate component", () => {
  it("renders translated text using defaultT", () => {
    const el = createElement(Translate, { k: "common.saveChanges" });
    expect(el.props.k).toBe("common.saveChanges");
  });

  it("exports T as alias of Translate", () => {
    expect(T).toBe(Translate);
  });

  it("handles fallback and params props", () => {
    const el = createElement(T, {
      k: "greeting",
      fallback: "Welcome back!",
      params: { name: "Antigravity" },
      className: "custom-t",
    });
    expect(el.props.fallback).toBe("Welcome back!");
    expect(el.props.className).toBe("custom-t");
  });
});

describe("LanguageSwitcher component", () => {
  it("creates select variant element with default props", () => {
    const el = createElement(LanguageSwitcher, { variant: "select" });
    expect(el.props.variant).toBe("select");
  });

  it("creates segmented variant element", () => {
    const el = createElement(LanguageSwitcher, {
      variant: "segmented",
      availableLocales: ["en-US", "tr-TR"],
    });
    expect(el.props.variant).toBe("segmented");
    expect(el.props.availableLocales).toEqual(["en-US", "tr-TR"]);
  });

  it("creates dropdown variant element with callback", () => {
    const fn = vi.fn();
    const el = createElement(LanguageSwitcher, {
      variant: "dropdown",
      onLanguageChange: fn,
      showFlag: true,
      showNativeName: true,
    });
    expect(el.props.variant).toBe("dropdown");
    expect(el.props.showFlag).toBe(true);
    expect(el.props.showNativeName).toBe(true);
  });
});

describe("I18nContext hooks", () => {
  it("provides direction helpers with ltr default", () => {
    expect(typeof useDirection).toBe("function");
    expect(typeof useIsRtl).toBe("function");
    expect(typeof useI18nLanguage).toBe("function");
  });

  it("creates provider element with initial language", () => {
    const el = createElement(
      I18nProvider,
      { initialLanguage: "tr-TR" },
      createElement("div", null, "child"),
    );
    expect(el.props.initialLanguage).toBe("tr-TR");
  });
});
