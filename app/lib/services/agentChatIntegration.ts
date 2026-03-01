/**
 * Agent Chat Integration
 *
 * Integrates the Alinma coder Agent Mode with the chat flow.
 * Exposes agent tools in MCP-compatible format for the LLM to use.
 */

import type { ToolSet, Message, DataStreamWriter, JSONValue } from 'ai';
import { formatDataStreamPart, convertToCoreMessages } from 'ai';
import { z } from 'zod';
import { createScopedLogger } from '~/utils/logger';
import {
  agentToolDefinitions,
  executeAgentTool,
  isAgentTool,
  getAgentToolNames,
  isReadOnlyTool,
  executeToolBatch,
} from './agentToolsService';
import type { BatchToolResult } from './agentToolsService';
import { getAgentOrchestrator } from './agentOrchestratorService';
import type { SelfReviewResult } from './agentOrchestratorService';
import { isAgentModeEnabled, getAgentModeSettings } from '~/lib/stores/agentMode';
import { TOOL_EXECUTION_APPROVAL, TOOL_EXECUTION_DENIED, TOOL_EXECUTION_ERROR } from '~/utils/constants';
import type { ToolCallAnnotation } from '~/types/context';
import type { PlanPhase, TokenBudgetState } from '~/lib/agent/types';

const logger = createScopedLogger('AgentChatIntegration');

// Cache for agent tools
let agentToolSetCache: ToolSet | null = null;
let agentToolSetWithoutExecuteCache: ToolSet | null = null;

/**
 * Convert agent tools to MCP-compatible ToolSet format
 */
export function getAgentToolSet(): ToolSet {
  if (agentToolSetCache) {
    return agentToolSetCache;
  }

  const toolSet: ToolSet = {};

  for (const [toolName, definition] of Object.entries(agentToolDefinitions)) {
    // Build Zod schema from definition parameters
    const schemaShape: Record<string, z.ZodTypeAny> = {};

    if (definition.parameters && definition.parameters.properties) {
      for (const [paramName, paramDef] of Object.entries(definition.parameters.properties)) {
        const param = paramDef as { type: string; description?: string; enum?: string[] };
        let zodType: z.ZodTypeAny;

        switch (param.type) {
          case 'string':
            if (param.enum) {
              zodType = z.enum(param.enum as [string, ...string[]]);
            } else {
              zodType = z.string();
            }

            break;
          case 'number':
            zodType = z.number();
            break;
          case 'boolean':
            zodType = z.boolean();
            break;
          case 'integer':
            zodType = z.number().int();
            break;
          default:
            zodType = z.unknown();
        }

        if (param.description) {
          zodType = zodType.describe(param.description);
        }

        // Make optional if not in required array
        const required = definition.parameters.required || [];

        if (!required.includes(paramName)) {
          zodType = zodType.optional();
        }

        schemaShape[paramName] = zodType;
      }
    }

    toolSet[toolName] = {
      description: definition.description,
      parameters: z.object(schemaShape),
      execute: async (args: Record<string, unknown>, context?: { toolCallId?: string }) => {
        logger.debug(`Executing agent tool: ${toolName}`, { args, toolCallId: context?.toolCallId });

        // Get orchestrator for tracking
        const orchestrator = getAgentOrchestrator();

        // Execute through orchestrator for approval flow and tracking
        const result = await orchestrator.executeTool(toolName, args);

        if (!result.success) {
          logger.error(`Agent tool ${toolName} failed:`, result.error);
          return { error: result.error || 'Tool execution failed' };
        }

        return result.data;
      },
    };
  }

  agentToolSetCache = toolSet;

  return toolSet;
}

/**
 * Get agent tools without execute function (for client-side display)
 */
export function getAgentToolSetWithoutExecute(): ToolSet {
  if (agentToolSetWithoutExecuteCache) {
    return agentToolSetWithoutExecuteCache;
  }

  const fullToolSet = getAgentToolSet();
  const toolSetWithoutExecute: ToolSet = {};

  for (const [name, tool] of Object.entries(fullToolSet)) {
    toolSetWithoutExecute[name] = {
      description: tool.description,
      parameters: tool.parameters,
    };
  }

  agentToolSetWithoutExecuteCache = toolSetWithoutExecute;

  return toolSetWithoutExecute;
}

/**
 * Check if agent mode should be active for this request
 */
