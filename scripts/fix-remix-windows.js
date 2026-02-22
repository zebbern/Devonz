/**
 * Windows ESM Compatibility Patches (postinstall)
 *
 * On Windows + Node.js v22+, two ESM import issues arise:
 *
 * 1. unconfig@7.0.0 passes bare Windows paths (C:\...) to import()
 *    when process.features.typescript is set (Node v22's TS stripping).
 *    The ESM loader parses 'C:' as an unsupported URL scheme.
 *    Fix: wrap the import() with pathToFileURL().
 *
 * 2. @remix-run/dev resolve-file-url.js returns /@fs/ paths for
 *    out-of-root Windows files. These can also cause scheme errors.
 *    Fix: return file:/// URLs for Windows absolute paths.
 *
 * Run automatically via "postinstall" in package.json.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

// Resolve the real .pnpm store path for unconfig
function findUnconfigIndex() {
  const candidates = [
    // Direct node_modules
    path.join(rootDir, 'node_modules', 'unconfig', 'dist', 'index.mjs'),
  ];

  // Also try to find via pnpm store
  const pnpmDir = path.join(rootDir, 'node_modules', '.pnpm');
  if (fs.existsSync(pnpmDir)) {
    try {
      const dirs = fs.readdirSync(pnpmDir).filter(d => d.startsWith('unconfig@'));
      for (const dir of dirs) {
        candidates.push(
          path.join(pnpmDir, dir, 'node_modules', 'unconfig', 'dist', 'index.mjs')
        );
      }
    } catch {}
  }

  return candidates.filter(p => fs.existsSync(p));
}

// ─── Patch 1: unconfig — pathToFileURL for Windows ──────────────────────────

function patchUnconfig() {
  const files = findUnconfigIndex();
  if (files.length === 0) {
    console.warn('[fix-windows] Could not find unconfig/dist/index.mjs — skipping.');
    return;
  }

  for (const filePath of files) {
    let content = fs.readFileSync(filePath, 'utf8');

    if (content.includes('pathToFileURL(bundleFilepath)')) {
      console.log(`[fix-windows] ${path.relative(rootDir, filePath)} already patched.`);
      continue;
    }

    const target = 'const defaultImport = await import(bundleFilepath);';
    const replacement =
      "const { pathToFileURL } = await import('node:url');\n" +
      '          const defaultImport = await import(pathToFileURL(bundleFilepath).href);';

    const patched = content.replace(target, replacement);
    if (patched === content) {
      console.error(`[fix-windows] ${path.relative(rootDir, filePath)}: target not found — skipped.`);
      continue;
    }

    fs.writeFileSync(filePath, patched);
    console.log(`[fix-windows] Patched ${path.relative(rootDir, filePath)}`);
  }
}

// ─── Patch 2: @remix-run/dev resolve-file-url.js ────────────────────────────

function patchResolveFileUrl() {
  const resolveFileUrlPath = path.join(
    rootDir, 'node_modules', '@remix-run', 'dev', 'dist', 'vite', 'resolve-file-url.js'
  );

  if (!fs.existsSync(resolveFileUrlPath)) {
    console.warn('[fix-windows] Could not find resolve-file-url.js — skipping.');
    return;
  }

  let content = fs.readFileSync(resolveFileUrlPath, 'utf8');

  if (content.includes("process.platform === 'win32'")) {
    console.log('[fix-windows] resolve-file-url.js already patched.');
    return;
  }

  const target = 'return path__namespace.posix.join("/@fs", vite$1.normalizePath(filePath));';
  const replacement = `
    let normalizedPath = vite$1.normalizePath(filePath);
    if (process.platform === 'win32' && /^[a-zA-Z]:/.test(normalizedPath)) {
      return 'file:///' + normalizedPath;
    }
    return path__namespace.posix.join("/@fs", normalizedPath);
  `;

  const patched = content.replace(target, replacement);
  if (patched === content) {
    console.error('[fix-windows] resolve-file-url.js: target not found — skipped.');
    return;
  }

  fs.writeFileSync(resolveFileUrlPath, patched);
  console.log('[fix-windows] Patched resolve-file-url.js');
}

// ─── Run all patches ──────────────────────────────────────────────────────

console.log('[fix-windows] Applying Windows ESM compatibility patches...');
patchUnconfig();
patchResolveFileUrl();
console.log('[fix-windows] Done.');
