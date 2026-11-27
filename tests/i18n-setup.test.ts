import { afterEach, describe, expect, it, vi } from "vitest";

import { resetI18n, setupI18n } from "../src/integrations/i18n.setup";
import { AlreadyInitializedError } from "../src/core/errors";

const baseResources = {
  en: { translation: { hello: "Hello" } },
  tr: { translation: { hello: "Merhaba" } },
} as const;

function options(overrides: Record<string, unknown> = {}) {
  return {
    resources: structuredClone(baseResources) as Record<
      string,
      { translation: Record<string, unknown> }
    >,
    fallbackLanguage: "en",
    detection: { order: [], caches: [] },
    ...overrides,
  };
}

afterEach(() => {
  resetI18n();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("setupI18n", () => {
  it("initializes i18next and resolves whenReady", async () => {
    const handle = setupI18n(options());
    const instance = await handle.whenReady();
    expect(instance.isInitialized).toBe(true);
    expect(handle.isInitialized()).toBe(true);
    expect(instance.t("hello")).toBe("Hello");
  });

  it("is idempotent for the same configuration", () => {
    const first = setupI18n(options());
    const second = setupI18n(options());
    expect(second.instance).toBe(first.instance);
  });

  it("throws AlreadyInitializedError when re-initialized with different resources (regression)", () => {
    setupI18n(options());
    const different = options({
      resources: {
        en: { translation: { hello: "Hello" } },
        de: { translation: { hello: "Hallo" } },
      } as Record<string, { translation: Record<string, unknown> }>,
    });
    expect(() => setupI18n(different)).toThrow(AlreadyInitializedError);
  });

  it("allows re-initialization after resetI18n", () => {
    setupI18n(options());
    resetI18n();
    const different = options({
      resources: {
        en: { translation: { hello: "Hello" } },
        de: { translation: { hello: "Hallo" } },
      } as Record<string, { translation: Record<string, unknown> }>,
    });
    expect(() => setupI18n(different)).not.toThrow();
  });
});

describe("I18nHandle", () => {
  it("adds languages at runtime", async () => {
    const handle = setupI18n(options());
    await handle.whenReady();
    handle.addLanguage("de", { hello: "Hallo" });
    expect(handle.instance.hasResourceBundle("de", "translation")).toBe(true);
  });

  it("changes the active language", async () => {
    const handle = setupI18n(options());
    await handle.whenReady();
    await handle.changeLanguage("tr");
    expect(handle.getCurrentLanguage()).toBe("tr");
    expect(handle.instance.t("hello")).toBe("Merhaba");
  });

  it("reports the current language with a sane fallback", async () => {
    const handle = setupI18n(options());
    await handle.whenReady();
    expect(typeof handle.getCurrentLanguage()).toBe("string");
    expect(handle.getCurrentLanguage().length).toBeGreaterThan(0);
  });

  it("exposes the configured language plan", async () => {
    const handle = setupI18n(options());
    await handle.whenReady();
    expect(handle.getLanguages()).toEqual(["en", "tr"]);
    expect(handle.getFallbackLanguage()).toBe("en");
    expect(handle.getCurrentLanguage()).toBe("en");
  });

  it("resolves the boot language synchronously from a stored preference", () => {
    const store: Record<string, string> = { i18nextLng: "tr" };
    vi.stubGlobal("window", {
      localStorage: { getItem: (key: string) => store[key] ?? null },
    });
    const handle = setupI18n(
      options({ detection: { order: ["localStorage"], caches: [] } })
    );
    expect(handle.getCurrentLanguage()).toBe("tr");
  });

  it("falls back when the stored language is not configured", () => {
    const store: Record<string, string> = { i18nextLng: "de" };
    vi.stubGlobal("window", {
      localStorage: { getItem: (key: string) => store[key] ?? null },
    });
    const handle = setupI18n(
      options({ detection: { order: ["localStorage"], caches: [] } })
    );
    expect(handle.getCurrentLanguage()).toBe("en");
  });

  it("reset clears initialization state", async () => {
    const handle = setupI18n(options());
    await handle.whenReady();
    handle.reset();
    expect(handle.isInitialized()).toBe(false);
  });

  it("guards operations before initialization completes", () => {
    resetI18n();
    const handle = setupI18n(options());
    handle.reset();
    expect(() => handle.addLanguage("de", {})).toThrow(/not initialized/i);
  });
});

function stubDocument() {
  const element = {
    lang: "",
    dir: null as string | null,
    setAttribute(name: string, value: string) {
      if (name === "dir") this.dir = value;
    },
    getAttribute(name: string) {
      return name === "dir" ? this.dir : null;
    },
    removeAttribute(name: string) {
      if (name === "dir") this.dir = null;
    },
  };
  vi.stubGlobal("document", { documentElement: element });
  return element;
}

describe("direction and empty-string handling", () => {
  it("applies dir=rtl for configured rtl languages on boot", async () => {
    const element = stubDocument();
    const handle = setupI18n(
      options({
        resources: {
          en: { translation: { hello: "Hello" } },
          ar: { translation: { hello: "مرحبا" } },
        } as Record<string, { translation: Record<string, unknown> }>,
        initialLanguage: "ar",
        rtlLanguages: ["ar", "he"],
      })
    );
    await handle.whenReady();
    expect(element.lang).toBe("ar");
    expect(element.getAttribute("dir")).toBe("rtl");
  });

  it("flips dir when switching between rtl and ltr languages", async () => {
    const element = stubDocument();
    const handle = setupI18n(
      options({
        resources: {
          en: { translation: { hello: "Hello" } },
          ar: { translation: { hello: "مرحبا" } },
        } as Record<string, { translation: Record<string, unknown> }>,
        rtlLanguages: ["ar"],
      })
    );
    await handle.whenReady();
    expect(element.getAttribute("dir")).toBe("ltr");
    await handle.changeLanguage("ar");
    expect(element.getAttribute("dir")).toBe("rtl");
    await handle.changeLanguage("en");
    expect(element.getAttribute("dir")).toBe("ltr");
  });

  it("leaves the dir attribute untouched when rtlLanguages is not configured", async () => {
    const element = stubDocument();
    const handle = setupI18n(options());
    await handle.whenReady();
    expect(element.lang).toBe("en");
    expect(element.getAttribute("dir")).toBeNull();
  });

  it("restores the original lang and dir after reset", async () => {
    const element = stubDocument();
    element.lang = "de";
    element.setAttribute("dir", "auto");
    const handle = setupI18n(
      options({
        rtlLanguages: ["ar"],
      })
    );
    await handle.whenReady();
    expect(element.lang).toBe("en");
    expect(element.getAttribute("dir")).toBe("ltr");
    handle.reset();
    expect(element.lang).toBe("de");
    expect(element.getAttribute("dir")).toBe("auto");
  });

  it("does not bind language effects when reset runs before initialization settles (regression)", async () => {
    const element = stubDocument();
    element.lang = "de";
    const handle = setupI18n(options());
    handle.reset();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(element.lang).toBe("de");
  });

  it("forwards returnEmptyString to i18next", async () => {
    const strict = setupI18n(options({ returnEmptyString: false }));
    await strict.whenReady();
    expect(strict.instance.options.returnEmptyString).toBe(false);
    resetI18n();
    const permissive = setupI18n(options());
    await permissive.whenReady();
    expect(permissive.instance.options.returnEmptyString).not.toBe(false);
  });
});
