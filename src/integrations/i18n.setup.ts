/**
 * i18n Setup - Public API
 * @description Composes I18nCore, I18nConfigBuilder, and SEO integration.
 *
 * Lifecycle: call `setupI18n()` once at app startup. The returned `I18nHandle`
 * provides runtime operations. Re-calling with different resources throws —
 * call `handle.reset()` first if you need to re-initialize.
 */
import i18n from "i18next";
import {
  I18nCore,
  type I18nInstance,
  type I18nInitCallback,
} from "./i18n-core";
import {
  I18nConfigBuilder,
  computeConfigSignature,
  type DetectionOptions,
  type SeoIntegrationOptions,
} from "./i18n-config";
import { AlreadyInitializedError } from "../core/errors";

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
 * with different resources (different default language or language set)
 * throws `AlreadyInitializedError` — call `resetI18n()` first to re-init.
 */
export function setupI18n(options: SetupI18nOptions): I18nHandle {
  const incomingSignature = computeConfigSignature({
    resources: options.resources,
    defaultLng: options.defaultLng,
    fallbackLng: options.fallbackLng,
    detection: options.detection,
    seo: options.seo,
    lazyLoad: options.lazyLoad,
    saveMissing: options.saveMissing,
    reactUseSuspense: options.reactUseSuspense,
  });

  if (globalCore) {
    // Already initializing or initialized. Reuse the existing core only when
    // the configuration fingerprint matches; a mismatch means the caller is
    // trying to re-initialize with different resources.
    if (globalCore.signature !== incomingSignature) {
      throw new AlreadyInitializedError(
        `i18n (initialized with "${globalCore.signature}", called with "${incomingSignature}"). Call resetI18n() first to re-initialize.`
      );
    }
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
    // Loaded lazily so consumers that do not use the SEO integration never
    // pull @umituz/web-seo (an optional peer) into their bundle.
    seoIntegrator: (instance, seo) => {
      void import("@umituz/web-seo")
        .then(({ initSEO }) => initSEO({ i18n: instance, ...seo }))
        .catch((error: unknown) => {
          console.warn(
            "[web-localization] SEO integration skipped — install @umituz/web-seo to enable it.",
            error,
          );
        });
    },
  });

  core.initialize();
  // Only cache the core once initialization has been kicked off successfully;
  // a synchronous failure above leaves no half-initialized global state.
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
