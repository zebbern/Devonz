const fs = require('node:fs');
const fastGlob = require('fast-glob');

const { globSync } = fastGlob;
const files = globSync('app/**/*.{ts,tsx}');
let changedCount = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Let's completely undo our generic `import { Message } from 'ai'` renaming to `UIMessage` or `CoreMessage`.
  // The Vercel AI SDK still exports `Message`, which we'll use straight to avoid the infinite loop of typing errors.
  content = content.replace(/import\s+(type\s+)?{([^}]*)\bUIMessage\s+as\s+Message\b([^}]*)}\s+from\s+['"]ai['"]/g, (match, typeKw, before, after) => {
    let inner = (before + 'Message' + after).trim();
    inner = inner.replace(/,\s*,/g, ',');
    return `import ${typeKw || ''}{ ${inner} } from 'ai'`;
  });

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
