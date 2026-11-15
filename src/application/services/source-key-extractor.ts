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
const DOT_NOTATION_PATTERN = /['"`]([a-z][a-z0-9_]*\.(?:[a-z0-9_]{2,}\.)+[a-z0-9_]{2,})['"`]/gi;

/** Template literals: t(`prefix.${expr}`) — prefix and interpolation captured. */
const TEMPLATE_PREFIX_PATTERN = /t\(`([a-z0-9_.]+)\.\$\{([^}`]+)\}`/g;

/** Quoted identifiers inside array literals. */
const ARRAY_ITEM_PATTERN = /['"`]([a-z0-9_]{2,40})['"`]/g;

/** Purely numeric array items — never meaningful key suffixes. */
const PURE_NUMBER_PATTERN = /^[0-9]+$/;

/** Last identifier segment of an interpolation expression (`v.id` → `id`). */
const LAST_IDENTIFIER_PATTERN = /[A-Za-z_$][A-Za-z0-9_$]*$/;

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
    expandPrefixAgainstNamedArray(content, prefix, match[2] ?? "", keyMap);
  }
}

/**
 * Expands a template prefix only against the array literal the interpolated
 * variable plausibly comes from — `const tabs = [...]` for `${tab}`,
 * `const itemKeys = [...]` for `${item.key}`. Expanding against every array
 * in the file cross-contaminates unrelated option lists into the key set.
 */
function expandPrefixAgainstNamedArray(
  content: string,
  prefix: string,
  expression: string,
  keyMap: Map<string, string>
): void {
  const identifierMatch = LAST_IDENTIFIER_PATTERN.exec(expression);
  const identifier = identifierMatch?.[0];
  if (!identifier) return;

  for (const candidate of [identifier, `${identifier}s`]) {
    const declaration = new RegExp(
      `(?:const|let|var)\\s+${candidate}\\s*=\\s*\\[([^\\]]*)\\]`,
      "i"
    ).exec(content);
    if (!declaration || !declaration[1]) continue;

    ARRAY_ITEM_PATTERN.lastIndex = 0;
    let itemMatch: RegExpExecArray | null;
    while ((itemMatch = ARRAY_ITEM_PATTERN.exec(declaration[1])) !== null) {
      const id = itemMatch[1];
      if (!id) continue;
      if (IGNORED_LAYOUT_VALS.has(id.toLowerCase())) continue;
      if (PURE_NUMBER_PATTERN.test(id)) continue;
      addKey(keyMap, `${prefix}.${id}`);
    }
    return;
  }
}

function addKey(keyMap: Map<string, string>, key: string): void {
  if (!keyMap.has(key)) {
    keyMap.set(key, key);
  }
}
