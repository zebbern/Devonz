const fs = require('node:fs');
const fastGlob = require('fast-glob');

const { globSync } = fastGlob;
const files = globSync('app/**/*.{ts,tsx}');
let changedCount = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Fix Message -> UIMessage
  content = content.replace(/import\s+(type\s+)?{([^}]*)\bMessage\b([^}]*)}\s+from\s+['"]ai['"]/g, (match, typeKw, before, after) => {
    let inner = (before + 'UIMessage as Message' + after).trim();
    // clean up double commas if any
    inner = inner.replace(/,\s*,/g, ',');
    return `import ${typeKw || ''}{ ${inner} } from 'ai'`;
  });

  content = content.replace(/LanguageModelV1/g, 'LanguageModel');
  content = content.replace(/LanguageModelV2Usage/g, 'LanguageModelUsage');

  if (content !== original) {
    fs.writeFileSync(file, content);
    changedCount++;
  }
}

console.log('Changed', changedCount, 'files');
