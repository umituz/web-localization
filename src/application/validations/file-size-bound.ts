/**
 * File Size Bound Guard
 * @description Asserts that a file's size is within an allowed limit.
 * Prevents loading arbitrarily large files into memory.
 *
 * @throws LocaleFileSizeError if the file exceeds the limit.
 */
import { LocaleFileSizeError } from "../../core/errors";

export interface FileSizeBoundInput {
  readonly filePath: string;
  readonly actualSizeBytes: number;
  readonly maxSizeBytes: number;
}

export function assertFileSizeWithinBound(input: FileSizeBoundInput): void {
  if (input.actualSizeBytes > input.maxSizeBytes) {
    throw new LocaleFileSizeError(
      input.filePath,
      input.actualSizeBytes,
      input.maxSizeBytes
    );
  }
}
