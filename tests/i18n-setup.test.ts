/**
 * Tests for the ./setup integration: setupI18n lifecycle, idempotency,
 * conflicting re-initialization (regression), and handle operations.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

// The SEO integration is a peer integration concern — mock it so these tests
// exercise only this package's lifecycle logic.
vi.mock("@umituz/web-seo", () => ({ initSEO: vi.fn() }));

import { resetI18n, setupI18n } from "../src/integrations/i18n.setup";
import { AlreadyInitializedError } from "../src/core/errors";
import { initSEO } from "@umituz/web-seo";

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
    defaultLng: "en",
    fallbackLng: "en",
    detection: { order: [], caches: [] }, // deterministic in Node
    ...overrides,
  };
}

afterEach(() => {
  resetI18n();
  vi.clearAllMocks();
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

  it("invokes the SEO integrator when seo options are provided", async () => {
    setupI18n(
      options({
        seo: { titleKey: "app.title", descriptionKey: "app.description" },
      })
    );
    await Promise.resolve(); // flush microtasks so init callbacks run
    // initSEO runs after i18next init resolves; give it a tick.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(initSEO).toHaveBeenCalled();
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

  it("reset clears initialization state", async () => {
    const handle = setupI18n(options());
    await handle.whenReady();
    handle.reset();
    expect(handle.isInitialized()).toBe(false);
  });

  it("guards operations before initialization completes", () => {
    // Fresh module state via reset; operate synchronously right after setup.
    resetI18n();
    const handle = setupI18n(options());
    // Force the not-yet-initialized path by resetting the core under the handle:
    handle.reset();
    expect(() => handle.addLanguage("de", {})).toThrow(/not initialized/i);
  });
});
