import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import type { I18nConfigBuilder, BuiltI18nConfig } from "./i18n-config";

export type I18nInstance = typeof i18n;
export type I18nInitCallback = (instance: I18nInstance) => void;

export interface I18nCoreOptions {
  readonly builder: I18nConfigBuilder;
  readonly onInit?: I18nInitCallback;
  readonly seoIntegrator?: (
    instance: I18nInstance,
    seo: NonNullable<BuiltI18nConfig["seo"]>
  ) => void;
}

export class I18nCore {
  private initialized = false;
  private initializationPromise: Promise<I18nInstance> | null = null;
  private detachLanguageSync: (() => void) | null = null;

  constructor(
    private readonly instance: I18nInstance = i18n,
    private readonly options: I18nCoreOptions
  ) {}

  get signature(): string {
    return this.options.builder.signature();
  }

  initialize(): I18nInstance {
    if (this.initialized && this.instance.isInitialized) {
      return this.instance;
    }

    if (this.initializationPromise) {
      return this.instance;
    }

    const built = this.options.builder.build();
    const { onInit, seoIntegrator } = this.options;

    this.initializationPromise = this.instance
      .use(LanguageDetector)
      .use(initReactI18next)
      .init(built.options)
      .then(() => {
        this.initialized = true;
        this.attachLanguageSync();

        if (built.seo && seoIntegrator) {
          seoIntegrator(this.instance, built.seo);
        }

        if (onInit) {
          onInit(this.instance);
        }

        return this.instance;
      })
      .catch((error: unknown) => {
        this.initializationPromise = null;
        throw error instanceof Error ? error : new Error(String(error));
      });

    return this.instance;
  }

  async whenReady(): Promise<I18nInstance> {
    if (this.initialized && this.instance.isInitialized) {
      return this.instance;
    }
    if (this.initializationPromise) {
      await this.initializationPromise;
    } else {
      this.initialize();
      await this.initializationPromise;
    }
    return this.instance;
  }

  getInstance(): I18nInstance {
    return this.instance;
  }

  isInitialized(): boolean {
    return this.initialized && this.instance.isInitialized;
  }

  private attachLanguageSync(): void {
    if (typeof document === "undefined" || this.detachLanguageSync) return;
    const initialLang = document.documentElement.lang;
    const apply = () => {
      document.documentElement.lang =
        this.instance.resolvedLanguage || this.instance.language;
    };
    apply();
    this.instance.on("languageChanged", apply);
    this.detachLanguageSync = () => {
      this.instance.off("languageChanged", apply);
      document.documentElement.lang = initialLang;
      this.detachLanguageSync = null;
    };
  }

  reset(): void {
    this.detachLanguageSync?.();
    this.initialized = false;
    this.initializationPromise = null;
    if (this.instance.isInitialized) {
      for (const lng of [...this.instance.languages]) {
        this.instance.removeResourceBundle(lng, "translation");
      }
    }
  }
}
