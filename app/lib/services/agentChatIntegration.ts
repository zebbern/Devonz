/**
 * Agent Chat Integration
 *
 * Integrates the Devonz Agent Mode with the chat flow.
 * Exposes agent tools in MCP-compatible format for the LLM to use.
 */

import type { ToolSet, CoreMessage as UIMessage } from 'ai';
import { convertToCoreMessages } from 'ai';
import { z } from 'zod';
import { createScopedLogger } from '~/utils/logger';
import { AGENT_SYSTEM_PROMPT, AGENT_SYSTEM_PROMPT_COMPACT } from '~/lib/agent-orchestrator/prompts/base';
import { agentToolDefinitions, executeAgentTool, isAgentTool, getAgentToolNames } from './agentToolsService';
import { getAgentOrchestrator } from './legacyAgentService';
import { isAgentModeEnabled, getAgentModeSettings } from '~/lib/stores/agentMode';
import { TOOL_EXECUTION_APPROVAL, TOOL_EXECUTION_DENIED, TOOL_EXECUTION_ERROR } from '~/utils/constants';
import type { ToolCallAnnotation } from '~/types/context';

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
      /* parameters removed */
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
    toolSetWithoutExecute[name] = { description: tool.description, ...tool };
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
 * Get the agent system prompt to append when agent mode is active
 */
export function getAgentSystemPrompt(compact: boolean = false): string {
  return compact ? AGENT_SYSTEM_PROMPT_COMPACT() : AGENT_SYSTEM_PROMPT();
}

/**
 * Enhance system prompt with agent capabilities when agent mode is enabled
 */
export function enhanceSystemPromptWithAgentMode(basePrompt: string, options?: { compact?: boolean }): string {
  const agentPrompt = getAgentSystemPrompt(options?.compact);

  return `${basePrompt}

<!-- AGENT MODE ENABLED -->
${agentPrompt}
<!-- END AGENT MODE -->
`;
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
  dataStream: any /* DataStreamWriter */,
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
      serverName: 'devonz-agent',
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
  dataStream: any /* DataStreamWriter */,
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
        JSON.stringify({/* formatDataStreamPart mock */}),
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
