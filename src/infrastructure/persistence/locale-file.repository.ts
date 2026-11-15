import * as fs from "fs";
import * as path from "path";
import { CACHE, LOCALE } from "../../core/constants";
import { LRUCache } from "../../core/utils/lru-cache";
import { LocaleParseError } from "../../core/errors";
import { assertPathWithinProjectRoot } from "../../application/validations/path-traversal-guard";
import { assertFileSizeWithinBound } from "../../application/validations/file-size-bound";
import { isLocaleFilename } from "../../application/validations/locale-filename-shape";
import {
  isInterpolatedTemplate,
  isOpaqueExpression,
  opaqueExpression,
  opaqueExpressionSource,
} from "../../application/services/opaque-expression";

interface FileCacheEntry {
  readonly value: {
    readonly object: Record<string, unknown>;
    readonly rawContent: string;
  };
  readonly expiresAt: number;
}

export interface LocaleFileRepositoryOptions {
  readonly projectRoot: string;
  readonly maxFileSizeBytes?: number;
  readonly cacheTtlMs?: number;
}

export interface LocaleWriteOutcome {
  /**
   * Domain files created while writing a directory locale layout — these
   * still need an import + spread in the language's index.ts barrel.
   */
  readonly createdFiles: readonly string[];
}

export class LocaleFileRepository {
  private readonly projectRoot: string;
  private readonly maxFileSizeBytes: number;
  private readonly cacheTtlMs: number;
  private readonly objectCache = new LRUCache<string, FileCacheEntry>(200);

  constructor(options: LocaleFileRepositoryOptions) {
    this.projectRoot = path.resolve(options.projectRoot);
    this.maxFileSizeBytes = options.maxFileSizeBytes ?? CACHE.FILE_MAX_SIZE;
    this.cacheTtlMs = options.cacheTtlMs ?? 5 * 60 * 1000;
  }

  get root(): string {
    return this.projectRoot;
  }

  async read(filePath: string): Promise<Record<string, unknown> | null> {
    const absolutePath = assertPathWithinProjectRoot({
      requestedPath: filePath,
      projectRoot: this.projectRoot,
    });

    const cached = this.objectCache.get(absolutePath);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.value.object;
    }

    if (!fs.existsSync(absolutePath)) {
      return null;
    }

    const stats = await fs.promises.stat(absolutePath);
    if (stats.isDirectory()) {
      return this.readLocaleDirectory(absolutePath);
    }

    assertFileSizeWithinBound({
      filePath,
      actualSizeBytes: stats.size,
      maxSizeBytes: this.maxFileSizeBytes,
    });

    const content = await fs.promises.readFile(absolutePath, "utf-8");
    let object: Record<string, unknown>;
    try {
      object = parseLocaleObject(content);
    } catch (error) {
      if (error instanceof ParseFailure) {
        throw new LocaleParseError(filePath, error.position, error.reason);
      }
      throw error;
    }

    this.objectCache.set(absolutePath, {
      value: { object, rawContent: content },
      expiresAt: Date.now() + this.cacheTtlMs,
    });

