import { json, type ActionFunctionArgs } from '@remix-run/node';
import { generateId } from 'ai';
import { z } from 'zod';
import { createScopedLogger } from '~/utils/logger';
import { orchestratorService } from '~/lib/services/orchestratorService';
import { rateLimitService } from '~/lib/services/rateLimitService';
import { withSecurity } from '~/lib/security.server';

const logger = createScopedLogger('api.agent.chat');

const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.string(),
        content: z.string(),
      }),
    )
    .min(1),
  conversationId: z.string().optional(),
});

export const action = withSecurity(async ({ request }: ActionFunctionArgs) => {
  try {
    // 1. Rate Limiting (IP-based for now, or User ID if available)
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown';
    const isAllowed = await rateLimitService.check(clientIp, { windowMs: 60 * 1000, maxRequests: 10 });

    if (!isAllowed) {
      return json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
    }

    // 2. Input Validation
    const rawBody = await request.json();
    const validation = chatSchema.safeParse(rawBody);

    if (!validation.success) {
      return json({ error: 'Invalid request format', details: validation.error.format() }, { status: 400 });
    }

    const { messages, conversationId } = validation.data;
    const lastMessage = messages[messages.length - 1];
    const userRequest = lastMessage.content;
    const threadId = conversationId || generateId();

    logger.info(`Starting Agent Chat for thread: ${threadId}`);

    const dataStream: any = (/* mock createDataStream */ () => { return { writeData: () => {}, writeMessageAnnotation: () => {} }; })({
      async execute(dataStream) {
        try {
          // Adapt the AI SDK DataStream to the Orchestrator's expected interface
          const streamAdapter = {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            writeData: (data: any) => dataStream.writeData(data),
            writeText: (text: string) => dataStream.writeMessageAnnotation({ type: 'text', value: text }),

            // Use writeMessageAnnotation for text chunks since append isn't available
            append: (text: string) => dataStream.writeMessageAnnotation({ type: 'text', value: text }),
          };

          await orchestratorService.processRequest(
            userRequest,
            threadId,
            streamAdapter,
            messages,
            {}, // API keys handled by env vars
            undefined, // streamRecovery
            request.signal, // Pass cancellation signal
          );
        } catch (error) {
          logger.error('Agent execution failed:', error);
          dataStream.writeData({
            type: 'progress',
            label: 'system',
            status: 'failed',
            message: error instanceof Error ? error.message : 'Unknown agent error',
          });
        }
      },
      onError: (error) => {
        logger.error('Stream error:', error);
        return error instanceof Error ? error.message : 'Stream failed';
      },
    });

    return new Response(dataStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    logger.error('API Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
});
