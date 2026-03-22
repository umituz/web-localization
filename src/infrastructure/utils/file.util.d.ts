/**
 * Parses a TypeScript file containing an object export
 * @description Simplistic parser for 'export default { ... }' or 'export const data = { ... }'
 */
export declare function parseTypeScriptFile(filePath: string): Record<string, unknown>;
/**
 * Generates a TypeScript file content from an object
 */
export declare function generateTypeScriptContent(obj: Record<string, unknown>, langCode?: string): string;
//# sourceMappingURL=file.util.d.ts.map