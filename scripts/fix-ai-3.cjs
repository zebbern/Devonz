const fs = require('node:fs');
const fastGlob = require('fast-glob');

const { globSync } = fastGlob;
const files = globSync('app/**/*.{ts,tsx}');
let changedCount = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // We should revert UIMessage to just Message or CoreMessage where applicable.
  // We'll replace UIMessage as Message back to Message for imports.
  // Vercel AI SDK v5 still exports Message (which is typically CoreMessage in streamText context and UIMessage in useChat context).
  content = content.replace(/import\s+(type\s+)?{([^}]*)\bUIMessage\s+as\s+Message\b([^}]*)}\s+from\s+['"]ai['"]/g, (match, typeKw, before, after) => {
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
