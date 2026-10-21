import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { applyTextCase } from "../application/calculations/text-case-applier";
import { AlreadyInitializedError } from "../core/errors";
import { LOCALE } from "../core/constants";

export type I18nInstance = typeof i18n;
export type I18nInitCallback = (instance: I18nInstance) => void;

export interface DetectionOptions {
  readonly order?: readonly string[];
  readonly caches?: readonly string[];
  readonly lookupLocalStorage?: string;
  readonly lookupSessionStorage?: string;
}

export interface SeoIntegrationOptions {
  readonly titleKey: string;
  readonly descriptionKey: string;
  readonly defaultImage?: string;
  readonly twitterHandle?: string;
}

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

type InitOptions = Parameters<typeof i18n.init>[0];

const DETECTION_ORDER = ["localStorage", "navigator"] as const;
const DETECTION_CACHES = ["localStorage"] as const;

function configSignature(options: SetupI18nOptions): string {
  const langs = Object.keys(options.resources).sort().join(",");
  return `${options.defaultLng ?? LOCALE.DEFAULT_BASE_LANGUAGE}|${langs}`;
}

function buildInitOptions(options: SetupI18nOptions): InitOptions {
  const {
    resources,
    defaultLng = LOCALE.DEFAULT_BASE_LANGUAGE,
    fallbackLng = LOCALE.DEFAULT_BASE_LANGUAGE,
    detection = {},
    lazyLoad = false,
    saveMissing = false,
    reactUseSuspense = true,
  } = options;

  const bundled: Record<string, { translation: Record<string, unknown> }> = {};
  for (const [lng, resource] of Object.entries(resources)) {
    bundled[lng] = { translation: resource.translation ?? {} };
  }

  return {
    resources: lazyLoad ? undefined : bundled,
    lng: defaultLng,
    fallbackLng,
    load: lazyLoad ? "languageOnly" : "all",
    preload: lazyLoad ? [] : undefined,
    ...(lazyLoad
      ? {}
      : { supportedLngs: Object.keys(bundled), nonExplicitSupportedLngs: true }),
    ns: ["translation"],
    defaultNS: "translation",
    saveMissing,
    interpolation: {
      escapeValue: false,
      format: (value, format) => applyTextCase(value, format),
    },
    detection: {
      order: [...(detection.order ?? DETECTION_ORDER)],
      caches: [...(detection.caches ?? DETECTION_CACHES)],
      ...(detection.lookupLocalStorage
        ? { lookupLocalStorage: detection.lookupLocalStorage }
        : {}),
      ...(detection.lookupSessionStorage
        ? { lookupSessionStorage: detection.lookupSessionStorage }
        : {}),
    },
    react: {
      useSuspense: reactUseSuspense,
      bindI18n: "languageChanged",
      bindI18nStore: "added removed",
      transEmptyNodeValue: "",
      transSupportBasicHtmlNodes: true,
      transKeepBasicHtmlNodesFor: ["br", "strong", "i", "p"],
    },
  };
}

function bindDocumentLanguage(): () => void {
  if (typeof document === "undefined") return () => undefined;
  const initialLang = document.documentElement.lang;
  const apply = () => {
    document.documentElement.lang = i18n.resolvedLanguage || i18n.language;
  };
  apply();
  i18n.on("languageChanged", apply);
  return () => {
    i18n.off("languageChanged", apply);
    document.documentElement.lang = initialLang;
  };
}

function attachSeo(seo: SeoIntegrationOptions): void {
  void import("@umituz/web-seo")
    .then(({ initSEO }) => initSEO({ i18n, ...seo }))
    .catch((error: unknown) => {
      console.warn(
        "[web-localization] SEO integration skipped — install @umituz/web-seo to enable it.",
        error,
      );
    });
}

let activeHandle: I18nHandle | null = null;
let activeSignature: string | null = null;

export function setupI18n(options: SetupI18nOptions): I18nHandle {
  const signature = configSignature(options);

  if (activeHandle && activeSignature !== signature) {
    throw new AlreadyInitializedError(
      `i18n (initialized with "${activeSignature}", called with "${signature}"). Call resetI18n() first to re-initialize.`
    );
  }

  if (!activeHandle) {
    activeHandle = createHandle(options, buildInitOptions(options));
    activeSignature = signature;
  }

  void activeHandle.whenReady();
  return activeHandle;
}

export function resetI18n(): void {
  activeHandle?.reset();
  activeHandle = null;
  activeSignature = null;
}

function createHandle(options: SetupI18nOptions, initOptions: InitOptions): I18nHandle {
  let initialized = false;
  let initializationPromise: Promise<void> | null = null;
  let unbindDocumentLanguage: (() => void) | null = null;

  const start = (): Promise<void> => {
    if (initializationPromise) return initializationPromise;

    initializationPromise = i18n
      .use(LanguageDetector)
      .use(initReactI18next)
      .init(initOptions)
      .then(() => {
        initialized = true;
        unbindDocumentLanguage = bindDocumentLanguage();
        if (options.seo) attachSeo(options.seo);
        if (options.onInit) options.onInit(i18n);
      })
      .catch((error: unknown) => {
        initializationPromise = null;
        throw error instanceof Error ? error : new Error(String(error));
      });

    return initializationPromise;
  };

  const assertInitialized = (): void => {
    if (!initialized) {
      throw new Error("i18n is not initialized yet. Call setupI18n first.");
    }
  };

  const handle: I18nHandle = {
    instance: i18n,
    addLanguage: (lng, resources, ns = "translation") => {
      assertInitialized();
      const supported = i18n.options.supportedLngs;
      if (supported && !supported.includes(lng)) {
        (supported as string[]).push(lng);
      }
      i18n.addResourceBundle(lng, ns, resources, true, true);
    },
    changeLanguage: async (lng) => {
      assertInitialized();
      await i18n.changeLanguage(lng);
    },
    getCurrentLanguage: () =>
      i18n.resolvedLanguage ||
      i18n.language ||
      i18n.languages[0] ||
      LOCALE.DEFAULT_BASE_LANGUAGE,
    isInitialized: () => initialized && i18n.isInitialized,
    reset: () => {
      unbindDocumentLanguage?.();
      unbindDocumentLanguage = null;
      initialized = false;
      initializationPromise = null;
      if (i18n.isInitialized) {
        for (const lng of [...i18n.languages]) {
          i18n.removeResourceBundle(lng, "translation");
        }
      }
      if (activeHandle === handle) {
        activeHandle = null;
        activeSignature = null;
      }
    },
    whenReady: () => start().then(() => i18n),
  };

  return handle;
}
