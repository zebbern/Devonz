import fs from 'node:fs';
import { globSync } from 'fast-glob';

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

  // Also catch 'import type { Message, ... } from "ai"'
  content = content.replace(/LanguageModelV1/g, 'LanguageModel');
  content = content.replace(/LanguageModelV2Usage/g, 'LanguageModelUsage');

  // Fix DataStreamWriter, it must be imported from '@ai-sdk/ui-utils' or isn't used as such
  // ACTUALLY streamText/createDataStream don't export DataStreamWriter in 'ai' anymore.
  // We'll replace DataStreamWriter with `any` for now and manually patch the orchestration services, but let's try to just do simple replacements.

  if (content !== original) {
    fs.writeFileSync(file, content);
    changedCount++;
  }
}

console.log('Changed', changedCount, 'files');