    return object;
  }

  async write(
    filePath: string,
    object: Record<string, unknown>,
    langCode: string
  ): Promise<LocaleWriteOutcome> {
    const absolutePath = assertPathWithinProjectRoot({
      requestedPath: filePath,
      projectRoot: this.projectRoot,
    });

    if (fs.existsSync(absolutePath)) {
      const stats = await fs.promises.stat(absolutePath);
      if (stats.isDirectory()) {
        return this.writeLocaleDirectory(absolutePath, object);
      }
    }

    const dir = path.dirname(absolutePath);
    await fs.promises.mkdir(dir, { recursive: true });

    const content = serializeLocaleObject(object, langCode);
    await fs.promises.writeFile(absolutePath, content, "utf-8");

    this.objectCache.delete(absolutePath);
    return { createdFiles: [] };
  }

  /**
   * Resolves a language to its flat `<lang>.ts` file or its
   * `<lang>/` directory (domain-file layout). Falls back to the flat path
   * when neither exists so creation keeps the documented default.
   */
  resolveLocalePath(localesDir: string, langCode: string): string {
    const absoluteDir = assertPathWithinProjectRoot({
      requestedPath: localesDir,
      projectRoot: this.projectRoot,
    });

    const filePath = path.join(absoluteDir, `${langCode}.ts`);
    if (fs.existsSync(filePath)) {
      return filePath;
    }

    const dirPath = path.join(absoluteDir, langCode);
    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
      return dirPath;
    }

    return filePath;
  }

  private async readLocaleDirectory(dirPath: string): Promise<Record<string, unknown>> {
    const merged: Record<string, unknown> = {};
    for (const file of await this.listDomainFiles(dirPath)) {
      const object = await this.readDomainObject(path.join(dirPath, file));
      Object.assign(merged, object);
    }
    return merged;
  }

  private async writeLocaleDirectory(
    dirPath: string,
    object: Record<string, unknown>
  ): Promise<LocaleWriteOutcome> {
    const createdFiles: string[] = [];
    const homedKeys = new Set<string>();

    for (const file of await this.listDomainFiles(dirPath)) {
      const filePath = path.join(dirPath, file);
      const raw = await fs.promises.readFile(filePath, "utf-8");
      const location = locatePreambleSafeObjectLiteral(raw, filePath);
      const current = parseObjectLiteralOrThrow(location.literal, filePath);

      const next: Record<string, unknown> = {};
      for (const key of Object.keys(current)) {
        if (key in object) {
          next[key] = object[key];
          homedKeys.add(key);
        }
      }

      if (!deepEquals(next, current)) {
        await this.writeDomainFile(filePath, raw, next);
      }
      this.objectCache.delete(filePath);
    }

    for (const [key, value] of Object.entries(object)) {
      if (homedKeys.has(key)) continue;
      const filePath = path.join(dirPath, `${key}.ts`);
      if (fs.existsSync(filePath)) {
        const raw = await fs.promises.readFile(filePath, "utf-8");
        const location = locatePreambleSafeObjectLiteral(raw, filePath);
        const existing = parseObjectLiteralOrThrow(location.literal, filePath);
        await this.writeDomainFile(filePath, raw, { ...existing, [key]: value });
        continue;
      }
      await fs.promises.writeFile(filePath, serializeTypeScriptLocale({ [key]: value }), "utf-8");
      createdFiles.push(filePath);
    }

    return { createdFiles };
  }

  private async writeDomainFile(
    filePath: string,
    raw: string,
    next: Record<string, unknown>
  ): Promise<void> {
    const location = locatePreambleSafeObjectLiteral(raw, filePath);
    const preamble = raw.slice(0, location.startIndex);
    const separator = preamble.length === 0 || preamble.endsWith("\n") ? "" : "\n";
    await fs.promises.writeFile(
      filePath,
      `${preamble}${separator}export default ${stringifyTsValue(next, 0)}\n`,
      "utf-8"
    );
  }

  private async readDomainObject(filePath: string): Promise<Record<string, unknown>> {
    const stats = await fs.promises.stat(filePath);
    assertFileSizeWithinBound({
      filePath,
      actualSizeBytes: stats.size,
      maxSizeBytes: this.maxFileSizeBytes,
    });

    const content = await fs.promises.readFile(filePath, "utf-8");
    try {
      return parseLocaleObject(content);
    } catch (error) {
      if (error instanceof ParseFailure) {
        throw new LocaleParseError(filePath, error.position, error.reason);
      }
      throw error;
    }
  }

  private async listDomainFiles(dirPath: string): Promise<string[]> {
    const entries = await fs.promises.readdir(dirPath);
    return entries.filter((entry) => entry.endsWith(".ts") && entry !== "index.ts").sort();
  }

  async listLocales(localesDir: string): Promise<string[]> {
    const absoluteDir = assertPathWithinProjectRoot({
      requestedPath: localesDir,
      projectRoot: this.projectRoot,
    });

    if (!fs.existsSync(absoluteDir)) {
      return [];
    }

    const entries = await fs.promises.readdir(absoluteDir);
    const codes: string[] = [];

    for (const entry of entries) {
      if (isLocaleFilename(entry)) {
        codes.push(path.basename(entry, ".ts"));
        continue;
      }

      if (!LOCALE.LOCALE_DIR_PATTERN.test(entry)) continue;

      const entryPath = path.join(absoluteDir, entry);
      const stats = await fs.promises.stat(entryPath).catch(() => null);
      if (!stats?.isDirectory()) continue;

      const inner = await fs.promises.readdir(entryPath).catch(() => [] as string[]);
      if (inner.some((file) => file.endsWith(".ts"))) {
        codes.push(entry);
      }
    }

    return [...new Set(codes)].sort();
  }

  clearCache(): void {
    this.objectCache.clear();
  }
}

class ParseFailure extends Error {
  constructor(
    readonly position: number,
    readonly reason: string
  ) {
    super(`Locale parse error at position ${position}: ${reason}`);
    this.name = "ParseFailure";
  }
}

function extractObjectLiteral(source: string): string {
  return locateObjectLiteral(source).literal;
}

