/**
 * Sliding Window Average
 * @description Maintains a bounded history of numeric samples and returns
 * the current average. New samples push out the oldest when full.
 *
 * Pure data structure — call .add() to record, .average() to read.
 */
export class SlidingWindowAverage {
  private readonly history: number[] = [];
  private readonly maxSize: number;

  constructor(maxSize: number) {
    if (!Number.isInteger(maxSize) || maxSize < 1) {
      throw new Error("SlidingWindowAverage maxSize must be a positive integer");
    }
    this.maxSize = maxSize;
  }

  /**
   * Add a sample. If the history is full, the oldest sample is discarded.
   * Negative or non-finite values are ignored (caller's responsibility to filter).
   */
  add(sample: number): void {
    if (!Number.isFinite(sample) || sample < 0) return;
    this.history.push(sample);
    if (this.history.length > this.maxSize) {
      this.history.shift();
    }
  }

  /**
   * Current average of all samples in the window. Returns 0 if empty.
   */
  average(): number {
    if (this.history.length === 0) return 0;
    const sum = this.history.reduce((a, b) => a + b, 0);
    return sum / this.history.length;
  }

  /**
   * Number of samples currently in the window.
   */
  get size(): number {
    return this.history.length;
  }

  /**
   * Clear all samples.
   */
  clear(): void {
    this.history.length = 0;
  }
}
