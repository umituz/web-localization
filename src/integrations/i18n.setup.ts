import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { applyTextCase } from "../application/calculations/text-case-applier";
import { AlreadyInitializedError } from "../core/errors";

export type I18nInstance = typeof i18n;
export type I18nInitCallback = (instance: I18nInstance) => void;
export type LanguageChangeCallback<Lng extends string = string> = (lng: Lng) => void;

export interface DetectionOptions {
  readonly order?: readonly string[];
  readonly caches?: readonly string[];
  readonly lookupLocalStorage?: string;
  readonly lookupSessionStorage?: string;
}

export interface SetupI18nOptions<Lng extends string = string> {
  readonly resources: Record<Lng, { translation: Record<string, unknown> }>;
  readonly fallbackLanguage?: Lng;
  readonly initialLanguage?: Lng;
  readonly onInit?: I18nInitCallback;
  readonly onLanguageChange?: LanguageChangeCallback<Lng>;
  readonly detection?: DetectionOptions;
  readonly lazyLoad?: boolean;
  readonly saveMissing?: boolean;
  readonly reactUseSuspense?: boolean;
}

export interface I18nHandle<Lng extends string = string> {
  readonly instance: I18nInstance;
  addLanguage(lng: string, resources: Record<string, unknown>, ns?: string): void;
  changeLanguage(lng: Lng): Promise<void>;
  getCurrentLanguage(): Lng;
  getFallbackLanguage(): Lng;
  getLanguages(): readonly Lng[];
  isInitialized(): boolean;
  reset(): void;
  whenReady(): Promise<I18nInstance>;
}

type InitOptions = Parameters<typeof i18n.init>[0];

const DETECTION_ORDER = ["localStorage", "navigator"] as const;
const DETECTION_CACHES = ["localStorage"] as const;

interface LanguagePlan<Lng extends string> {
  readonly languages: readonly Lng[];
  readonly fallbackLanguage: Lng;
  readonly initialLanguage: Lng;
}

function planLanguages<Lng extends string>(
  options: SetupI18nOptions<Lng>
): LanguagePlan<Lng> {
  const languages = Object.keys(options.resources) as Lng[];
  const fallbackLanguage = options.fallbackLanguage ?? languages[0];
  return {
    languages,
    fallbackLanguage,
    initialLanguage: options.initialLanguage ?? fallbackLanguage,
  };
}

function configSignature(plan: LanguagePlan<string>): string {
  return `${plan.fallbackLanguage}|${[...plan.languages].sort().join(",")}`;
}

function buildInitOptions<Lng extends string>(
  options: SetupI18nOptions<Lng>,
  plan: LanguagePlan<Lng>
): InitOptions {
  const {
    detection = {},
    lazyLoad = false,
    saveMissing = false,
    reactUseSuspense = true,
  } = options;

  const bundled: Record<string, { translation: Record<string, unknown> }> = {};
  for (const lng of plan.languages) {
    bundled[lng] = { translation: options.resources[lng].translation ?? {} };
  }

  return {
    resources: lazyLoad ? undefined : bundled,
    lng: plan.initialLanguage,
    fallbackLng: plan.fallbackLanguage,
    initImmediate: false,
    load: lazyLoad ? "languageOnly" : "all",
    preload: lazyLoad ? [] : undefined,
    ...(lazyLoad
      ? {}
      : { supportedLngs: [...plan.languages], nonExplicitSupportedLngs: true }),
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

function resolveConfiguredLanguage<Lng extends string>(
  plan: LanguagePlan<Lng>,
  lng: string | undefined
): Lng {
  return lng && (plan.languages as readonly string[]).includes(lng)
    ? (lng as Lng)
    : plan.fallbackLanguage;
}

function bindLanguageEffects<Lng extends string>(
  plan: LanguagePlan<Lng>,
  options: SetupI18nOptions<Lng>
): () => void {
  const cleanups: (() => void)[] = [];

  if (typeof document !== "undefined") {
    const initialLang = document.documentElement.lang;
    const apply = () => {
      document.documentElement.lang = resolveConfiguredLanguage(
        plan,
        i18n.resolvedLanguage ?? i18n.language
      );
    };
    apply();
    i18n.on("languageChanged", apply);
    cleanups.push(() => {
      i18n.off("languageChanged", apply);
      document.documentElement.lang = initialLang;
    });
  }

  if (options.onLanguageChange) {
    const listener = (lng: string) =>
      options.onLanguageChange!(resolveConfiguredLanguage(plan, lng));
    i18n.on("languageChanged", listener);
    cleanups.push(() => i18n.off("languageChanged", listener));
  }

  return () => cleanups.forEach((cleanup) => cleanup());
}

let activeHandle: I18nHandle<string> | null = null;
let activeSignature: string | null = null;

export function setupI18n<Lng extends string = string>(
  options: SetupI18nOptions<Lng>
): I18nHandle<Lng> {
  const plan = planLanguages(options);
  const signature = configSignature(plan);

  if (activeHandle && activeSignature !== signature) {
    throw new AlreadyInitializedError(
      `i18n (initialized with "${activeSignature}", called with "${signature}"). Call resetI18n() first to re-initialize.`
    );
  }

  if (!activeHandle) {
    activeHandle = createHandle(options, plan);
    activeSignature = signature;
  }

  void activeHandle.whenReady();
  return activeHandle as I18nHandle<Lng>;
}

export function resetI18n(): void {
  activeHandle?.reset();
  activeHandle = null;
  activeSignature = null;
}

function createHandle<Lng extends string>(
  options: SetupI18nOptions<Lng>,
  plan: LanguagePlan<Lng>
): I18nHandle<Lng> {
  const initOptions = buildInitOptions(options, plan);
  let initialized = false;
  let initializationPromise: Promise<void> | null = null;
  let detachEffects: (() => void) | null = null;

  const start = (): Promise<void> => {
    if (initializationPromise) return initializationPromise;

    initializationPromise = i18n
      .use(LanguageDetector)
      .use(initReactI18next)
      .init(initOptions)
      .then(() => {
        initialized = true;
        detachEffects = bindLanguageEffects(plan, options);
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

  const handle: I18nHandle<Lng> = {
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
      resolveConfiguredLanguage(plan, i18n.resolvedLanguage ?? i18n.language),
    getFallbackLanguage: () => plan.fallbackLanguage,
    getLanguages: () => plan.languages,
    isInitialized: () => initialized && i18n.isInitialized,
    reset: () => {
      detachEffects?.();
      detachEffects = null;
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
