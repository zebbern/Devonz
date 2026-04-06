// Browser-compatible path utilities
import type { ParsedPath } from 'node:path';
import nodePath from 'node:path';

const isServer = typeof window === 'undefined';

/**
 * A browser-compatible path utility that mimics Node's path module.
 * Uses native node:path on the server and path-browserify (via dynamic import) in the browser.
 */
let browserPath: any = null;

// Only attempt to load path-browserify on the client
if (!isServer) {
  import('path-browserify').then((mod) => {
    browserPath = mod.default;
  });
}

export const path = {
  join: (...paths: string[]): string =>
    isServer ? nodePath.join(...paths) : browserPath?.join(...paths) || paths.join('/'),
  dirname: (p: string): string =>
    isServer ? nodePath.dirname(p) : browserPath?.dirname(p) || p.split('/').slice(0, -1).join('/'),
  basename: (p: string, ext?: string): string =>
    isServer ? nodePath.basename(p, ext) : browserPath?.basename(p, ext) || p.split('/').pop() || '',
  extname: (p: string): string =>
    isServer ? nodePath.extname(p) : browserPath?.extname(p) || (p.includes('.') ? '.' + p.split('.').pop() : ''),
  relative: (from: string, to: string): string =>
    isServer ? nodePath.relative(from, to) : browserPath?.relative(from, to) || to,
  isAbsolute: (p: string): boolean =>
    isServer ? nodePath.isAbsolute(p) : browserPath?.isAbsolute(p) || p.startsWith('/'),
  normalize: (p: string): string => (isServer ? nodePath.normalize(p) : browserPath?.normalize(p) || p),
  parse: (p: string): ParsedPath => (isServer ? nodePath.parse(p) : browserPath?.parse(p) || ({} as ParsedPath)),
  format: (pathObject: ParsedPath): string =>
    isServer ? nodePath.format(pathObject) : browserPath?.format(pathObject) || '',
} as const;

/**
 * Convert a file/folder path to a path relative to a base directory.
 *
 * Paths coming from the AI message parser are typically already relative
 * (e.g. `src/App.tsx`).  `path.relative('/home/project', 'src/App.tsx')`
 * produces `../../src/App.tsx` — a traversal path the server rejects.
 *
 * This helper handles three path forms:
 *   1. Absolute with baseDir prefix (`/home/project/src/App.tsx`) → `path.relative()`
 *   2. Already relative (`src/App.tsx`) → returned as-is
 *   3. Absolute WITHOUT baseDir prefix (`/src/App.tsx`) → strip leading slashes
 *      This third case occurs when replaying old chat history that stored
 *      absolute paths before the path-normalization fix was applied.
 */
export function toRelativePath(baseDir: string, filePath: string): string {
  if (filePath.startsWith(baseDir)) {
    return path.relative(baseDir, filePath);
  }

  /*
   * Strip leading slashes from absolute paths that don't belong to baseDir.
   * e.g. "/src/app/app.component.css" → "src/app/app.component.css"
   */
  if (filePath.startsWith('/')) {
    return filePath.replace(/^\/+/, '');
  }

  return filePath;
}
