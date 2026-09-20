/**
 * i18n Core
 * @description Owns the i18next instance and initialization state.
 * Single responsibility: lifecycle management of the i18n singleton.
 *
 * Idempotency: initialization is one-shot per core instance. Calling
 * `initialize()` after success returns the existing instance.
 * Detecting a conflicting re-initialization (different resources) is
 * `setupI18n`'s responsibility — it compares fingerprints before reuse.
 */
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

  constructor(
    private readonly instance: I18nInstance = i18n,
    private readonly options: I18nCoreOptions
  ) {}

  /**
   * Fingerprint of the configuration this core was built from. Callers use it
   * to detect conflicting re-initialization (same core, different resources).
   */
  get signature(): string {
    return this.options.builder.signature();
  }

  /**
   * Initialize i18next. Idempotent per core instance — re-calling after
   * success returns the existing instance. Conflict detection (initializing
   * the shared core with different resources) lives in `setupI18n`, which is
   * the only place where a *different* configuration can be observed.
   */
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

  /**
   * Awaitable initialization. Prefer this for code that needs to know when init is done.
   */
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

  /**
   * Reset initialization state and clear resources. Primarily for tests.
   */
  reset(): void {
    this.initialized = false;
    this.initializationPromise = null;
    if (this.instance.isInitialized) {
      for (const lng of [...this.instance.languages]) {
        this.instance.removeResourceBundle(lng, "translation");
      }
    }
  }
}
