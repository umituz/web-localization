/**
 * Path Traversal Guard
 * @description Asserts that a path resolves within a project root. Prevents
 * directory traversal attacks (e.g., `../../../etc/passwd`).
 *
 * Uses `path.resolve` to canonicalize both the input and root, then checks
 * that the resolved input is either the root itself OR starts with the root
 * + path separator.
 *
 * @throws PathTraversalError if the path escapes the project root.
 */
import * as path from "path";
import { PathTraversalError } from "../../core/errors";

export interface PathTraversalCheckInput {
  readonly requestedPath: string;
  readonly projectRoot: string;
}

export function assertPathWithinProjectRoot(input: PathTraversalCheckInput): string {
  const absolutePath = path.resolve(input.projectRoot, input.requestedPath);
  const normalizedAbsolute = path.resolve(absolutePath);
  const normalizedRoot = path.resolve(input.projectRoot);

  const rootWithSeparator = normalizedRoot.endsWith(path.sep)
    ? normalizedRoot
    : `${normalizedRoot}${path.sep}`;

  const isRoot = normalizedAbsolute === normalizedRoot;
  const isInsideRoot = normalizedAbsolute.startsWith(rootWithSeparator);

  if (!isRoot && !isInsideRoot) {
    throw new PathTraversalError(input.requestedPath, input.projectRoot);
  }

  return normalizedAbsolute;
}
