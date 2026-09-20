/**
 * Generic LRU Cache
 * @description Bounded Map that evicts least-recently-used entries on overflow.
 * Uses JavaScript Map's insertion-order semantics for O(1) LRU operations.
 *
 * Optional TTL is tracked internally per entry (the stored value is never
 * mutated or wrapped), so TTL works for primitives like strings.
 *
 * Eviction is delegated to the cache-eviction-selector calculation.
 */
import {
  selectOldestEvictionKey,
  shouldEvictToMakeRoom,
} from "../../application/calculations/cache-eviction-selector";
import { isTtlExpired } from "../../application/calculations/time-elapsed-calculator";

interface TimedEntry<V> {
  readonly value: V;
  readonly cachedAt: number;
}

export class LRUCache<K, V> {
  /** Untimed entries store the value directly; timed ones wrap it. */
  private readonly store = new Map<K, V | TimedEntry<V>>();
  private readonly maxSize: number;
  private readonly ttlMs: number | null;

  constructor(maxSize: number, ttlMs: number | null = null) {
    if (!Number.isInteger(maxSize) || maxSize < 1) {
      throw new Error("LRUCache maxSize must be a positive integer");
    }
    if (ttlMs !== null && ttlMs <= 0) {
      throw new Error("LRUCache ttlMs must be a positive number of milliseconds");
    }
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  get(key: K): V | undefined {
    const entry = this.store.get(key);
    if (entry === undefined) return undefined;

    if (this.isExpired(entry)) {
      this.store.delete(key);
      return undefined;
    }

    // Refresh recency (Map re-insertion moves the key to the end).
    this.store.delete(key);
    this.store.set(key, entry);
    return this.unwrap(entry);
  }

  set(key: K, value: V): void {
    this.store.delete(key);
    while (shouldEvictToMakeRoom(this.store.size, this.maxSize)) {
      const victim = selectOldestEvictionKey(this.store);
      if (victim === null) break;
      this.store.delete(victim);
    }
    this.store.set(key, this.wrap(value));
  }

  has(key: K): boolean {
    const entry = this.store.get(key);
    if (entry === undefined) return false;
    if (this.isExpired(entry)) {
      this.store.delete(key);
      return false;
    }
    return true;
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

  // --------------------------------------------------------------------------
  // Internal
  // --------------------------------------------------------------------------

  private wrap(value: V): V | TimedEntry<V> {
    if (this.ttlMs === null) return value;
    return { value, cachedAt: Date.now() };
  }

  private unwrap(entry: V | TimedEntry<V>): V {
    return this.ttlMs === null ? (entry as V) : (entry as TimedEntry<V>).value;
  }

  private isExpired(entry: V | TimedEntry<V>): boolean {
    if (this.ttlMs === null) return false;
    return isTtlExpired((entry as TimedEntry<V>).cachedAt, this.ttlMs);
  }
}

/**
 * TTL-stamped entry shape.
 * @deprecated No longer used by `LRUCache` — TTL is tracked internally since
 * v1.2.0. Kept only for backwards compatibility of the public type surface.
 */
export interface TTLEntry<V> {
  readonly value: V;
  readonly expiresAt: number;
}
