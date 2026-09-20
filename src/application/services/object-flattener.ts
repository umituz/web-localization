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
 *
 * Note: `collectLeaves` builds the intermediate structure on the target tree
 * (creating missing nested objects) so results can be applied in-place.
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
    void targetLanguage; // reserved for future locale-aware eligibility rules

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
      }
    };

    walk(source, target, pathPrefix);
    return leaves;
  }

  /**
   * Apply a list of (text -> translation) mappings back to the target tree,
   * addressed by each leaf's path (nested keys land in their parent object).
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
        const parent = resolveParentNode(target, leaf.path);
        parent[leaf.key] = translated;
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

/**
 * Navigate (creating as needed) to the object that owns the final segment of
 * a dot-separated leaf path.
 */
function resolveParentNode(
  root: Record<string, unknown>,
  leafPath: string
): Record<string, unknown> {
  const segments = leafPath.split(".");
  segments.pop(); // drop the leaf key itself
  let node: Record<string, unknown> = root;
  for (const segment of segments) {
    const next = node[segment];
    if (!isPlainObject(next)) {
      const created: Record<string, unknown> = {};
      node[segment] = created;
      node = created;
    } else {
      node = next;
    }
  }
  return node;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function needsTranslation(targetValue: unknown): boolean {
  if (typeof targetValue !== "string") return true;
  return targetValue.length === 0;
}
