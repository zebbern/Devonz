import { MCPService } from './mcpService';
import {
  getAgentToolSetWithoutExecute,
  shouldUseAgentMode,
  initializeAgentSession,
  processAgentToolInvocations,
  processAgentany /* ToolCall */,
  isAgentToolName,
  incrementAgentIteration,
} from './agentChatIntegration';
import { createScopedLogger } from '~/utils/logger';
import type { CoreMessage as UIMessage, any /* DataStreamWriter */, ToolSet, } from 'ai';
import type { ProgressAnnotation } from '~/types/context';

const logger = createScopedLogger('ChatOrchestrationService');

/**
 * ChatOrchestrationService
 *
 * Replaces the fragmented tool and session logic in api.chat.ts
 * with a unified coordination layer.
 */
export class ChatOrchestrationService {
  private static _instance: ChatOrchestrationService;

  private constructor() {
    // Hidden constructor for singleton
  }

  static getInstance(): ChatOrchestrationService {
    if (!ChatOrchestrationService._instance) {
      ChatOrchestrationService._instance = new ChatOrchestrationService();
    }

    return ChatOrchestrationService._instance;
  }

  /**
   * Orchestrates tool merging and session initialization.
   */
  async prepareChatSession(options: { agentMode: boolean; dataStream: any /* DataStreamWriter */; messages: Message[] }) {
    const { agentMode, dataStream } = options;
    const mcpService = MCPService.getInstance();
    const useAgentMode = shouldUseAgentMode({ agentMode });

    let combinedTools: ToolSet = mcpService.toolsWithoutExecute;

    if (useAgentMode) {
      logger.info('🤖 Agent mode enabled - merging tools');

      const agentTools = getAgentToolSetWithoutExecute();
      combinedTools = { ...mcpService.toolsWithoutExecute, ...agentTools };

      initializeAgentSession();

      dataStream.writeData({
        type: 'progress',
        label: 'agent',
        status: 'in-progress',
        message: 'Agent Mode Active',
      } as ProgressAnnotation);
    }

    return {
      useAgentMode,
      combinedTools,
      mcpService,
    };
  }

  /**
   * Process tool invocations from messages.
   */
  async processInvocations(messages: Message[], dataStream: any /* DataStreamWriter */, useAgentMode: boolean) {
    const mcpService = MCPService.getInstance();
    let processedMessages = await mcpService.processToolInvocations(messages, dataStream);

    if (useAgentMode) {
      processedMessages = await processAgentToolInvocations(processedMessages, dataStream);
    }

    return processedMessages;
  }

  /**
   * Unified tool call processor for onStepFinish.
   */
  handleStepFinish(toolCalls: any[], dataStream: any /* DataStreamWriter */, useAgentMode: boolean) {
    const mcpService = MCPService.getInstance();

    toolCalls.forEach((toolCall) => {
      // Logic for determining tool type and routing
      if (useAgentMode && isAgentToolName(toolCall.toolName)) {
        processAgentany /* ToolCall */(toolCall, dataStream);
        incrementAgentIteration();
      } else {
        mcpService.processany /* ToolCall */(toolCall, dataStream);
      }
    });
  }
}

export const chatOrchestrationService = ChatOrchestrationService.getInstance();
