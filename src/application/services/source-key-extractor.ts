/**
 * Pure extraction of i18n translation keys from source file content.
 *
 * Recognized patterns (heuristic, zero-dependency — same family as
 * @umituz/react-native-google-translate's extractor):
 *   1. t('key') / t("key", { ...options }) — i18next-style calls
 *   2. Dot-notation string literals with 2+ segments ("a.b.c")
 *   3. Template literals t(`prefix.${id}`) expanded against array literals
 *      found in the same file
 */

const IGNORED_DOMAINS = [".com", ".org", ".net", ".io", ".co", ".app", ".ai", ".gov", ".edu"];

const IGNORED_EXTENSIONS = [
  ".ts", ".tsx", ".js", ".jsx", ".json", ".yaml", ".yml",
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".pdf",
  ".mp4", ".mov", ".avi", ".mp3", ".wav", ".css", ".scss", ".md",
];

const IGNORED_LAYOUT_VALS = new Set([
  "center", "row", "column", "flex", "absolute", "relative", "hidden", "visible",
  "transparent", "bold", "normal", "italic", "contain", "cover", "stretch",
  "top", "bottom", "left", "right", "middle", "auto", "none", "underline",
  "capitalize", "uppercase", "lowercase", "solid", "dotted", "dashed", "wrap",
  "nowrap", "space-between", "space-around", "flex-start", "flex-end", "baseline",
  "react", "index", "default", "string", "number", "boolean", "key", "id",
  "true", "false", "null", "undefined", "yes", "no",
]);

/** t('key') / t("key") / t(`key`) — optionally with an options argument. */
const T_CALL_PATTERN = /(?:^|\W)t\(\s*['"`]([^'"`]+)['"`]\s*(?:,[^()]*)?\)/g;

/** Dot-notation literals with at least two dots (reduces false positives). */
const DOT_NOTATION_PATTERN = /['"`]([a-z][a-z0-9_]*\.(?:[a-z0-9_]+\.)+[a-z0-9_]+)['"`]/gi;

/** Template literals: t(`prefix.${…}`) — prefix captured before the interpolation. */
const TEMPLATE_PREFIX_PATTERN = /t\(`([a-z0-9_.]+)\.\$\{/g;

/** Array literal contents (non-greedy) used to expand template prefixes. */
const ARRAY_LITERAL_PATTERN = /\[([\s\S]*?)\]/g;

/** Quoted identifiers inside array literals. */
const ARRAY_ITEM_PATTERN = /['"`]([a-z0-9_]{2,40})['"`]/g;

/** Purely numeric array items — never meaningful key suffixes. */
const PURE_NUMBER_PATTERN = /^[0-9]+$/;

export type UsedKeyMap = ReadonlyMap<string, string>;

/**
 * Extract candidate translation keys from a single file's content.
 * The default value for every key is the key path itself (the caller decides
 * what to store in the base locale — the CLI stores "" for human follow-up).
 */
export function extractKeysFromContent(content: string): Map<string, string> {
  const keyMap = new Map<string, string>();

  collectTCallKeys(content, keyMap);
  collectDotNotationKeys(content, keyMap);
  collectTemplateLiteralKeys(content, keyMap);

  return keyMap;
}

function collectTCallKeys(content: string, keyMap: Map<string, string>): void {
  T_CALL_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = T_CALL_PATTERN.exec(content)) !== null) {
    const key = match[1];
    if (!key) continue;
    // Skip dynamic interpolations inside the quoted segment.
    if (key.includes("${")) continue;
    addKey(keyMap, key);
  }
}

function collectDotNotationKeys(content: string, keyMap: Map<string, string>): void {
  DOT_NOTATION_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = DOT_NOTATION_PATTERN.exec(content)) !== null) {
    const key = match[1];
    if (!key) continue;
    const lower = key.toLowerCase();
    const isIgnoredDomain = IGNORED_DOMAINS.some((domain) => lower.endsWith(domain));
    const isIgnoredExtension = IGNORED_EXTENSIONS.some((ext) => lower.endsWith(ext));
    if (isIgnoredDomain || isIgnoredExtension) continue;
    if (key.includes(" ")) continue;
    addKey(keyMap, key);
  }
}

function collectTemplateLiteralKeys(content: string, keyMap: Map<string, string>): void {
  TEMPLATE_PREFIX_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TEMPLATE_PREFIX_PATTERN.exec(content)) !== null) {
    const prefix = match[1];
    if (!prefix) continue;
    expandPrefixAgainstArrays(content, prefix, keyMap);
  }
}

function expandPrefixAgainstArrays(
  content: string,
  prefix: string,
  keyMap: Map<string, string>
): void {
  ARRAY_LITERAL_PATTERN.lastIndex = 0;
  let arrayMatch: RegExpExecArray | null;
  while ((arrayMatch = ARRAY_LITERAL_PATTERN.exec(content)) !== null) {
    const inner = arrayMatch[1];
    if (!inner) continue;

    ARRAY_ITEM_PATTERN.lastIndex = 0;
    let itemMatch: RegExpExecArray | null;
    while ((itemMatch = ARRAY_ITEM_PATTERN.exec(inner)) !== null) {
      const id = itemMatch[1];
      if (!id) continue;
      if (IGNORED_LAYOUT_VALS.has(id.toLowerCase())) continue;
      if (PURE_NUMBER_PATTERN.test(id)) continue;
      addKey(keyMap, `${prefix}.${id}`);
    }
  }
}

function addKey(keyMap: Map<string, string>, key: string): void {
  if (!keyMap.has(key)) {
    keyMap.set(key, key);
  }
}
