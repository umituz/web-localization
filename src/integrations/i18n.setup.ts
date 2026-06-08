/**
 * i18n Setup - Public API
 * @description Composes I18nCore, I18nConfigBuilder, and SEO integration.
 *
 * Lifecycle: call `setupI18n()` once at app startup. The returned `I18nHandle`
 * provides runtime operations. Re-calling with different resources throws —
 * call `handle.reset()` first if you need to re-initialize.
 */
import i18n from "i18next";
import { initSEO } from "@umituz/web-seo";
import {
  I18nCore,
  type I18nInstance,
  type I18nInitCallback,
} from "./i18n-core";
import {
  I18nConfigBuilder,
  type DetectionOptions,
  type SeoIntegrationOptions,
} from "./i18n-config";
import { AlreadyInitializedError } from "../core/errors";

// Suppress unused warning - exposed via core/errors barrel
void AlreadyInitializedError;

export type { DetectionOptions, SeoIntegrationOptions };

export interface SetupI18nOptions {
  readonly resources: Record<string, { translation: Record<string, unknown> }>;
  readonly defaultLng?: string;
  readonly fallbackLng?: string;
  readonly onInit?: I18nInitCallback;
  readonly detection?: DetectionOptions;
  readonly seo?: SeoIntegrationOptions;
  readonly lazyLoad?: boolean;
  readonly saveMissing?: boolean;
  readonly reactUseSuspense?: boolean;
}

export interface I18nHandle {
  readonly instance: I18nInstance;
  readonly addLanguage: (
    lng: string,
    resources: Record<string, unknown>,
    ns?: string
  ) => void;
  readonly changeLanguage: (lng: string) => Promise<void>;
  readonly getCurrentLanguage: () => string;
  readonly isInitialized: () => boolean;
  readonly reset: () => void;
  readonly whenReady: () => Promise<I18nInstance>;
}

let globalCore: I18nCore | null = null;

/**
 * Initialize i18next with the given configuration.
 * @description Idempotent only when called with the same resources. Re-calling
 * with different resources throws `AlreadyInitializedError`.
 */
export function setupI18n(options: SetupI18nOptions): I18nHandle {
  if (globalCore) {
    // Already initializing or initialized — re-use existing core
    // I18nCore.initialize() will throw if resources differ.
    globalCore.initialize();
    return buildHandle(globalCore);
  }

  const builder = new I18nConfigBuilder({
    resources: options.resources,
    defaultLng: options.defaultLng,
    fallbackLng: options.fallbackLng,
    detection: options.detection,
    seo: options.seo,
    lazyLoad: options.lazyLoad,
    saveMissing: options.saveMissing,
    reactUseSuspense: options.reactUseSuspense,
  });

  const core = new I18nCore(i18n, {
    builder,
    onInit: options.onInit,
    seoIntegrator: (instance, seo) => {
      initSEO({ i18n: instance, ...seo });
    },
  });

  try {
    core.initialize();
  } catch (err) {
    // If init fails outright, don't keep a half-initialized core
    if (!(err instanceof AlreadyInitializedError)) {
      globalCore = null;
    }
    throw err;
  }

  globalCore = core;
  return buildHandle(core);
}

/**
 * Reset the i18n core. Clears the global handle and i18next resources.
 * Use in tests or when fully reloading the app.
 */
export function resetI18n(): void {
  globalCore?.reset();
  globalCore = null;
}

function buildHandle(core: I18nCore): I18nHandle {
  return {
    instance: core.getInstance(),
    addLanguage: (lng, resources, ns = "translation") => {
      if (!core.isInitialized()) {
        throw new Error("i18n is not initialized yet. Call setupI18n first.");
      }
      core.getInstance().addResourceBundle(lng, ns, resources, true, true);
    },
    changeLanguage: async (lng) => {
      if (!core.isInitialized()) {
        throw new Error("i18n is not initialized yet. Call setupI18n first.");
      }
      await core.getInstance().changeLanguage(lng);
    },
    getCurrentLanguage: () => {
      const inst = core.getInstance();
      return inst.language || inst.languages[0] || "en-US";
    },
    isInitialized: () => core.isInitialized(),
    reset: () => {
      core.reset();
      globalCore = null;
    },
    whenReady: () => core.whenReady(),
  };
}
