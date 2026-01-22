/**
 * Terminal Error Detector
 *
 * Detects actionable errors in terminal output and triggers alerts
 * so users can easily send errors to Bolt for fixing.
 */

import { workbenchStore } from '~/lib/stores/workbench';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('TerminalErrorDetector');

/**
 * Error pattern definition
 */
export interface ErrorPattern {
    /** Regex pattern to match */
    pattern: RegExp;

    /** Type of error for categorization */
    type: 'build' | 'runtime' | 'package' | 'syntax' | 'module';

    /** Error severity */
    severity: 'error' | 'warning';

    /** Human-readable title for the alert */
    title: string;

    /** Optional function to extract details from the match */
    extractDetails?: (match: RegExpMatchArray, fullOutput: string) => string;
}

/**
 * Detected error structure
 */
export interface DetectedError {
    type: ErrorPattern['type'];
    severity: ErrorPattern['severity'];
    title: string;
    message: string;
    details: string;
    timestamp: number;
    hash: string;
}

/**
 * Error patterns to detect in terminal output
 * Ordered by specificity - more specific patterns first
 */
const ERROR_PATTERNS: ErrorPattern[] = [
    // Vite specific errors
    {
        pattern: /\[vite\]\s*(?:Internal server error|Error):\s*(.+?)(?:\n|$)/i,
        type: 'build',
        severity: 'error',
        title: 'Vite Build Error',
        extractDetails: (match, fullOutput) => {
            // Try to extract more context around the error
            const errorIdx = fullOutput.indexOf(match[0]);
            const contextStart = Math.max(0, errorIdx - 100);
            const contextEnd = Math.min(fullOutput.length, errorIdx + match[0].length + 500);

            return fullOutput.slice(contextStart, contextEnd).trim();
        },
    },

    // Vite CSS/PostCSS plugin errors
    {
        pattern: /\[plugin:vite:css\].*?\[postcss\]\s*(.+?)(?:\n|$)/i,
        type: 'build',
        severity: 'error',
        title: 'CSS/PostCSS Error',
        extractDetails: (match, fullOutput) => {
            const errorIdx = fullOutput.indexOf(match[0]);
            const contextEnd = Math.min(fullOutput.length, errorIdx + 800);

            return fullOutput.slice(errorIdx, contextEnd).trim();
        },
    },
    {
        pattern: /\[plugin:vite:[^\]]+\]\s*(.+?)(?:\n|$)/i,
        type: 'build',
        severity: 'error',
        title: 'Vite Plugin Error',
        extractDetails: (match, fullOutput) => {
            const errorIdx = fullOutput.indexOf(match[0]);
            const contextEnd = Math.min(fullOutput.length, errorIdx + 600);

            return fullOutput.slice(errorIdx, contextEnd).trim();
        },
    },

    // Tailwind CSS errors
    {
        pattern: /The [`'](.+?)[`']\s*class does not exist/i,
        type: 'build',
        severity: 'error',
        title: 'Tailwind CSS Error',
        extractDetails: (match) =>
            `The class "${match[1]}" does not exist. Make sure it is defined in your Tailwind config or use a valid utility class.`,
    },
    {
        pattern: /CssSyntaxError:\s*(.+?)(?:\n|$)/i,
        type: 'syntax',
        severity: 'error',
        title: 'CSS Syntax Error',
    },
    {
        pattern: /Failed to resolve import ["'](.+?)["'].*?from ["'](.+?)["']/i,
        type: 'module',
        severity: 'error',
        title: 'Import Resolution Failed',
        extractDetails: (match) => `Cannot resolve import "${match[1]}" from "${match[2]}"`,
    },
    {
        pattern: /Module not found:\s*(?:Error:\s*)?(?:Can't resolve\s*)?["']?(.+?)["']?(?:\s+in\s+["']?(.+?)["']?)?/i,
        type: 'module',
        severity: 'error',
        title: 'Module Not Found',
    },
    {
        pattern: /Cannot find module ["'](.+?)["']/i,
        type: 'module',
        severity: 'error',
        title: 'Module Not Found',
        extractDetails: (match) => `Cannot find module "${match[1]}"`,
    },

    // TypeScript errors
    {
        pattern: /error TS(\d+):\s*(.+?)(?:\n|$)/i,
        type: 'syntax',
        severity: 'error',
        title: 'TypeScript Error',
        extractDetails: (match) => `TS${match[1]}: ${match[2]}`,
    },
    {
        pattern: /Type\s+["'](.+?)["']\s+is not assignable to type\s+["'](.+?)["']/i,
        type: 'syntax',
        severity: 'error',
        title: 'TypeScript Type Error',
    },

    // JavaScript runtime errors
    {
        pattern: /SyntaxError:\s*(.+?)(?:\n|$)/i,
        type: 'syntax',
        severity: 'error',
        title: 'Syntax Error',
        extractDetails: (match) => match[1],
    },
    {
        pattern: /TypeError:\s*(.+?)(?:\n|$)/i,
        type: 'runtime',
        severity: 'error',
        title: 'Type Error',
        extractDetails: (match) => match[1],
    },
    {
        pattern: /ReferenceError:\s*(.+?)(?:\n|$)/i,
        type: 'runtime',
        severity: 'error',
        title: 'Reference Error',
        extractDetails: (match) => match[1],
    },

    // Package manager errors
    {
        pattern: /npm ERR!\s*(.+?)(?:\n|$)/i,
        type: 'package',
        severity: 'error',
        title: 'npm Error',
        extractDetails: (match, fullOutput) => {
            // Get more npm error context
            const lines = fullOutput.split('\n');
            const errorLines = lines.filter((line) => line.includes('npm ERR!'));

            return errorLines.slice(0, 10).join('\n');
        },
    },
    {
        pattern: /pnpm ERR!\s*(.+?)(?:\n|$)/i,
        type: 'package',
        severity: 'error',
        title: 'pnpm Error',
    },
    {
        pattern: /ENOENT:\s*no such file or directory[,\s]*(?:open\s*)?["']?(.+?)["']?/i,
        type: 'build',
        severity: 'error',
        title: 'File Not Found',
        extractDetails: (match) => `File not found: ${match[1]}`,
    },

    // ESLint errors (but not warnings)
    {
        pattern: /✖\s*(\d+)\s+(?:error|problem)s?/i,
        type: 'syntax',
        severity: 'error',
        title: 'ESLint Errors',
        extractDetails: (match) => `${match[1]} ESLint error(s) found`,
    },

    // General build failures
    {
        pattern: /Build failed with (\d+) errors?/i,
        type: 'build',
        severity: 'error',
        title: 'Build Failed',
        extractDetails: (match) => `Build failed with ${match[1]} error(s)`,
    },
    {
        pattern: /error\s+during\s+build/i,
        type: 'build',
        severity: 'error',
        title: 'Build Error',
    },

    // Port in use
    {
        pattern: /Port\s+(\d+)\s+is\s+(?:already\s+)?in\s+use/i,
        type: 'runtime',
        severity: 'error',
        title: 'Port In Use',
        extractDetails: (match) => `Port ${match[1]} is already in use`,
    },
];

/**
 * Patterns to ignore (false positives)
 */
const IGNORE_PATTERNS: RegExp[] = [
    // Ignore deprecation warnings
    /deprecat(?:ed|ion)/i,

    // Ignore peer dependency warnings
    /peer\s+dep/i,

    // Ignore warnings about optional dependencies
    /optional\s+dependency/i,

    // Ignore info/debug messages that look like errors
    /\[INFO\]/i,
    /\[DEBUG\]/i,

    // Ignore successful messages
    /successfully/i,
    /completed/i,
];

/**
 * Simple hash function for error deduplication
 */
function hashError(error: string): string {
    let hash = 0;
    const cleanError = error.replace(/\d+/g, 'N').slice(0, 200); // Normalize numbers, limit length

    for (let i = 0; i < cleanError.length; i++) {
        const char = cleanError.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32-bit integer
    }

    return hash.toString(16);
}

/**
 * Terminal Error Detector class
 * Handles buffering, debouncing, and deduplication of errors
 */
export class TerminalErrorDetector {
    #buffer: string = '';
    #detectedErrors: DetectedError[] = [];
    #lastAlertTime: number = 0;
    #recentErrorHashes: Set<string> = new Set();
    #debounceTimer: NodeJS.Timeout | null = null;
    #isEnabled: boolean = true;

    // Configuration constants
    #DEBOUNCE_MS = 500;
    #COOLDOWN_MS = 3000;
    #MAX_BUFFER_SIZE = 10000;
    #HASH_TTL_MS = 30000;

    constructor() {
        // Clean up old hashes periodically
        setInterval(() => this.#cleanupOldHashes(), this.#HASH_TTL_MS);
    }

    /**
     * Enable/disable error detection
     */
    setEnabled(enabled: boolean): void {
        this.#isEnabled = enabled;
        logger.debug(`Error detection ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Process terminal output chunk
     * This should be called with each chunk of terminal output
     */
    processOutput(data: string): void {
        if (!this.#isEnabled) {
            return;
        }

        // Add to buffer
        this.#buffer += data;

        // Trim buffer if too large
        if (this.#buffer.length > this.#MAX_BUFFER_SIZE) {
            this.#buffer = this.#buffer.slice(-this.#MAX_BUFFER_SIZE / 2);
        }

        // Check for errors with debouncing
        this.#scheduleErrorCheck();
    }

    #scheduleErrorCheck(): void {
        if (this.#debounceTimer) {
            clearTimeout(this.#debounceTimer);
        }

        this.#debounceTimer = setTimeout(() => {
            this.#checkForErrors();
        }, this.#DEBOUNCE_MS);
    }

    #checkForErrors(): void {
        // Clean buffer of ANSI escape codes for pattern matching
        const cleanBuffer = this.#stripAnsi(this.#buffer);

        // Check ignore patterns first - note: we continue anyway to check for real errors
        IGNORE_PATTERNS.some((pattern) => pattern.test(cleanBuffer));

        const newErrors: DetectedError[] = [];

        for (const pattern of ERROR_PATTERNS) {
            const match = cleanBuffer.match(pattern.pattern);

            if (match) {
                const errorMessage = match[1] || match[0];
                const details = pattern.extractDetails ? pattern.extractDetails(match, cleanBuffer) : match[0];

                const errorHash = hashError(errorMessage + pattern.title);

                // Skip if we've recently shown this error
                if (this.#recentErrorHashes.has(errorHash)) {
                    continue;
                }

                const error: DetectedError = {
                    type: pattern.type,
                    severity: pattern.severity,
                    title: pattern.title,
                    message: errorMessage,
                    details,
                    timestamp: Date.now(),
                    hash: errorHash,
                };

                newErrors.push(error);
                this.#recentErrorHashes.add(errorHash);
            }
        }

        if (newErrors.length > 0) {
            this.#detectedErrors.push(...newErrors);
            this.#triggerAlert();
        }

        // Clear buffer after processing
        this.#buffer = '';
    }

    #triggerAlert(): void {
        const now = Date.now();

        if (now - this.#lastAlertTime < this.#COOLDOWN_MS) {
            logger.debug('Skipping alert due to cooldown');

            return;
        }

        if (this.#detectedErrors.length === 0) {
            return;
        }

        this.#lastAlertTime = now;

        // Get the most recent/important error
        const primaryError = this.#detectedErrors[this.#detectedErrors.length - 1];

        // Format content for display
        const content = this.#formatErrorContent();

        // Trigger workbench alert
        workbenchStore.actionAlert.set({
            type: 'error',
            title: primaryError.title,
            description: primaryError.message,
            content,
            source: 'terminal',
        });

        logger.info(`Terminal error detected: ${primaryError.title}`);

        // Clear processed errors
        this.#detectedErrors = [];
    }

    #formatErrorContent(): string {
        if (this.#detectedErrors.length === 1) {
            return this.#detectedErrors[0].details;
        }

        // Multiple errors - format as list
        const lines: string[] = [];
        lines.push(`Found ${this.#detectedErrors.length} error(s):\n`);

        for (const error of this.#detectedErrors.slice(0, 5)) {
            // Limit to 5 errors
            lines.push(`• ${error.title}: ${error.message}`);
        }

        if (this.#detectedErrors.length > 5) {
            lines.push(`\n... and ${this.#detectedErrors.length - 5} more error(s)`);
        }

        lines.push('\n\n--- Details ---\n');
        lines.push(this.#detectedErrors[0].details);

        return lines.join('\n');
    }

    #stripAnsi(str: string): string {
        return str.replace(/\x1b\[[0-9;]*[mGKHF]/g, '').replace(/\x1b\][^\x07]*\x07/g, '');
    }

    #cleanupOldHashes(): void {
        // Simple cleanup - just clear if too many
        if (this.#recentErrorHashes.size > 100) {
            this.#recentErrorHashes.clear();
        }
    }

    /**
     * Clear all state (useful for testing or reset)
     */
    reset(): void {
        this.#buffer = '';
        this.#detectedErrors = [];
        this.#recentErrorHashes.clear();

        if (this.#debounceTimer) {
            clearTimeout(this.#debounceTimer);
            this.#debounceTimer = null;
        }
    }

    /**
     * Manually dismiss current alert
     */
    dismissAlert(): void {
        workbenchStore.clearAlert();
    }
}

// Singleton instance
let detectorInstance: TerminalErrorDetector | null = null;

/**
 * Get the singleton error detector instance
 */
export function getTerminalErrorDetector(): TerminalErrorDetector {
    if (!detectorInstance) {
        detectorInstance = new TerminalErrorDetector();
    }

    return detectorInstance;
}

/**
 * Convenience function to process terminal output
 */
export function detectTerminalErrors(data: string): void {
    getTerminalErrorDetector().processOutput(data);
}

/**
 * Reset the error detector state
 * Call this when user requests a fix so the same error can be detected again
 */
export function resetTerminalErrorDetector(): void {
    getTerminalErrorDetector().reset();
}
