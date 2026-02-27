import { type ActionFunctionArgs } from '@remix-run/node';
import { generateId } from 'ai';
import { MAX_RESPONSE_SEGMENTS, MAX_TOKENS, type FileMap } from '~/lib/.server/llm/constants';
import { CONTINUE_PROMPT } from '~/lib/common/prompts/prompts';
import { streamText, type Messages, type StreamingOptions } from '~/lib/.server/llm/stream-text';
import SwitchableStream from '~/lib/.server/llm/switchable-stream';
import { createScopedLogger } from '~/utils/logger';
import { chatOrchestrationService } from '~/lib/services/chatOrchestrationService';
import { handleApiError } from '~/lib/api-error-handler';

const logger = createScopedLogger('api.chat');

import { getApiKeysFromCookie, getProviderSettingsFromCookie } from '~/lib/api/cookies';
import { getFilePaths } from '~/lib/.server/llm/select-context';
import type { ProgressAnnotation } from '~/types/context';
import { extractPropertiesFromMessage } from '~/lib/.server/llm/utils';
import type { DesignScheme } from '~/types/design-scheme';
import { StreamRecoveryManager } from '~/lib/.server/llm/stream-recovery';
import { shouldUseAgentMode, getAgentSystemPrompt } from '~/lib/services/agentChatIntegration';
import { contextService } from '~/lib/services/contextService';

import { withSecurity } from '~/lib/security.server';
import { chatRequestSchema } from '~/lib/api-validation';

export const action = withSecurity(async (args: ActionFunctionArgs) => {
  return chatAction(args);
});

