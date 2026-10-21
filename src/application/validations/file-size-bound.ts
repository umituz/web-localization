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
