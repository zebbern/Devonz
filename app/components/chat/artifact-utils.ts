/**
 * Utility functions for the Artifact component
 * - Diff stats calculation
 * - File type icon mapping
 * - Syntax highlighting language detection
 */

/**
 * Calculate the number of lines added and removed between two strings
 */
export function calculateDiffStats(
    originalContent: string | null,
    newContent: string,
): { linesAdded: number; linesRemoved: number } {
    if (originalContent === null) {
        // New file - all lines are additions
        return { linesAdded: newContent.split('\n').length, linesRemoved: 0 };
    }

    const originalLines = originalContent.split('\n');
    const newLines = newContent.split('\n');

    /*
     * Simple diff calculation: compare line counts and estimate changes.
     * For a more accurate diff, we'd use a proper diff algorithm.
     */
    const originalSet = new Set(originalLines);
    const newSet = new Set(newLines);

    let linesAdded = 0;
    let linesRemoved = 0;

    // Count lines in new that aren't in original (added)
    for (const line of newLines) {
        if (!originalSet.has(line)) {
            linesAdded++;
        }
    }

    // Count lines in original that aren't in new (removed)
    for (const line of originalLines) {
        if (!newSet.has(line)) {
            linesRemoved++;
        }
    }

    return { linesAdded, linesRemoved };
}

/**
 * Get the appropriate icon class for a file based on its extension
 */
export function getFileTypeIcon(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase() || '';
    const fileName = filePath.split('/').pop()?.toLowerCase() || '';

    // Check for specific file names first
    if (fileName === 'package.json' || fileName === 'package-lock.json' || fileName === 'pnpm-lock.yaml') {
        return 'i-ph:package';
    }

    if (fileName === 'tsconfig.json' || fileName === 'jsconfig.json') {
        return 'i-ph:gear';
    }

    if (fileName === '.gitignore' || fileName === '.env' || fileName.startsWith('.')) {
        return 'i-ph:gear';
    }

    if (fileName === 'dockerfile' || fileName === 'docker-compose.yml' || fileName === 'docker-compose.yaml') {
        return 'i-ph:cube';
    }

    // Check by extension
    switch (extension) {
        // React/JSX
        case 'tsx':
        case 'jsx':
            return 'i-ph:atom';

        // TypeScript/JavaScript
        case 'ts':
        case 'mts':
        case 'cts':
            return 'i-ph:file-ts';
        case 'js':
        case 'mjs':
        case 'cjs':
            return 'i-ph:file-js';

        // Styles
        case 'css':
            return 'i-ph:file-css';
        case 'scss':
        case 'sass':
        case 'less':
            return 'i-ph:paint-brush';

        // Markup
        case 'html':
        case 'htm':
            return 'i-ph:file-html';
        case 'xml':
        case 'svg':
            return 'i-ph:code';

        // Data/Config
        case 'json':
            return 'i-ph:brackets-curly';
        case 'yaml':
        case 'yml':
            return 'i-ph:list-dashes';
        case 'toml':
            return 'i-ph:sliders';

        // Documentation
        case 'md':
        case 'mdx':
            return 'i-ph:markdown-logo';
        case 'txt':
            return 'i-ph:file-text';

        // Images
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
        case 'webp':
        case 'ico':
            return 'i-ph:image';

        // Fonts
        case 'woff':
        case 'woff2':
        case 'ttf':
        case 'otf':
        case 'eot':
            return 'i-ph:text-aa';

        // Python
        case 'py':
            return 'i-ph:file-py';

        // Other languages
        case 'rs':
            return 'i-ph:gear-six';
        case 'go':
            return 'i-ph:code';
        case 'rb':
            return 'i-ph:diamond';
        case 'php':
            return 'i-ph:code';
        case 'java':
            return 'i-ph:coffee';
        case 'c':
        case 'cpp':
        case 'h':
        case 'hpp':
            return 'i-ph:code';

        // Shell/Scripts
        case 'sh':
        case 'bash':
        case 'zsh':
            return 'i-ph:terminal';
        case 'bat':
        case 'cmd':
        case 'ps1':
            return 'i-ph:terminal-window';

        // Lock files
        case 'lock':
            return 'i-ph:lock-simple';

        // Default
        default:
            return 'i-ph:file';
    }
}

/**
 * Get the icon color based on file type (for visual distinction)
 */
export function getFileTypeIconColor(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase() || '';

    switch (extension) {
        case 'tsx':
        case 'jsx':
            return 'text-cyan-400';
        case 'ts':
        case 'mts':
        case 'cts':
            return 'text-blue-400';
        case 'js':
        case 'mjs':
        case 'cjs':
            return 'text-yellow-400';
        case 'css':
        case 'scss':
        case 'sass':
        case 'less':
            return 'text-pink-400';
        case 'html':
        case 'htm':
            return 'text-orange-400';
        case 'json':
        case 'yaml':
        case 'yml':
            return 'text-green-400';
        case 'md':
        case 'mdx':
            return 'text-white/70';
        case 'py':
            return 'text-yellow-300';
        default:
            return 'text-white/50';
    }
}

/**
 * Get the language for syntax highlighting based on file extension
 */
export function getSyntaxLanguage(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase() || '';

    switch (extension) {
        case 'tsx':
            return 'tsx';
        case 'jsx':
            return 'jsx';
        case 'ts':
        case 'mts':
        case 'cts':
            return 'typescript';
        case 'js':
        case 'mjs':
        case 'cjs':
            return 'javascript';
        case 'css':
            return 'css';
        case 'scss':
        case 'sass':
            return 'scss';
        case 'html':
        case 'htm':
            return 'html';
        case 'json':
            return 'json';
        case 'yaml':
        case 'yml':
            return 'yaml';
        case 'md':
        case 'mdx':
            return 'markdown';
        case 'py':
            return 'python';
        case 'sh':
        case 'bash':
        case 'zsh':
            return 'shell';
        default:
            return 'plaintext';
    }
}

/**
 * Truncate file path for display, keeping the filename visible
 */
export function truncateFilePath(filePath: string, maxLength: number = 40): string {
    // Remove leading WORK_DIR if present
    const cleanPath = filePath.replace(/^\/home\/project\//, '');

    if (cleanPath.length <= maxLength) {
        return cleanPath;
    }

    const parts = cleanPath.split('/');
    const fileName = parts.pop() || '';

    if (fileName.length >= maxLength - 3) {
        return '...' + fileName.slice(-(maxLength - 3));
    }

    const remainingLength = maxLength - fileName.length - 4; // 4 for ".../"

    let pathPart = parts.join('/');

    if (pathPart.length > remainingLength) {
        pathPart = '...' + pathPart.slice(-remainingLength);
    }

    return pathPart + '/' + fileName;
}
