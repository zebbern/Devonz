const fs = require('node:fs');
const fastGlob = require('fast-glob');

const { globSync } = fastGlob;
const files = globSync('app/**/*.{ts,tsx}');
let changedCount = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Let's restore `import type { CoreMessage as Message } from 'ai'` -> `import type { Message } from 'ai'`
  // `ai` v5 still exports `Message`, which is highly generic but compatible with Remix / UIs.
  content = content.replace(/import\s+(type\s+)?{([^}]*)\bCoreMessage\s+as\s+Message\b([^}]*)}\s+from\s+['"]ai['"]/g, (match, typeKw, before, after) => {
    let inner = (before + 'Message' + after).trim();
    inner = inner.replace(/,\s*,/g, ',');
    return `import ${typeKw || ''}{ ${inner} } from 'ai'`;
  });

  if (content !== original) {
    fs.writeFileSync(file, content);
    changedCount++;
  }
}

console.log('Changed', changedCount, 'files');
