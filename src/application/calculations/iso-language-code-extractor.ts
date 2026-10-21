export function extractIso639Code(localeTag: string): string {
  if (!localeTag) return "";
  const dashIndex = localeTag.indexOf("-");
  if (dashIndex === -1) return localeTag;
  return localeTag.substring(0, dashIndex);
}

export function extractLocaleCodeFromFilename(filename: string): string {
  if (!filename.endsWith(".ts")) return filename;
  return filename.slice(0, -3);
}
