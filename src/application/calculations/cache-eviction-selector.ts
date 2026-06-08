/**
 * Cache Eviction Selector
 * @description Selects which key to evict from a Map when capacity is exceeded.
 * Uses the insertion-order property of JavaScript Maps (oldest entry is
 * iterated first via `.keys().next()`).
 *
 * @returns The key to evict, or null if the map is empty.
 */
export function selectOldestEvictionKey<K, V>(map: Map<K, V>): K | null {
  if (map.size === 0) return null;
  const firstKey = map.keys().next();
  return firstKey.done ? null : firstKey.value;
}

/**
 * Eviction decision: should we evict to make room for one more entry?
 */
export function shouldEvictToMakeRoom(currentSize: number, maxSize: number): boolean {
  return currentSize >= maxSize;
}
