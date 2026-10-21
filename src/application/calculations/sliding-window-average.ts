export class SlidingWindowAverage {
  private readonly history: number[] = [];
  private readonly maxSize: number;

  constructor(maxSize: number) {
    if (!Number.isInteger(maxSize) || maxSize < 1) {
      throw new Error("SlidingWindowAverage maxSize must be a positive integer");
    }
    this.maxSize = maxSize;
  }

  add(sample: number): void {
    if (!Number.isFinite(sample) || sample < 0) return;
    this.history.push(sample);
    if (this.history.length > this.maxSize) {
      this.history.shift();
    }
  }

  average(): number {
    if (this.history.length === 0) return 0;
    const sum = this.history.reduce((a, b) => a + b, 0);
    return sum / this.history.length;
  }

  get size(): number {
    return this.history.length;
  }

  clear(): void {
    this.history.length = 0;
  }
}
