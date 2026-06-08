/**
 * Generic LRU Cache
 * @description Bounded Map that evicts least-recently-used entries on overflow.
 * Uses JavaScript Map's insertion-order semantics for O(1) LRU operations.
 *
 * Eviction is delegated to the cache-eviction-selector calculation.
 */
import {
  selectOldestEvictionKey,
  shouldEvictToMakeRoom,
} from "../../application/calculations/cache-eviction-selector";
import { isTtlExpired } from "../../application/calculations/time-elapsed-calculator";

export class LRUCache<K, V> {
  private readonly store = new Map<K, V>();
  private readonly maxSize: number;
  private readonly ttlMs: number | null;

  constructor(maxSize: number, ttlMs: number | null = null) {
    if (!Number.isInteger(maxSize) || maxSize < 1) {
      throw new Error("LRUCache maxSize must be a positive integer");
    }
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  get(key: K): V | undefined {
    if (!this.store.has(key)) return undefined;

    if (this.ttlMs !== null) {
      const stamped = this.store.get(key) as V & { __cachedAt?: number };
      if (stamped && typeof stamped === "object" && "__cachedAt" in stamped) {
        if (isTtlExpired(stamped.__cachedAt as number, this.ttlMs)) {
          this.store.delete(key);
          return undefined;
        }
      }
    }

    const value = this.store.get(key) as V;
    this.store.delete(key);
    this.store.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    }
    while (shouldEvictToMakeRoom(this.store.size, this.maxSize)) {
      const victim = selectOldestEvictionKey(this.store);
      if (victim === null) break;
      this.store.delete(victim);
    }
    this.store.set(key, value);
  }

  has(key: K): boolean {
    return this.store.has(key);
  }

  delete(key: K): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }

  stats(): { size: number; maxSize: number } {
    return { size: this.store.size, maxSize: this.maxSize };
  }
}

/**
 * TTL-stamped entry for LRUCache.
 */
export interface TTLEntry<V> {
  readonly value: V;
  readonly expiresAt: number;
}

export function wrapWithTTL<V>(value: V, _ttlMs: number): V & { __cachedAt: number } {
  return { ...(value as object), __cachedAt: Date.now() } as V & { __cachedAt: number };
}
