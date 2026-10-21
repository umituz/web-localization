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

  globalCore = core;
  return buildHandle(core);
}

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
      const inst = core.getInstance();
      const supported = inst.options.supportedLngs as string[] | undefined;
      if (supported && !supported.includes(lng)) supported.push(lng);
      inst.addResourceBundle(lng, ns, resources, true, true);
    },
    changeLanguage: async (lng) => {
      if (!core.isInitialized()) {
        throw new Error("i18n is not initialized yet. Call setupI18n first.");
      }
      await core.getInstance().changeLanguage(lng);
    },
    getCurrentLanguage: () => {
      const inst = core.getInstance();
      return inst.resolvedLanguage || inst.language || inst.languages[0] || "en-US";
    },
    isInitialized: () => core.isInitialized(),
    reset: () => {
      core.reset();
      globalCore = null;
    },
    whenReady: () => core.whenReady(),
  };
}
