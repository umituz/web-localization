export function selectOldestEvictionKey<K, V>(map: Map<K, V>): K | null {
  if (map.size === 0) return null;
  const firstKey = map.keys().next();
  return firstKey.done ? null : firstKey.value;
}

export function shouldEvictToMakeRoom(currentSize: number, maxSize: number): boolean {
  return currentSize >= maxSize;
}
