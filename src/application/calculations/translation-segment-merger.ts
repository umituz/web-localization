/**
 * Translation Segment Merger
 * @description Joins translated text segments returned by the translation API
 * into a single string. The Google Translate API returns segments split
 * across multiple translation units (typically for very long inputs).
 *
 * Pure function — takes the API response array, returns a single string.
 * Returns empty string for invalid/empty input.
 */
export function mergeTranslationSegments(segments: ReadonlyArray<unknown>): string {
  if (segments.length === 0) {
    return "";
  }

  const merged: string[] = [];
  for (const segment of segments) {
    if (Array.isArray(segment) && segment.length > 0 && typeof segment[0] === "string") {
      merged.push(segment[0]);
    }
  }
  return merged.join("");
}