async function chatAction({ context, request }: ActionFunctionArgs) {
  const streamRecovery = new StreamRecoveryManager({
    timeout: 45000,
    maxRetries: 2,
    onTimeout: () => {
      logger.warn('Stream timeout - attempting recovery');
    },
  });

  // Parse and validate request body
  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const parsed = chatRequestSchema.safeParse(rawBody);

  if (!parsed.success) {
    logger.warn('Chat request validation failed:', parsed.error.issues);

    return new Response(
      JSON.stringify({
        error: 'Invalid request',
        details: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  const {
    messages,
    files,
    promptId,
    contextOptimization,
    supabase,
    chatMode,
    designScheme,
    maxLLMSteps,
    agentMode,
    orchestratorMode,
  } = parsed.data as {
    messages: Messages;
    files: FileMap;
    promptId?: string;
    contextOptimization: boolean;
    chatMode: 'discuss' | 'build';
    designScheme?: DesignScheme;
    supabase?: {
      isConnected: boolean;
      hasSelectedProject: boolean;
      credentials?: {
        anonKey?: string;
        supabaseUrl?: string;
      };
    };
    maxLLMSteps: number;
    agentMode?: boolean;
    orchestratorMode?: boolean;
  };

  // Determine if agent mode should be active for this request
  const useAgentMode = shouldUseAgentMode({ agentMode });

  // Use orchestrator if enabled
  const useOrchestrator = !!orchestratorMode;

  const cookieHeader = request.headers.get('Cookie');
  const apiKeys = getApiKeysFromCookie(cookieHeader);
  const providerSettings = getProviderSettingsFromCookie(cookieHeader);

  const stream = new SwitchableStream();

  const cumulativeUsage = {
    completionTokens: 0,
    promptTokens: 0,
    totalTokens: 0,
  };
  const encoder: TextEncoder = new TextEncoder();
  let progressCounter: number = 1;

  try {
    const totalMessageContent = messages.reduce((acc: string, message) => {
      const rawContent: unknown = message.content;
      let content = '';

      if (typeof rawContent === 'string') {
        content = rawContent;
      } else if (Array.isArray(rawContent)) {
        content = (rawContent as Array<Record<string, unknown>>)
          .map((p) => ('text' in p ? String(p.text) : ''))
          .join('');
      }

      return acc + content;
    }, '');

    logger.debug(`Total message length: ${totalMessageContent.split(' ').length} words`);

    let lastChunk: string | undefined = undefined;

    const dataStream: any = (/* mock createDataStream */ () => { return { writeData: () => {}, writeMessageAnnotation: () => {} }; })({
      async execute(dataStream) {
        streamRecovery.startMonitoring();

        // Orchestrator Mode Hijack
        if (useOrchestrator) {
          try {
            const messageMap = messages.filter((m) => m.role === 'user').pop();
            const userQuery = typeof messageMap?.content === 'string' ? messageMap.content : '';

            // Delegate to Orchestrator service
            const { orchestratorService } = await import('~/lib/services/orchestratorService');

            await orchestratorService.processRequest(
              userQuery as string,
              generateId(),
              dataStream as unknown as Parameters<typeof orchestratorService.processRequest>[2],
              messages,
              apiKeys,
              streamRecovery,
            );

            streamRecovery.stop();

            return;
          } catch (error) {
            logger.error('Orchestrator failed:', error);
            dataStream.writeData({
              type: 'progress',
              label: 'system',
              status: 'failed',
              message: error instanceof Error ? error.message : String(error),
            });

            return;
          }
        }

        const filePaths = getFilePaths(files || {});
        let filteredFiles: FileMap | undefined;
        let summary: string | undefined;
        let messageSliceId = 0;

        // Process invocations via Orchestration Service
        const processedMessages = await chatOrchestrationService.processInvocations(messages, dataStream, useAgentMode);

        if (processedMessages.length > 3) {
          messageSliceId = processedMessages.length - 3;
        }

        if (filePaths.length > 0 && contextOptimization) {
          const contextResult = await contextService.prepareContext({
            messages: [...processedMessages],
            files,
            promptId,
            contextOptimization,
            apiKeys,
            providerSettings,
            context,
            dataStream,
            cumulativeUsage,
          });
          summary = contextResult.summary;
          filteredFiles = contextResult.filteredFiles;
        }

        // Prepare session tools and agent state via Orchestration Service
        const { combinedTools } = await chatOrchestrationService.prepareChatSession({
          agentMode: agentMode ?? false,
          dataStream,
          messages: [...processedMessages],
        });

        const options: StreamingOptions = {
          supabaseConnection: supabase,
          toolChoice: 'auto',
          tools: combinedTools,
          maxSteps: maxLLMSteps,
          agentMode: !!useAgentMode,
          agentSystemPrompt: useAgentMode ? getAgentSystemPrompt() : undefined,
          onStepFinish: ({ toolCalls }) => {
            toolCalls.forEach((toolCall) => {
              chatOrchestrationService.handleStepFinish([toolCall], dataStream, !!useAgentMode);
            });
          },
          onFinish: async ({ text: content, finishReason, usage }) => {
            logger.debug('usage', JSON.stringify(usage));

            if (usage) {
              cumulativeUsage.completionTokens += usage.completionTokens || 0;
              cumulativeUsage.promptTokens += usage.promptTokens || 0;
              cumulativeUsage.totalTokens += usage.totalTokens || 0;
            }

            if (finishReason !== 'length') {
              dataStream.writeMessageAnnotation({
                type: 'usage',
                value: {
                  completionTokens: cumulativeUsage.completionTokens,
                  promptTokens: cumulativeUsage.promptTokens,
                  totalTokens: cumulativeUsage.totalTokens,
                },
              });
              dataStream.writeData({
                type: 'progress',
                label: 'response',
                status: 'complete',
                order: progressCounter++,
                message: 'Response Generated',
              } satisfies ProgressAnnotation);
              await new Promise((resolve) => setTimeout(resolve, 0));

              // stream.close();
              return;
            }

            if (stream.switches >= MAX_RESPONSE_SEGMENTS) {
              throw Error('Cannot continue message: Maximum segments reached');
            }

            const switchesLeft = MAX_RESPONSE_SEGMENTS - stream.switches;

            logger.info(`Reached max token limit (${MAX_TOKENS}): Continuing message (${switchesLeft} switches left)`);

            const lastUserMessage = processedMessages.filter((x) => x.role == 'user').slice(-1)[0];
            const { model, provider } = extractPropertiesFromMessage(lastUserMessage);
            processedMessages.push({ id: generateId(), role: 'assistant', content });
            processedMessages.push({
              id: generateId(),
              role: 'user',
              content: `[Model: ${model}]\n\n[Provider: ${provider}]\n\n${CONTINUE_PROMPT}`,
            });

            const result = await streamText({
              messages: [...processedMessages],
              env: process.env,
              options,
              apiKeys,
              files,
              providerSettings,
              promptId,
              contextOptimization,
              contextFiles: filteredFiles,
              chatMode,
              designScheme,
              summary,
              messageSliceId,
            });

            result.mergeIntoDataStream(dataStream);

            (async () => {
              for await (const part of result.fullStream) {
                if (part.type === 'error') {
                  logger.error(`Stream continuation error: ${part.error}`);

                  return;
                }
              }
            })().catch((err) => logger.error('Stream continuation processing failed:', err));

            return;
          },
        };

        dataStream.writeData({
          type: 'progress',
          label: 'response',
          status: 'in-progress',
          order: progressCounter++,
          message: 'Generating Response',
        } satisfies ProgressAnnotation);

        const result = await streamText({
          messages: [...processedMessages],
          env: process.env,
          options,
          apiKeys,
          files,
          providerSettings,
          promptId,
          contextOptimization,
          contextFiles: filteredFiles,
          chatMode,
          designScheme,
          summary,
          messageSliceId,
        });

        (async () => {
          for await (const part of result.fullStream) {
            streamRecovery.updateActivity();

            if (part.type === 'error') {
              const error = part.error instanceof Error ? part.error : new Error(String(part.error));
              logger.error('Streaming error:', error);
              streamRecovery.stop();

              // Enhanced error handling for common streaming issues
              if (error.message?.includes('Invalid JSON response')) {
                logger.error('Invalid JSON response detected - likely malformed API response');
              } else if (error.message?.includes('token')) {
                logger.error('Token-related error detected - possible token limit exceeded');
              }

              return;
            }
          }
          streamRecovery.stop();
        })().catch((err) => logger.error('Stream processing failed:', err));
        result.mergeIntoDataStream(dataStream);
      },
      onError: (error: unknown) => handleApiError(error, 'api.chat (streaming)').statusText,
    }).pipeThrough(
      new TransformStream({
        transform: (chunk, controller) => {
          if (!lastChunk) {
            lastChunk = ' ';
          }

          if (typeof chunk === 'string') {
            if (chunk.startsWith('g') && !lastChunk.startsWith('g')) {
              controller.enqueue(encoder.encode(`0: "<div class=\\"__boltThought__\\">"\n`));
            }

            if (lastChunk.startsWith('g') && !chunk.startsWith('g')) {
              controller.enqueue(encoder.encode(`0: "</div>\\n"\n`));
            }
          }

          lastChunk = chunk;

          let transformedChunk = chunk;

          if (typeof chunk === 'string' && chunk.startsWith('g')) {
            let content = chunk.split(':').slice(1).join(':');

            if (content.endsWith('\n')) {
              content = content.slice(0, content.length - 1);
            }

            transformedChunk = `0:${content}\n`;
          }

          // Convert the string stream to a byte stream
          const str = typeof transformedChunk === 'string' ? transformedChunk : JSON.stringify(transformedChunk);
          controller.enqueue(encoder.encode(str));
        },
      }),
    );

    return new Response(dataStream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        Connection: 'keep-alive',
        'Cache-Control': 'no-cache',
        'Text-Encoding': 'chunked',
      },
    });
  } catch (rawError: unknown) {
    const error = rawError as Error & { statusCode?: number; isRetryable?: boolean; provider?: string };
    logger.error(error);

    const errorResponse = {
      error: true,
      message: error.message || 'An unexpected error occurred',
      statusCode: error.statusCode || 500,
      isRetryable: error.isRetryable !== false, // Default to retryable unless explicitly false
      provider: error.provider || 'unknown',
    };

    if (error.message?.includes('API key')) {
      return new Response(
        JSON.stringify({
          ...errorResponse,
          message: 'Invalid or missing API key',
          statusCode: 401,
          isRetryable: false,
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
          statusText: 'Unauthorized',
        },
      );
    }

    return new Response(JSON.stringify(errorResponse), {
      status: errorResponse.statusCode,
      headers: { 'Content-Type': 'application/json' },
      statusText: 'Error',
    });
  }
}
