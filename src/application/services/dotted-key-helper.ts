/**
 * Pure helpers for converting between nested locale objects and dotted key
 * paths ("nav.header.login"), used by the source-scan sync flow.
 */

export interface PruneResult {
  readonly pruned: Record<string, unknown>;
  readonly removedPaths: readonly string[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Sets `value` at the dotted `path`, creating intermediate objects as needed.
 * Returns false when an existing node conflicts with the path: a non-object
 * intermediate ("nav" is a string but "nav.home" is requested) or an existing
 * object subtree at the final segment (a scalar must never clobber it).
 */
export function setByDottedPath(
  target: Record<string, unknown>,
  dottedPath: string,
  value: unknown
): boolean {
  const segments = dottedPath.split(".");
  if (segments.length === 0 || segments.some((segment) => segment.length === 0)) {
    return false;
  }

  let node: Record<string, unknown> = target;
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    if (segment === undefined) return false;
    const next = node[segment];
    if (isPlainObject(next)) {
      node = next;
      continue;
    }
    if (next !== undefined) {
      return false; // Conflict: an existing leaf blocks this path.
    }
    const created: Record<string, unknown> = {};
    node[segment] = created;
    node = created;
  }

  const last = segments[segments.length - 1];
  if (last === undefined) return false;
  const existing = node[last];
  if (isPlainObject(existing)) {
    return false; // Keep the richer existing subtree.
  }
  node[last] = value;
  return true;
}

/**
 * Flattens a nested object into a Map of dotted path → leaf value.
 * Objects are recursed into; everything else (strings, numbers, arrays,
 * booleans, null) is treated as a leaf.
 */
export function flattenToDottedPaths(
  source: Record<string, unknown>,
  prefix = ""
): Map<string, unknown> {
  const leaves = new Map<string, unknown>();

  for (const key of Object.keys(source)) {
    const value = source[key];
    const currentPath = prefix ? `${prefix}.${key}` : key;

    if (isPlainObject(value)) {
      for (const [path, leaf] of flattenToDottedPaths(value, currentPath)) {
        leaves.set(path, leaf);
      }
    } else {
      leaves.set(currentPath, value);
    }
  }

  return leaves;
}

/**
 * Rebuilds `source` keeping only the leaf paths present in `allowedPaths`.
 * Intermediate objects survive only when they still contain kept leaves.
 */
export function pruneToPaths(
  source: Record<string, unknown>,
  allowedPaths: ReadonlySet<string>
): PruneResult {
  const pruned: Record<string, unknown> = {};
  const removedPaths: string[] = [];

  for (const [path, value] of flattenToDottedPaths(source)) {
    if (allowedPaths.has(path)) {
      setByDottedPath(pruned, path, value);
    } else {
      removedPaths.push(path);
    }
  }

  return { pruned, removedPaths };
}