interface ObjectLiteralLocation {
  readonly literal: string;
  readonly startIndex: number;
}

function locateObjectLiteral(source: string): ObjectLiteralLocation {
  const defaultMatch = /export\s+default\s+(\{[\s\S]*\})\s*;?\s*$/.exec(source);
  if (defaultMatch && defaultMatch[1]) {
    return { literal: defaultMatch[1], startIndex: defaultMatch.index };
  }

  const namedMatch = /export\s+const\s+\w+\s*=\s*(\{[\s\S]*\})\s*;?\s*$/.exec(source);
  if (namedMatch && namedMatch[1]) {
    return { literal: namedMatch[1], startIndex: namedMatch.index };
  }

  const indirectMatch = /export\s+default\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*;?\s*$/.exec(source);
  if (indirectMatch && indirectMatch[1]) {
    const constMatch = new RegExp(
      `const\\s+${indirectMatch[1]}\\s*=\\s*(\\{[\\s\\S]*\\})`
    ).exec(source);
    if (constMatch && constMatch[1]) {
      return { literal: constMatch[1], startIndex: constMatch.index };
    }
  }

  throw new ParseFailure(0, "no exported object literal found in source");
}

function parseLocaleObject(source: string): Record<string, unknown> {
  const objectLiteral = extractObjectLiteral(source);
  const parser = new ObjectLiteralParser(objectLiteral);
  const result = parser.parse();
  return result;
}

function locatePreambleSafeObjectLiteral(
  source: string,
  filePath: string
): ObjectLiteralLocation {
  try {
    return locateObjectLiteral(source);
  } catch (error) {
    if (error instanceof ParseFailure) {
      throw new LocaleParseError(filePath, error.position, error.reason);
    }
    throw error;
  }
}

function parseObjectLiteralOrThrow(
  literal: string,
  filePath: string
): Record<string, unknown> {
  try {
    return new ObjectLiteralParser(literal).parse();
  } catch (error) {
    if (error instanceof ParseFailure) {
      throw new LocaleParseError(filePath, error.position, error.reason);
    }
    throw error;
  }
}

class ObjectLiteralParser {
  private pos = 0;

  constructor(private readonly source: string) {}

  parse(): Record<string, unknown> {
    this.skipWhitespace();
    const result = this.parseObject();
    this.skipWhitespace();
    if (!this.isAtEnd()) {
      throw this.error("unexpected content after object literal");
    }
    return result;
  }

  private parseObject(): Record<string, unknown> {
    this.expect("{");
    const result: Record<string, unknown> = {};

    this.skipWhitespace();
    if (this.peek() === "}") {
      this.pos++;
      return result;
    }

    for (;;) {
      this.skipWhitespace();
      const key = this.parseKey();
      this.skipWhitespace();
      let value: unknown;
      if (this.peek() === ":") {
        this.pos++;
        this.skipWhitespace();
        value = this.parseValue();
      } else {
        value = opaqueExpression(key);
      }
      result[key] = value;
      this.skipWhitespace();

      const next = this.peek();
      if (next === ",") {
        this.pos++;
        this.skipWhitespace();
        if (this.peek() === "}") break;
        continue;
      }
      if (next === "}") break;
      throw this.error(`Expected ',' or '}' after value, got '${next}'`);
    }

    this.expect("}");
    return result;
  }

  private parseKey(): string {
    this.skipWhitespace();
    const ch = this.peek();
    if (ch === '"' || ch === "'" || ch === "`") {
      return this.parseString();
    }
    return this.parseIdentifier();
  }

  private parseValue(): unknown {
    const start = this.pos;
    const value = this.parseBaseValue();
    this.skipWhitespace();

    if (this.peek() === "+") {
      return this.parseConcatenatedValue(start, value);
    }

    if (this.startsWithWord("as")) {
      this.pos += 2;
      this.skipBalancedSpan();
      return opaqueExpression(this.source.slice(start, this.pos).trim());
    }

    return value;
  }

  private parseBaseValue(): unknown {
    this.skipWhitespace();
    const ch = this.peek();
    if (ch === "{") return this.parseObject();
    if (ch === "[") return this.parseArray();
    if (ch === '"' || ch === "'" || ch === "`") return this.parseString();
    if (ch === "-" || (ch >= "0" && ch <= "9")) return this.parseNumber();
    if (this.startsWith("true")) {
      this.pos += 4;
      return true;
    }
    if (this.startsWith("false")) {
      this.pos += 5;
      return false;
    }
    if (this.startsWith("null")) {
      this.pos += 4;
      return null;
    }
    const memberExpression = this.tryParseMemberExpression();
    if (memberExpression !== null) {
      return opaqueExpression(memberExpression);
    }
    throw this.error(`Unexpected character '${ch}' while parsing value`);
  }

