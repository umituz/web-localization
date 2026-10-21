import * as fs from "fs";
import * as path from "path";
import { CACHE } from "../../core/constants";
import { LRUCache } from "../../core/utils/lru-cache";
import { LocaleParseError } from "../../core/errors";
import { assertPathWithinProjectRoot } from "../../application/validations/path-traversal-guard";
import { assertFileSizeWithinBound } from "../../application/validations/file-size-bound";
import { isLocaleFilename } from "../../application/validations/locale-filename-shape";

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

  async write(filePath: string, object: Record<string, unknown>, langCode: string): Promise<void> {
    const absolutePath = assertPathWithinProjectRoot({
      requestedPath: filePath,
      projectRoot: this.projectRoot,
    });

    const dir = path.dirname(absolutePath);
    await fs.promises.mkdir(dir, { recursive: true });

    const content = serializeLocaleObject(object, langCode);
    await fs.promises.writeFile(absolutePath, content, "utf-8");

    this.objectCache.delete(absolutePath);
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
    return entries
      .filter((f) => isLocaleFilename(f))
      .map((f) => path.basename(f, ".ts"))
      .sort();
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
  const defaultMatch = /export\s+default\s+(\{[\s\S]*\})\s*;?\s*$/.exec(source);
  if (defaultMatch && defaultMatch[1]) {
    return defaultMatch[1];
  }

  const namedMatch = /export\s+const\s+\w+\s*=\s*(\{[\s\S]*\})\s*;?\s*$/.exec(source);
  if (namedMatch && namedMatch[1]) {
    return namedMatch[1];
  }

  throw new ParseFailure(0, "no exported object literal found in source");
}

function parseLocaleObject(source: string): Record<string, unknown> {
  const objectLiteral = extractObjectLiteral(source);
  const parser = new ObjectLiteralParser(objectLiteral);
  const result = parser.parse();
  return result;
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
      this.expect(":");
      this.skipWhitespace();
      const value = this.parseValue();
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
    throw this.error(`Unexpected character '${ch}' while parsing value`);
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
    while (this.pos < this.source.length && /[0-9.eE+-]/.test(this.source[this.pos])) {
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
    while (this.pos < this.source.length && /[A-Za-z0-9_$]/.test(this.source[this.pos])) {
      this.pos++;
    }
    return this.source.slice(start, this.pos);
  }

  private skipWhitespace(): void {
    while (this.pos < this.source.length && /\s/.test(this.source[this.pos])) {
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
