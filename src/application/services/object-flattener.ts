/**
 * Object Tree Walker for Translation
 * @description Walks a nested object structure, identifies translatable leaf strings,
 * and applies translations back to the target tree.
 *
 * Single responsibility: tree traversal and transformation.
 * No API calls, no caching, no I/O.
 */
import type { Iso639Code } from "../../core/types/branded";
import type {
  TranslationItem,
} from "../../domain/entities/translation.entity";
import { TranslationStats } from "../../domain/entities/translation.entity";
import type { TranslationProgressHandler } from "../../domain/interfaces/translation-service.interface";

interface LeafToTranslate {
  readonly key: string;
  readonly path: string;
  readonly text: string;
}

/**
 * Walk source/target trees, collect leaf strings needing translation, apply results.
 */
export class ObjectTreeWalker {
  /**
   * Collect all leaf strings in the source tree that need translation.
   * @param force If true, include already-translated values.
   */
  collectLeaves(
    source: Record<string, unknown>,
    target: Record<string, unknown>,
    pathPrefix: string,
    targetLanguage: Iso639Code,
    force: boolean
  ): LeafToTranslate[] {
    const leaves: LeafToTranslate[] = [];

    const walk = (src: Record<string, unknown>, tgt: Record<string, unknown>, prefix: string) => {
      for (const key of Object.keys(src)) {
        const srcValue = src[key];
        const tgtValue = tgt[key];
        const currentPath = prefix ? `${prefix}.${key}` : key;

        if (isPlainObject(srcValue) && srcValue !== null) {
          const nextTarget = isPlainObject(tgtValue) ? (tgtValue as Record<string, unknown>) : {};
          if (!isPlainObject(tgt[key])) {
            tgt[key] = nextTarget;
          }
          walk(srcValue as Record<string, unknown>, nextTarget, currentPath);
          continue;
        }

        if (typeof srcValue !== "string") continue;

        if (!force && !needsTranslation(tgtValue)) continue;

        leaves.push({ key, path: currentPath, text: srcValue });
        // Reference targetLanguage to mark intent even if unused
        void targetLanguage;
      }
    };

    walk(source, target, pathPrefix);
    return leaves;
  }

  /**
   * Apply a list of (text -> translation) mappings back to the target tree.
   * @returns Updated stats with successes/failures recorded.
   */
  applyTranslations(
    target: Record<string, unknown>,
    leaves: readonly LeafToTranslate[],
    translations: ReadonlyMap<string, string>,
    onProgress: TranslationProgressHandler | undefined,
    stats: TranslationStats
  ): TranslationStats {
    let updated: TranslationStats = stats;

    for (const leaf of leaves) {
      const translated = translations.get(leaf.text);
      if (translated && translated !== leaf.text) {
        target[leaf.key] = translated;
        const item: TranslationItem = { key: leaf.path, from: leaf.text, to: translated };
        updated = updated.withSuccess(item);
        if (onProgress) onProgress(leaf.path, leaf.text, translated);
      } else {
        updated = updated.withFailure();
      }
    }

    return updated;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function needsTranslation(targetValue: unknown): boolean {
  if (typeof targetValue !== "string") return true;
  return targetValue.length === 0;
}
