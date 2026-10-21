import type { Iso639Code } from "../types/branded";

export type ProgressEvent =
  | { readonly type: "start"; readonly totalLanguages: number }
  | { readonly type: "languageStart"; readonly language: string; readonly keyCount: number }
  | {
      readonly type: "keyTranslated";
      readonly language: string;
      readonly path: string;
      readonly from: string;
      readonly to: string;
    }
  | {
      readonly type: "languageComplete";
      readonly language: string;
      readonly successCount: number;
      readonly failureCount: number;
      readonly skippedCount: number;
    }
  | {
      readonly type: "complete";
      readonly languagesSucceeded: number;
      readonly languagesFailed: number;
      readonly totalTranslated: number;
      readonly totalFailed: number;
    }
  | { readonly type: "error"; readonly language?: string; readonly error: Error };

export type ProgressEventType = ProgressEvent["type"];

type AnyListener = (event: ProgressEvent) => void;

export class ProgressEmitter {
  private readonly listeners = new Map<ProgressEventType, Set<AnyListener>>();

  on<E extends ProgressEventType>(
    type: E,
    listener: (event: Extract<ProgressEvent, { type: E }>) => void
  ): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    const wrapped: AnyListener = (event) => {
      if (event.type === type) {
        listener(event as Extract<ProgressEvent, { type: E }>);
      }
    };
    set.add(wrapped);
    return () => {
      this.listeners.get(type)?.delete(wrapped);
    };
  }

  emit(event: ProgressEvent): void {
    const set = this.listeners.get(event.type);
    if (!set) return;
    for (const listener of set) {
      try {
        listener(event);
      } catch (err) {

        console.error("[ProgressEmitter] listener threw:", err);
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }

  listenerCount(type?: ProgressEventType): number {
    if (type) return this.listeners.get(type)?.size ?? 0;
    let count = 0;
    for (const set of this.listeners.values()) count += set.size;
    return count;
  }
}

export class NullProgressEmitter extends ProgressEmitter {
  override emit(): void {

  }
}

export type { Iso639Code };
