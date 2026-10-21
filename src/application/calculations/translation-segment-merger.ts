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