  private parseConcatenatedValue(start: number, first: unknown): unknown {
    let joined = first;
    while (this.peek() === "+") {
      this.pos++;
      this.skipWhitespace();
      const ch = this.peek();
      if (typeof joined === "string" && (ch === "'" || ch === '"' || ch === "`")) {
        joined = joined + this.parseString();
        this.skipWhitespace();
        continue;
      }
      this.skipBalancedSpan();
      return opaqueExpression(this.source.slice(start, this.pos).trim());
    }
    return joined;
  }

  private startsWithWord(word: string): boolean {
    if (!this.startsWith(word)) return false;
    const next = this.source[this.pos + word.length];
    return next === undefined || !/[A-Za-z0-9_$]/.test(next);
  }

  private skipBalancedSpan(): void {
    let angle = 0;
    let brace = 0;
    let bracket = 0;
    let paren = 0;
    while (this.pos < this.source.length) {
      const ch = this.source[this.pos];
      if (
        angle === 0 && brace === 0 && bracket === 0 && paren === 0 &&
        (ch === "," || ch === "}" || ch === "]")
      ) {
        break;
      }
      if (ch === "<") angle++;
      else if (ch === ">") angle = Math.max(0, angle - 1);
      else if (ch === "{") brace++;
      else if (ch === "}") brace = Math.max(0, brace - 1);
      else if (ch === "[") bracket++;
      else if (ch === "]") bracket = Math.max(0, bracket - 1);
      else if (ch === "(") paren++;
      else if (ch === ")") paren = Math.max(0, paren - 1);
      this.pos++;
    }
  }

  private parseArray(): unknown[] {
    this.expect("[");
    const result: unknown[] = [];
    this.skipWhitespace();
    if (this.peek() === "]") {
      this.pos++;
      return result;
    }
    for (;;) {
      this.skipWhitespace();
      result.push(this.parseValue());
      this.skipWhitespace();
      const next = this.peek();
      if (next === ",") {
        this.pos++;
        this.skipWhitespace();
        if (this.peek() === "]") break;
        continue;
      }
      if (next === "]") break;
      throw this.error(`Expected ',' or ']' in array, got '${next}'`);
    }
    this.expect("]");
    return result;
  }

  private parseString(): string {
    const quote = this.source[this.pos];
    this.pos++;
    let result = "";
    while (this.pos < this.source.length) {
      const ch = this.source[this.pos];
      if (ch === "\\") {
        this.pos++;
        const esc = this.source[this.pos];
        switch (esc) {
          case "n":
            result += "\n";
            break;
          case "t":
            result += "\t";
            break;
          case "r":
            result += "\r";
            break;
          case "\\":
            result += "\\";
            break;
          case "/":
            result += "/";
            break;
          case "'":
            result += "'";
            break;
          case '"':
            result += '"';
            break;
          case "`":
            result += "`";
            break;
          case "u": {
            this.pos++;
            const hex = this.source.slice(this.pos, this.pos + 4);
            result += String.fromCharCode(parseInt(hex, 16));
            this.pos += 3;
            break;
          }
          default:
            result += esc;
        }
        this.pos++;
        continue;
      }
      if (ch === quote) {
        this.pos++;
        return result;
      }
      result += ch;
      this.pos++;
    }
    throw this.error("Unterminated string literal");
  }

  private parseNumber(): number {
    const start = this.pos;
    if (this.peek() === "-") this.pos++;
    while (this.pos < this.source.length && /[0-9.eE+-]/.test(this.source[this.pos] ?? "")) {
      this.pos++;
    }
    const numStr = this.source.slice(start, this.pos);
    const num = Number(numStr);
    if (Number.isNaN(num)) {
      throw this.error(`Invalid number: ${numStr}`);
    }
    return num;
  }

  private parseIdentifier(): string {
    const start = this.pos;
    while (
      this.pos < this.source.length &&
      /[\p{L}\p{N}$_]/u.test(this.source[this.pos] ?? "")
    ) {
      this.pos++;
    }
    return this.source.slice(start, this.pos);
  }

  private tryParseMemberExpression(): string | null {
    const rest = this.source.slice(this.pos);
    const match =
      /^[A-Za-z$_\p{L}][A-Za-z0-9$_\p{L}\p{N}]*(?:\.[A-Za-z$_\p{L}][A-Za-z0-9$_\p{L}\p{N}]*)*/u.exec(
        rest
      );
    if (!match || match[0].length === 0) return null;
    this.pos += match[0].length;
    return match[0];
  }

