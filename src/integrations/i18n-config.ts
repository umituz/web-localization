import i18n from "i18next";
import { applyTextCase } from "../application/calculations/text-case-applier";

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

export interface I18nConfigBuilderInput {
  readonly resources: Record<string, { translation: Record<string, unknown> }>;
  readonly defaultLng?: string;
  readonly fallbackLng?: string;
  readonly detection?: DetectionOptions;
  readonly seo?: SeoIntegrationOptions;
  readonly lazyLoad?: boolean;
  readonly saveMissing?: boolean;
  readonly reactUseSuspense?: boolean;
}

export interface BuiltI18nConfig {
  readonly options: Parameters<typeof i18n.init>[0];
  readonly seo?: SeoIntegrationOptions;
  readonly onBeforeInit?: (instance: typeof i18n) => void;
}

export function computeConfigSignature(input: I18nConfigBuilderInput): string {
  const langs = Object.keys(input.resources).sort().join(",");
  return `${input.defaultLng ?? "en-US"}|${langs}`;
}

export class I18nConfigBuilder {
  private readonly input: I18nConfigBuilderInput;

  constructor(input: I18nConfigBuilderInput) {
    this.input = input;
  }

  signature(): string {
    return computeConfigSignature(this.input);
  }

  build(): BuiltI18nConfig {
    const {
      resources,
      defaultLng = "en-US",
      fallbackLng = "en-US",
      detection = { order: ["localStorage", "navigator"], caches: ["localStorage"] },
      seo,
      lazyLoad = false,
      saveMissing = false,
      reactUseSuspense = true,
    } = this.input;

    const optimizedResources = this.optimizeResources(resources);

    const options: Parameters<typeof i18n.init>[0] = {
      resources: lazyLoad ? undefined : optimizedResources,
      lng: defaultLng,
      fallbackLng,
      load: lazyLoad ? "languageOnly" : "all",
      preload: lazyLoad ? [] : undefined,
      ns: ["translation"],
      defaultNS: "translation",
      saveMissing,
      interpolation: {
        escapeValue: false,
        format: (value, format) => applyTextCase(value, format),
      },
      detection: {
        order: [...(detection.order ?? ["localStorage", "navigator"])],
        caches: [...(detection.caches ?? ["localStorage"])],
        ...(detection.lookupLocalStorage ? { lookupLocalStorage: detection.lookupLocalStorage } : {}),
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

    return { options, seo };
  }

  private optimizeResources(
    resources: Record<string, { translation: Record<string, unknown> }>
  ): Record<string, { translation: Record<string, unknown> }> {
    const optimized: Record<string, { translation: Record<string, unknown> }> = {};
    for (const [lang, resource] of Object.entries(resources)) {
      optimized[lang] = { translation: resource.translation ?? {} };
    }
    return optimized;
  }
}
