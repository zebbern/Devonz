const fs = require('node:fs');
const fastGlob = require('fast-glob');

const { globSync } = fastGlob;
const files = globSync('app/**/*.{ts,tsx}');
let changedCount = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Let's restore the UIMessage as Message renaming.
  // BUT only where it makes sense. The issue is `create-summary` and `select-context` which are backend server flows using `CoreMessage` but were importing `Message` and interpreting it as the React `UIMessage`.

  content = content.replace(/import\s+(type\s+)?{([^}]*)\bMessage\b([^}]*)}\s+from\s+['"]ai['"]/g, (match, typeKw, before, after) => {
    // If it's a server file (like .server/llm/create-summary.ts), use CoreMessage
    if (file.includes('.server') || file.includes('app/lib/modules/llm') || file.includes('app/lib/services/contextService.ts') || file.includes('app/lib/services/agentChatIntegration.ts') || file.includes('app/lib/persistence')) {
      let inner = (before + 'CoreMessage as Message' + after).trim();
      inner = inner.replace(/,\s*,/g, ',');
      return `import ${typeKw || ''}{ ${inner} } from 'ai'`;
    }
    // If it's a UI file, use UIMessage
    let inner = (before + 'UIMessage as Message' + after).trim();
    inner = inner.replace(/,\s*,/g, ',');
    return `import ${typeKw || ''}{ ${inner} } from 'ai'`;
  });

  // Fix `createDataStream` in api.chat.ts and api.agent.chat.ts.
  // In v5, standard Data streams use `createDataStreamResponse`
  // but Remix might need custom handling.

  if (content !== original) {
    fs.writeFileSync(file, content);
    changedCount++;
  }
}

console.log('Changed', changedCount, 'files');