  private skipWhitespace(): void {
    while (this.pos < this.source.length && /\s/.test(this.source[this.pos] ?? "")) {
      this.pos++;
    }
    if (this.source.slice(this.pos, this.pos + 2) === "//") {
      while (this.pos < this.source.length && this.source[this.pos] !== "\n") {
        this.pos++;
      }
      this.skipWhitespace();
    }
  }

  private peek(): string {
    return this.source[this.pos] ?? "";
  }

  private expect(str: string): void {
    if (!this.startsWith(str)) {
      throw this.error(`Expected '${str}'`);
    }
    this.pos += str.length;
  }

  private startsWith(str: string): boolean {
    return this.source.slice(this.pos, this.pos + str.length) === str;
  }

  private isAtEnd(): boolean {
    return this.pos >= this.source.length;
  }

  private error(message: string): ParseFailure {
    return new ParseFailure(this.pos, message);
  }
}

export function serializeLocaleObject(obj: Record<string, unknown>, langCode: string): string {
  const body = JSON.stringify(obj, null, 2);
  return [
    "/**",
    ` * Localization: ${langCode}`,
    " * Generated by @umituz/web-localization",
    " */",
    "",
    `export default ${body};`,
    "",
  ].join("\n");
}

const IDENTIFIER_KEY = /^[\p{L}$_][\p{L}\p{N}$_]*$/u;
const INTERPOLATION_SPLIT = /(\$\{[^}]*\})/g;
const INTERPOLATION_EXACT = /^\$\{([^}]*)\}$/;

/**
 * Serializes a locale object as idiomatic TypeScript for the directory
 * layout — single quotes, unquoted keys, trailing commas, template
 * literals for interpolated strings and verbatim opaque expressions.
 */
export function serializeTypeScriptLocale(obj: Record<string, unknown>): string {
  return `export default ${stringifyTsValue(obj, 0)}\n`;
}

function stringifyTsValue(value: unknown, indentLevel: number): string {
  if (typeof value === "string") return stringifyTsString(value);
  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stringifyTsValue(item, indentLevel)).join(", ")}]`;
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    if (keys.length === 0) return "{}";
    const pad = "  ".repeat(indentLevel + 1);
    const closePad = "  ".repeat(indentLevel);
    const lines = keys.map(
      (key) => `${pad}${stringifyTsKey(key)}: ${stringifyTsValue(value[key], indentLevel + 1)},`
    );
    return `{\n${lines.join("\n")}\n${closePad}}`;
  }
  return "null";
}

function stringifyTsKey(key: string): string {
  return IDENTIFIER_KEY.test(key) ? key : stringifyQuotedString(key);
}

function stringifyTsString(value: string): string {
  if (isOpaqueExpression(value)) return opaqueExpressionSource(value);
  if (isInterpolatedTemplate(value)) return stringifyTemplateString(value);
  return stringifyQuotedString(value);
}

function stringifyQuotedString(value: string): string {
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
  return `'${escaped}'`;
}

function stringifyTemplateString(value: string): string {
  const parts = value.split(INTERPOLATION_SPLIT);
  const body = parts
    .map((part) => {
      const interpolation = INTERPOLATION_EXACT.exec(part);
      if (interpolation) {
        const inner = (interpolation[1] ?? "").trim();
        return IDENTIFIER_KEY_WITH_DOTS.test(inner) ? part : part.replace("$", "\\$");
      }
      return part.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
    })
    .join("");
  return `\`${body}\``;
}

const IDENTIFIER_KEY_WITH_DOTS = /^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*)*$/;

function deepEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => deepEquals(item, b[index]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    return (
      aKeys.length === bKeys.length &&
      aKeys.every((key) => key in b && deepEquals(a[key], b[key]))
    );
  }
  return false;
}

export function syncObjectStructure(
  source: Record<string, unknown>,
  target: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...target };

  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (isPlainObject(sourceValue) && sourceValue !== null) {
      result[key] = syncObjectStructure(
        sourceValue as Record<string, unknown>,
        isPlainObject(targetValue) ? (targetValue as Record<string, unknown>) : {}
      );
    } else if (targetValue === undefined) {
      result[key] = typeof sourceValue === "string" ? "" : sourceValue;
    } else {
      result[key] = targetValue;
    }
  }

  for (const key of Object.keys(result)) {
    if (!(key in source)) {
      delete result[key];
    }
  }

  return result;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
