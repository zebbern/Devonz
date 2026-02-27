/**
 * MCP Client - Tool Gateway
 *
 * The MCP Client is the adapter layer that:
 * - Exposes tools to agents/orchestrator
 * - Enforces permissions per agent
 * - Converts tool responses to structured objects
 * - Logs all tool calls for audit
 */

import type { AgentName, any /* ToolCall */, ToolResult } from '~/lib/mcp/types';
import { validateany /* ToolCall */ } from '~/lib/mcp/client/permissions';
import { logToolCallStart, logToolCallEnd, logToolCallDenied } from '~/lib/mcp/server/audit';

// Import tool implementations
import * as fsTools from '~/lib/mcp/server/tools/fs';
import * as runTools from '~/lib/mcp/server/tools/run';
import * as secTools from '~/lib/mcp/server/tools/sec';
import * as projTools from '~/lib/mcp/server/tools/proj';

/*
 * Tool Registry
 * Maps tool names to their handler functions.
 * All handlers accept Record<string, unknown> for flexibility.
 */
type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

const toolRegistry: Record<string, ToolHandler> = {
  // File System Tools
  'fs.listTree': fsTools.listTree as unknown as ToolHandler,
  'fs.readFile': fsTools.readFile as unknown as ToolHandler,
  'fs.readFiles': fsTools.readFiles as unknown as ToolHandler,
  'fs.search': fsTools.search as unknown as ToolHandler,
  'fs.applyPatch': fsTools.applyPatch as unknown as ToolHandler,
  'fs.read': fsTools.readFile as unknown as ToolHandler,
  'fs.patch': fsTools.applyPatch as unknown as ToolHandler,

  // Execution Tools
  'run.lint': runTools.lint as unknown as ToolHandler,
  'run.typecheck': runTools.typecheck as unknown as ToolHandler,
  'run.tests': runTools.tests as unknown as ToolHandler,
  'run.build': runTools.build as unknown as ToolHandler,
  'run.install': runTools.install as unknown as ToolHandler,
  'run.format': runTools.format as unknown as ToolHandler,

  // Security Tools
  'sec.audit': secTools.npmAudit as unknown as ToolHandler,
  'sec.scan': secTools.semgrepScan as unknown as ToolHandler,
  'sec.secrets': secTools.secretScan as unknown as ToolHandler,

  // Project Intelligence Tools
  'proj.config': projTools.getConfig as unknown as ToolHandler,
  'proj.deps': projTools.getDependencies as unknown as ToolHandler,
  'proj.routes': projTools.getRoutes as unknown as ToolHandler,
};

/*
 * MCP Client Class
 * Gateway for all tool calls with permission enforcement and audit logging.
 */
export class MCPClient {
  private _pendingApprovals: Map<string, any /* ToolCall */> = new Map();

  /**
   * Execute a tool call with permission checking and audit logging
   */
  async callTool<T = unknown>(
    agent: AgentName,
    tool: string,
    args: Record<string, unknown>,
    runId: string,
  ): Promise<ToolResult<T>> {
    const startTime = Date.now();

    // Create tool call record
    const call: any /* ToolCall */ = {
      id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      tool,
      args,
      agent,
      runId,
      timestamp: startTime,
    };

    // Validate permissions
    const validation = validateany /* ToolCall */(agent, tool);

    if (!validation.allowed) {
      logToolCallDenied(agent, tool, validation.reason || 'Permission denied', runId);

      return {
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: validation.reason || 'Permission denied',
        },
        duration: Date.now() - startTime,
        auditId: '',
      };
    }

    // Handle gated tools (require approval)
    if (validation.requiresApproval) {
      this._pendingApprovals.set(call.id, call);

      return {
        success: false,
        error: {
          code: 'APPROVAL_REQUIRED',
          message: `Tool "${tool}" requires user approval`,
          details: { callId: call.id },
        },
        duration: Date.now() - startTime,
        auditId: '',
      };
    }

    // Start audit log
    const auditId = logToolCallStart(call);

    // Execute tool
    try {
      const handler = toolRegistry[tool];

      if (!handler) {
        throw new Error(`Unknown tool: ${tool}`);
      }

      const data = await handler(args);
      const duration = Date.now() - startTime;

      // Determine files changed (if applicable)
      const filesChanged = this._extractFilesChanged(tool, data);

      // Log completion
      logToolCallEnd(auditId, { success: true, duration, auditId }, filesChanged);

      return {
        success: true,
        data: data as T,
        duration,
        auditId,
      };
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logToolCallEnd(auditId, {
        success: false,
        error: { code: 'EXECUTION_ERROR', message: errorMessage },
        duration,
        auditId,
      });

      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: errorMessage,
          details: error instanceof Error ? error.stack : undefined,
        },
        duration,
        auditId,
      };
    }
  }

  /**
   * Approve a pending gated tool call
   */
  async approveany /* ToolCall */(callId: string): Promise<ToolResult> {
    const call = this._pendingApprovals.get(callId);

    if (!call) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `No pending approval for call ${callId}`,
        },
        duration: 0,
        auditId: '',
      };
    }

    this._pendingApprovals.delete(callId);

    // Execute without permission check (already approved)
    const handler = toolRegistry[call.tool];

    if (!handler) {
      return {
        success: false,
        error: { code: 'UNKNOWN_TOOL', message: `Unknown tool: ${call.tool}` },
        duration: 0,
        auditId: '',
      };
    }

    const startTime = Date.now();
    const auditId = logToolCallStart(call);

    try {
      const data = await handler(call.args);
      const duration = Date.now() - startTime;
      const filesChanged = this._extractFilesChanged(call.tool, data);

      logToolCallEnd(auditId, { success: true, duration, auditId }, filesChanged);

      return { success: true, data, duration, auditId };
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logToolCallEnd(auditId, {
        success: false,
        error: { code: 'EXECUTION_ERROR', message: errorMessage },
        duration,
        auditId,
      });

      return {
        success: false,
        error: { code: 'EXECUTION_ERROR', message: errorMessage },
        duration,
        auditId,
      };
    }
  }

  /**
   * Reject a pending gated tool call
   */
  rejectany /* ToolCall */(callId: string): void {
    const call = this._pendingApprovals.get(callId);

    if (call) {
      logToolCallDenied(call.agent, call.tool, 'User rejected', call.runId);
      this._pendingApprovals.delete(callId);
    }
  }

  /**
   * Get pending approvals
   */
  getPendingApprovals(): any /* ToolCall */[] {
    return Array.from(this._pendingApprovals.values());
  }

  /**
   * Extract files changed from tool result
   */
  private _extractFilesChanged(tool: string, data: unknown): string[] | undefined {
    if (tool.startsWith('fs.') && data && typeof data === 'object' && 'filesChanged' in data) {
      return (data as { filesChanged: Array<{ path: string }> }).filesChanged.map((f) => f.path);
    }

    return undefined;
  }

  /**
   * Get list of available tools for an agent
   */
  getAvailableTools(agent: AgentName): string[] {
    return Object.keys(toolRegistry).filter((tool) => {
      const validation = validateany /* ToolCall */(agent, tool);

      return validation.allowed;
    });
  }
}

/*
 * Singleton Instance
 * Use getMCPClient() to get the shared MCP client instance.
 */
let mcpClientInstance: MCPClient | null = null;

export function getMCPClient(): MCPClient {
  if (!mcpClientInstance) {
    mcpClientInstance = new MCPClient();
  }

  return mcpClientInstance;
}
