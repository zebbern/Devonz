import crypto from 'crypto';
import type { any /* DataStreamWriter */, CoreMessage as UIMessage } from 'ai';
import { type FileMap } from '~/lib/.server/llm/constants';
import { createSummary } from '~/lib/.server/llm/create-summary';
import { getFilePaths, selectContext } from '~/lib/.server/llm/select-context';
import type { ContextAnnotation, ProgressAnnotation } from '~/types/context';
import type { IProviderSetting } from '~/types/model';
import { WORK_DIR } from '~/utils/constants';
import { createScopedLogger } from '~/utils/logger';
import { RAGService } from './ragService';
import { redisService } from './redisService';

interface AppContext {
  cloudflare?: {
    env: Record<string, string | undefined>;
  };
}

const logger = createScopedLogger('ContextService');

export interface ContextResult {
  summary?: string;
  filteredFiles?: FileMap;
}

export interface PrepareContextOptions {
  messages: Message[];
  files: FileMap;
  promptId?: string;
  contextOptimization: boolean;
  apiKeys: Record<string, string>;
  providerSettings: Record<string, IProviderSetting>;
  context: AppContext; // Remix context (env)
  dataStream: any /* DataStreamWriter */;
  cumulativeUsage: {
    completionTokens: number;
    promptTokens: number;
    totalTokens: number;
  };
}

export class ContextService {
  private static _instance: ContextService;

  // Private constructor for singleton pattern
  private constructor() {
    // Intentional empty constructor
  }

  static getInstance(): ContextService {
    if (!ContextService._instance) {
      ContextService._instance = new ContextService();
    }

    return ContextService._instance;
  }

  async prepareContext(options: PrepareContextOptions): Promise<ContextResult> {
    const {
      messages,
      files,
      promptId,
      contextOptimization,
      apiKeys,
      providerSettings,
      context,
      dataStream,
      cumulativeUsage,
    } = options;

    const filePaths = getFilePaths(files || {});
    let filteredFiles: FileMap | undefined = undefined;
    let summary: string | undefined = undefined;
    let progressCounter = 1;

    /*
     * Use a simplified counter starting from existing stream state if possible?
     * For now, we'll assume the caller passes a stream where we can just write events.
     * Note: The original code used a shared progressCounter from the parent scope.
     * We might need to handle ordering better if that matters strictly.
     */

    if (filePaths.length > 0 && contextOptimization) {
      logger.debug('Generating Chat Summary');
      dataStream.writeData({
        type: 'progress',
        label: 'summary',
        status: 'in-progress',
        order: progressCounter++,
        message: 'Analysing Request',
      } satisfies ProgressAnnotation);

      // Create or retrieve summary of the chat
      const lastMessage = messages.at(-1)?.content || '';
      const cacheKey = `summary:${crypto.createHash('md5').update(lastMessage).digest('hex')}`;

      try {
        summary = (await redisService.get(cacheKey)) ?? undefined;
      } catch (error) {
        logger.warn('Failed to retrieve summary from cache', error);
      }

      if (summary) {
        logger.info('Retrieved summary from Redis cache');
        dataStream.writeMessageAnnotation({
          type: 'chatSummary',
          summary,
          chatId: messages.slice(-1)?.[0]?.id,
        } as ContextAnnotation);
      } else {
        logger.debug(`Messages count: ${messages.length}`);

        try {
          summary = await createSummary({
            messages: [...messages],
            env: context.cloudflare?.env,
            apiKeys,
            providerSettings,
            promptId,
            contextOptimization,
            onFinish(resp) {
              if (resp.usage) {
                logger.debug('createSummary token usage', JSON.stringify(resp.usage));
                cumulativeUsage.completionTokens += resp.usage.completionTokens || 0;
                cumulativeUsage.promptTokens += resp.usage.promptTokens || 0;
                cumulativeUsage.totalTokens += resp.usage.totalTokens || 0;
              }
            },
          });

          if (summary) {
            try {
              const DEFAULT_TTL = 3600; // 1 hour
              await redisService.set(cacheKey, summary, DEFAULT_TTL);
              logger.info('Saved summary to Redis cache');
            } catch (error) {
              logger.warn('Failed to cache summary', error);
            }
          }

          dataStream.writeMessageAnnotation({
            type: 'chatSummary',
            summary,
            chatId: messages.slice(-1)?.[0]?.id,
          } as ContextAnnotation);
        } catch (error) {
          logger.error('Failed to create summary', error);

          // Fallback: Proceed without summary rather than crashing
        }
      }

      dataStream.writeData({
        type: 'progress',
        label: 'summary',
        status: 'complete',
        order: progressCounter++,
        message: 'Analysis Complete',
      } satisfies ProgressAnnotation);

      // Update context buffer
      logger.debug('Updating Context Buffer');
      dataStream.writeData({
        type: 'progress',
        label: 'context',
        status: 'in-progress',
        order: progressCounter++,
        message: 'Determining Files to Read',
      } satisfies ProgressAnnotation);

      // Select context files
      logger.debug(`Messages count: ${messages.length}`);

      try {
        filteredFiles = await selectContext({
          messages: [...messages],
          env: context.cloudflare?.env,
          apiKeys,
          files,
          providerSettings,
          promptId,
          contextOptimization,
          summary: summary || '',
          onFinish(resp) {
            if (resp.usage) {
              logger.debug('selectContext token usage', JSON.stringify(resp.usage));
              cumulativeUsage.completionTokens += resp.usage.completionTokens || 0;
              cumulativeUsage.promptTokens += resp.usage.promptTokens || 0;
              cumulativeUsage.totalTokens += resp.usage.totalTokens || 0;
            }
          },
        });
      } catch (error) {
        logger.error('Failed to select context files', error);

        /*
         * Fallback: Use all files if selection fails? Or minimal set?
         * Original logic didn't fallback, just threw or continued.
         * We'll proceed with undefined filteredFiles which usually defaults to basic behavior.
         */
      }

      if (filteredFiles) {
        logger.debug(`files in context : ${JSON.stringify(Object.keys(filteredFiles))}`);
      }

      const contextFiles = filteredFiles ? Object.keys(filteredFiles) : [];

      dataStream.writeMessageAnnotation({
        type: 'codeContext',
        files: contextFiles.map((key) => {
          let path = key;

          if (path.startsWith(WORK_DIR)) {
            path = path.replace(WORK_DIR, '');
          }

          return path;
        }),
      } as ContextAnnotation);

      dataStream.writeData({
        type: 'progress',
        label: 'context',
        status: 'complete',
        order: progressCounter++,
        message: 'Code Files Selected',
      } satisfies ProgressAnnotation);

      // RAG Integration: If still missing context or large project, query RAG
      if (contextOptimization) {
        logger.debug('Querying RAG for additional context');

        try {
          const lastMessageContent = messages.at(-1)?.content || '';
          const ragContext = await RAGService.getInstance().query(promptId || 'default', lastMessageContent);

          if (ragContext && ragContext.length > 0) {
            summary = (summary || '') + '\n\nRelevant Code Snippets from RAG:\n' + ragContext.join('\n\n');
          }
        } catch (error) {
          logger.error('RAG query failed', error);

          // Non-critical, continue without RAG context
        }
      }
    }

    return { summary, filteredFiles };
  }
}

export const contextService = ContextService.getInstance();
