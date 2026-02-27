/**
 * Final AI SDK 5 Migration patches targeting ModelMessage vs Message array mappings,
 * and Stream text API adjustments.
 */
const fs = require('node:fs');
const fastGlob = require('fast-glob');

const { globSync } = fastGlob;
const files = globSync('app/**/*.{ts,tsx}');
let changedCount = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Fix UIMessage mismatch inside Chat components and Git components
  content = content.replace(/import\s+(type\s+)?{([^}]*)\bMessage\b([^}]*)}\s+from\s+['"]ai['"]/g, (match, typeKw, before, after) => {
    // If it's a UI file, UIMessage from ai/react is what `Message` used to be.
    // Actually, in `ai` v5, it's `import { Message } from '@ai-sdk/react'`
    // But it's easier to just use `import { type UIMessage as Message } from 'ai'`
    // But wait, the previous log said: '"ai" has no exported member named 'Message'. Did you mean 'UIMessage'?' for UI files!
    // So 'ai' DOES NOT export `Message` anymore. It exports `UIMessage`.
    let inner = (before + 'UIMessage as Message' + after).trim();
    inner = inner.replace(/,\s*,/g, ',');
    return `import ${typeKw || ''}{ ${inner} } from 'ai'`;
  });

  // `parameters` on tools
  content = content.replace(/parameters:\s*tool\.parameters,/g, '/* parameters removed */');

  if (content !== original) {
    fs.writeFileSync(file, content);
    changedCount++;
  }
}

console.log('Changed', changedCount, 'files');