export function shouldUseAgentMode(requestOptions?: { agentMode?: boolean }): boolean {
  // Check explicit request option first
  if (requestOptions?.agentMode === false) {
    return false;
  }

  if (requestOptions?.agentMode === true) {
    return true;
  }

  // Fall back to settings
  return isAgentModeEnabled();
}

/**
 * Check if a tool name is an agent tool
 */
export function isAgentToolName(toolName: string): boolean {
  return isAgentTool(toolName);
}

/**
 * Process agent tool call annotation (for frontend display)
 */
export function processAgentToolCall(
  toolCall: { toolCallId: string; toolName: string },
  dataStream: DataStreamWriter,
): void {
  const { toolCallId, toolName } = toolCall;

  if (!isAgentTool(toolName)) {
    return;
  }

  const definition = agentToolDefinitions[toolName];

  if (definition) {
    dataStream.writeMessageAnnotation({
      type: 'toolCall',
      toolCallId,
      serverName: 'alinma-coder-agent',
      toolName,
      toolDescription: definition.description,
    } satisfies ToolCallAnnotation);
  }
}

/**
 * Process agent tool invocations from messages
 * Similar to MCPService.processToolInvocations but for agent tools
 */
export async function processAgentToolInvocations(
  messages: Message[],
  dataStream: DataStreamWriter,
): Promise<Message[]> {
  const agentTools = getAgentToolSet();
  const lastMessage = messages[messages.length - 1];
  const parts = lastMessage.parts;

  if (!parts) {
    return messages;
  }

  const processedParts = await Promise.all(
    parts.map(async (part) => {
      // Only process tool invocations parts
      if (part.type !== 'tool-invocation') {
        return part;
      }

      const { toolInvocation } = part;
      const { toolName, toolCallId } = toolInvocation;

      // Only process agent tools, skip others
      if (!isAgentTool(toolName) || toolInvocation.state !== 'result') {
        return part;
      }

      let result;

      if (toolInvocation.result === TOOL_EXECUTION_APPROVAL.APPROVE) {
        const toolInstance = agentTools[toolName];

        if (toolInstance && typeof toolInstance.execute === 'function') {
          logger.debug(`Executing agent tool "${toolName}" with args:`, toolInvocation.args);

          try {
            result = await toolInstance.execute(toolInvocation.args, {
              messages: convertToCoreMessages(messages),
              toolCallId,
            });
          } catch (error) {
            logger.error(`Error executing agent tool "${toolName}":`, error);
            result = TOOL_EXECUTION_ERROR;
          }
        } else {
          logger.warn(`Agent tool "${toolName}" has no execute function`);
          result = { error: 'Tool has no execute function' };
        }
      } else if (toolInvocation.result === TOOL_EXECUTION_APPROVAL.REJECT) {
        result = TOOL_EXECUTION_DENIED;
      } else {
        // For any unhandled responses, return the original part.
        return part;
      }

      // Forward updated tool result to the client.
      dataStream.write(
        formatDataStreamPart('tool_result', {
          toolCallId,
          result,
        }),
      );

      // Return updated toolInvocation with the actual result.
      return {
        ...part,
        toolInvocation: {
          ...toolInvocation,
          result,
        },
      };
    }),
  );

  // Finally return the processed messages
  return [...messages.slice(0, -1), { ...lastMessage, parts: processedParts }];
}

/**
 * Process an agent tool invocation (single tool)
 */
