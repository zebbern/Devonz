/**
 * MCP Audit Logger
 *
 * Logs every tool call for security, debugging, and replay.
 * All writes are atomic and append-only.
 */

import type { AgentName, AuditLogEntry, any /* ToolCall */, ToolResult } from '~/lib/mcp/types';

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * AUDIT LOG STORAGE
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * In-memory audit log (for development)
 * In production, this should write to PostgreSQL or a log service
 */
const auditLog: AuditLogEntry[] = [];
const maxLogSize = 10000; // Rotate after this many entries

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * AUDIT FUNCTIONS
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Generate unique audit ID
 */
function generateAuditId(): string {
  return `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Redact sensitive data from args before logging
 */
function redactSensitiveData(args: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['apiKey', 'password', 'token', 'secret', 'credential'];
  const redacted = { ...args };

  for (const key of Object.keys(redacted)) {
    if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk.toLowerCase()))) {
      redacted[key] = '[REDACTED]';
    }
  }

  return redacted;
}

/**
 * Log a tool call attempt (before execution)
 */
export function logToolCallStart(call: any /* ToolCall */): string {
  const auditId = generateAuditId();

  const entry: AuditLogEntry = {
    id: auditId,
    timestamp: Date.now(),
    agent: call.agent,
    runId: call.runId,
    tool: call.tool,
    args: redactSensitiveData(call.args),
    result: 'success', // Will be updated on completion
    duration: 0,
  };

  auditLog.push(entry);

  // Rotate if too large
  if (auditLog.length > maxLogSize) {
    auditLog.shift();
  }

  console.log(`[MCP Audit] ${call.agent} → ${call.tool}`, {
    auditId,
    runId: call.runId,
  });

  return auditId;
}

/**
 * Log a tool call completion
 */
export function logToolCallEnd(auditId: string, result: ToolResult, filesChanged?: string[]): void {
  const entry = auditLog.find((e) => e.id === auditId);

  if (entry) {
    entry.result = result.success ? 'success' : 'error';
    entry.duration = result.duration;
    entry.filesChanged = filesChanged;

    if (result.error) {
      entry.error = result.error.message;
    }
  }

  console.log(`[MCP Audit] Complete: ${auditId}`, {
    success: result.success,
    duration: result.duration,
    filesChanged: filesChanged?.length || 0,
  });
}

/**
 * Log a denied tool call
 */
export function logToolCallDenied(agent: AgentName, tool: string, reason: string, runId: string): void {
  const entry: AuditLogEntry = {
    id: generateAuditId(),
    timestamp: Date.now(),
    agent,
    runId,
    tool,
    args: {},
    result: 'denied',
    duration: 0,
    error: reason,
  };

  auditLog.push(entry);

  console.warn(`[MCP Audit] DENIED: ${agent} → ${tool}`, { reason, runId });
}

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * QUERY FUNCTIONS
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Get audit entries for a specific run
 */
export function getAuditLog(runId: string): AuditLogEntry[] {
  return auditLog.filter((e) => e.runId === runId);
}

/**
 * Get recent audit entries
 */
export function getRecentAuditEntries(count: number = 100): AuditLogEntry[] {
  return auditLog.slice(-count);
}

/**
 * Get audit entries by agent
 */
export function getAuditByAgent(agent: AgentName, count: number = 100): AuditLogEntry[] {
  return auditLog.filter((e) => e.agent === agent).slice(-count);
}

/**
 * Get denied tool calls (for security review)
 */
export function getDeniedCalls(count: number = 100): AuditLogEntry[] {
  return auditLog.filter((e) => e.result === 'denied').slice(-count);
}

/**
 * Get audit summary for a run
 */
export function getAuditSummary(runId: string): {
  totalCalls: number;
  successCount: number;
  errorCount: number;
  deniedCount: number;
  filesChanged: string[];
  duration: number;
} {
  const entries = getAuditLog(runId);

  return {
    totalCalls: entries.length,
    successCount: entries.filter((e) => e.result === 'success').length,
    errorCount: entries.filter((e) => e.result === 'error').length,
    deniedCount: entries.filter((e) => e.result === 'denied').length,
    filesChanged: [...new Set(entries.flatMap((e) => e.filesChanged || []))],
    duration: entries.reduce((sum, e) => sum + e.duration, 0),
  };
}

/**
 * Clear audit log (for testing only)
 */
export function clearAuditLog(): void {
  auditLog.length = 0;
}

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * EXPORT FUNCTIONS
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Export audit log as JSON (for external analysis)
 */
export function exportAuditLog(runId?: string): string {
  const entries = runId ? getAuditLog(runId) : auditLog;

  return JSON.stringify(entries, null, 2);
}