export async function processAgentToolInvocation(
  toolName: string,
  args: Record<string, unknown>,
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  if (!isAgentTool(toolName)) {
    return {
      success: false,
      error: `Unknown agent tool: ${toolName}`,
    };
  }

  try {
    const result = await executeAgentTool(toolName, args);
    return {
      success: result.success,
      result: result.data,
      error: result.error,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Agent tool invocation failed: ${toolName}`, { error: errorMessage });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Get summary of available agent tools for the LLM
 */
export function getAgentToolsSummary(): string {
  const toolNames = getAgentToolNames();
  const summaries = toolNames.map((name) => {
    const def = agentToolDefinitions[name];
    return `- ${name}: ${def.description}`;
  });

  return `Available Agent Tools:\n${summaries.join('\n')}`;
}

/**
 * Initialize agent mode for a chat session
 */
export function initializeAgentSession(task?: string): void {
  const settings = getAgentModeSettings();
  const orchestrator = getAgentOrchestrator(settings);

  if (task) {
    orchestrator.startSession(task);
  }

  logger.info('Agent session initialized', { settings, task });
}

/**
 * End an agent session and get summary
 */
export function endAgentSession(): string {
  const orchestrator = getAgentOrchestrator();
  orchestrator.endSession();

  return orchestrator.getSessionSummary();
}

/**
 * Check if we're near the iteration limit and should warn the LLM
 */
export function getAgentIterationWarning(): string | null {
  const orchestrator = getAgentOrchestrator();
  return orchestrator.getIterationWarningPrompt();
}

/**
 * Increment the iteration counter for the current agent session
 */
export function incrementAgentIteration(): boolean {
  const orchestrator = getAgentOrchestrator();
  return orchestrator.incrementIteration();
}

/**
 * Clear the agent tool caches (useful for testing)
 */
export function clearAgentToolCaches(): void {
  agentToolSetCache = null;
  agentToolSetWithoutExecuteCache = null;
}

// ─── Planning-First Flow & Self-Review Bridge ─────────────────────────

/** Mirror of the non-exported constant in agentOrchestratorService.ts */
const MAX_REVIEW_CYCLES = 3;

/** Extra maxSteps budget per review cycle (tool call + error check + fix attempts) */
const STEPS_PER_REVIEW_CYCLE = 5;

/**
 * Emit a plan_phase_changed structured streaming event.
 * Called whenever the agent transitions between planning workflow phases.
 */
export function emitPlanPhaseEvent(
  dataStream: DataStreamWriter,
  fromPhase: PlanPhase,
  toPhase: PlanPhase,
  taskId?: string,
): void {
  dataStream.writeData({
    devonz_event: {
      type: 'plan_phase_changed' as const,
      timestamp: new Date().toISOString(),
      fromPhase,
      toPhase,
      ...(taskId ? { taskId } : {}),
    },
  });
  logger.debug('Plan phase changed', { fromPhase, toPhase, taskId });
}

/**
 * Emit a review_cycle structured streaming event from a SelfReviewResult.
 * Only emits if the result contains review cycle data.
 */
export function emitReviewCycleEvent(dataStream: DataStreamWriter, reviewResult: SelfReviewResult): void {
  if (!reviewResult.reviewCycle) {
    return;
  }

  const cycle = reviewResult.reviewCycle;

  dataStream.writeData({
    devonz_event: {
      type: 'review_cycle' as const,
      timestamp: new Date().toISOString(),
      cycleNumber: cycle.cycleNumber,
      triggeredBy: cycle.triggeredBy,
      errorsFound: [...cycle.errorsFound],
      fixAttempted: cycle.fixAttempted,
      fingerprint: cycle.fingerprint,
    },
  });
  logger.debug('Review cycle event emitted', { cycleNumber: cycle.cycleNumber, fingerprint: cycle.fingerprint });
}

/**
 * Calculate adjusted maxSteps that accounts for self-review overhead
 * and token budget pressure.
 *
 * Base budget = requestedSteps + review overhead.
 * When the context window is heavily used the base is reduced to
 * conserve tokens.  A recent context summary grants a small bonus.
 *
 * @param requestedSteps       — raw step limit from the user/config
 * @param tokenBudget          — current token usage state (optional)
 * @param recentContextSummary — true when a context summary occurred
 *        in the last 2 steps (caller decides via cooldown check)
 */
export function getAdjustedMaxSteps(
  requestedSteps: number,
  tokenBudget?: TokenBudgetState,
  recentContextSummary?: boolean,
): number {
  const base = requestedSteps + MAX_REVIEW_CYCLES * STEPS_PER_REVIEW_CYCLE;

  // No budget data or unknown usage → no reduction
  if (!tokenBudget || tokenBudget.usagePercentage < 0) {
    return base;
  }

  let adjusted: number;

  if (tokenBudget.usagePercentage > 90) {
    // Critical pressure — reduce by 60%, minimum 2
    adjusted = Math.max(2, Math.floor(base * 0.4));
  } else if (tokenBudget.usagePercentage > 80) {
    // High pressure — reduce by 30%, minimum 3
    adjusted = Math.max(3, Math.floor(base * 0.7));
  } else {
    adjusted = base;
  }

  // Bonus for recent context summary (capped at original base)
  if (recentContextSummary) {
    adjusted = Math.min(base, adjusted + 2);
  }

  return adjusted;
}

/**
 * Run the orchestrator's self-review loop for the given step's tool calls,
 * emit the appropriate streaming event, and return the result.
 *
 * @param dataStream — active data stream for event emission
 * @param toolCalls — tool calls from the completed step
 * @returns The self-review result from the orchestrator
 */
export async function handleAgentStepReview(
  dataStream: DataStreamWriter,
  toolCalls: ReadonlyArray<{ toolName: string }>,
): Promise<SelfReviewResult> {
  const orchestrator = getAgentOrchestrator();
  const result = await orchestrator.handleStepFinishReview(toolCalls);

  // Emit the review cycle event if review data is available
  if (result.reviewCycle) {
    emitReviewCycleEvent(dataStream, result);
  }

  if (result.loopTerminated) {
    logger.warn('Self-review loop terminated', { reason: result.terminationReason });
  }

  return result;
}

/**
 * Emit a warning streaming event when the step budget drops critically low
 * during an active review cycle. The caller should terminate the review loop
 * after emitting this warning.
 */
export function emitStepBudgetWarning(dataStream: DataStreamWriter, remainingSteps: number): void {
  dataStream.writeData({
    devonz_event: {
      type: 'error' as const,
      timestamp: new Date().toISOString(),
      code: 'STEP_BUDGET_LOW',
      message: `Step budget critically low (${remainingSteps} remaining). Terminating review loop early to preserve remaining steps for completion.`,
      recoverable: true,
    },
  });
  logger.warn('Step budget warning emitted', { remainingSteps });
}

/**
 * Check whether the orchestrator's self-review loop is currently active.
 * Used by the step budget check to determine if early termination is needed.
 */
export function isAgentReviewLoopActive(): boolean {
  const orchestrator = getAgentOrchestrator();
  return orchestrator.isReviewLoopActive();
}

// ─── Parallel Tool Batch Execution ────────────────────────────────────

/**
 * Execute a batch of tool calls with parallel support for read-only tools.
 *
 * When **all** tool calls in the batch are read-only (`devonz_read_file`,
 * `devonz_list_directory`, `devonz_search_code`, `devonz_get_errors`), they
 * are executed concurrently via `Promise.allSettled`. Otherwise, the batch
 * falls back to sequential execution.
 *
 * Emits `parallel_tool_batch` streaming events before and after execution
 * so the client can display batch progress. Individual results are returned
 * for the caller to record in the orchestrator's `toolCalls` array.
 *
 * @param toolCalls  — tool name + params pairs to execute
 * @param dataStream — active data stream for event emission
 * @returns per-tool results and whether the batch ran in parallel
 */
export async function executeParallelToolBatch(
  toolCalls: ReadonlyArray<{ name: string; params: Record<string, unknown> }>,
  dataStream: DataStreamWriter,
): Promise<{ parallel: boolean; results: BatchToolResult[] }> {
  const batchId = crypto.randomUUID();
  const allReadOnly = toolCalls.length > 1 && toolCalls.every((tc) => isReadOnlyTool(tc.name));

  if (!allReadOnly) {
    // Not eligible for parallel execution — fall back to sequential
    return executeToolBatch(toolCalls);
  }

  // ── Emit "executing" event ────────────────────────────────────────────
  dataStream.writeData({
    devonz_event: {
      type: 'parallel_tool_batch' as const,
      timestamp: new Date().toISOString(),
      batchId,
      tools: toolCalls.map((tc) => ({ name: tc.name, params: tc.params as Record<string, JSONValue> })),
      status: 'running' as const,
    },
  });
  logger.info(`Parallel tool batch ${batchId}: executing ${toolCalls.length} read-only tools`);

  // ── Execute in parallel ──────────────────────────────────────────────
  const { results } = await executeToolBatch(toolCalls);

  // Determine overall batch status: 'failed' if ANY tool failed, else 'completed'
  const hasFailed = results.some((r) => !r.result.success);
  const batchStatus = hasFailed ? 'failed' : 'completed';

  // ── Emit "complete" / "failed" event ──────────────────────────────────
  dataStream.writeData({
    devonz_event: {
      type: 'parallel_tool_batch' as const,
      timestamp: new Date().toISOString(),
      batchId,
      tools: toolCalls.map((tc) => ({ name: tc.name, params: tc.params as Record<string, JSONValue> })),
      status: batchStatus as 'completed' | 'failed',
      results: results.map((r) => ({
        name: r.name,
        output: (r.result.success ? r.result.data : { error: r.result.error }) as JSONValue,
      })) as JSONValue[],
    },
  });
  logger.info(`Parallel tool batch ${batchId}: ${batchStatus} (${results.length} results)`);

  return { parallel: true, results };
}
