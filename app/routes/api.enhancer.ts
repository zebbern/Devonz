import { type ActionFunctionArgs } from '@remix-run/node';
import { generateText } from 'ai';
import { stripIndents } from '~/utils/stripIndent';
import type { ProviderInfo } from '~/types/model';
import { getApiKeysFromCookie, getProviderSettingsFromCookie } from '~/lib/api/cookies';
import { createScopedLogger } from '~/utils/logger';
import { z } from 'zod';
import { withSecurity } from '~/lib/security';
import { providerSchema } from '~/lib/api/schemas';
import { DEFAULT_PROVIDER, PROVIDER_LIST } from '~/utils/constants';
import { resolveModel } from '~/lib/.server/llm/resolve-model';

export const action = withSecurity(enhancerAction, {
  allowedMethods: ['POST'],
  rateLimit: false,
});

const logger = createScopedLogger('api.enhancer');

// providerSchema imported from ~/lib/api/schemas

const enhancerRequestSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  model: z.string().min(1, 'Model is required'),
  provider: providerSchema,
  apiKeys: z.record(z.string()).optional(),
});

async function enhancerAction({ context, request }: ActionFunctionArgs) {
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

  const parsed = enhancerRequestSchema.safeParse(rawBody);

  if (!parsed.success) {
    logger.warn('Enhancer request validation failed:', parsed.error.issues);

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

  const { message, model, provider } = parsed.data as {
    message: string;
    model: string;
    provider: ProviderInfo;
    apiKeys?: Record<string, string>;
  };

  const { name: providerName } = provider;

  const cookieHeader = request.headers.get('Cookie');
  const apiKeys = getApiKeysFromCookie(cookieHeader);
  const providerSettings = getProviderSettingsFromCookie(cookieHeader);

  // Resolve the provider and model for generateText
  const resolvedProvider = PROVIDER_LIST.find((p) => p.name === providerName) || DEFAULT_PROVIDER;
  const modelDetails = await resolveModel({
    provider: resolvedProvider,
    currentModel: model,
    apiKeys,
    providerSettings,
    serverEnv: context.cloudflare?.env,
    logger,
  });

  try {
    const result = await generateText({
      model: resolvedProvider.getModelInstance({
        model: modelDetails.name,
        serverEnv: context.cloudflare?.env,
        apiKeys,
        providerSettings,
      }),
      system:
        "You are a prompt engineer for an AI web app builder. The builder runs locally with Node.js and creates complete apps using React (default), Vue, Svelte, or Angular with Tailwind CSS. Apps use local state management and seed data — never external APIs with API keys. Your job: take the user's idea and produce a clear, specific, buildable prompt. Output ONLY the enhanced prompt text.",
      prompt: stripIndents`
        Enhance the user's prompt so an AI coding assistant can build a complete, working app in one response.

        <original_prompt>
          ${message}
        </original_prompt>

        Enhancement rules:
        1. PRESERVE the user's core intent — do NOT change what they want to build
        2. If the app has multiple pages/views, LIST each page and its purpose explicitly
        3. For data-driven apps, DEFINE the data model (entity names, key fields, relationships)
        4. Specify interactive features: CRUD operations, filters, search, sorting, modals, form validation
        5. Add a brief design direction ONLY if the user gave none (e.g., "clean minimal dark theme with blue accents")
        6. Mention responsive behavior: sidebar collapses on mobile, grid stacks to single column, etc.
        7. If the app needs sample data, say "populate with realistic seed data" — NEVER suggest external API calls
        8. Keep the enhanced prompt concise — add only details that prevent ambiguity
        9. NEVER add: external APIs, API keys, deployment, hosting, CI/CD, testing, or authentication unless the user asked for it
        10. Output ONLY the enhanced prompt — no explanations, headers, or wrapper tags
      `,
    });

    return new Response(result.text, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch (error: unknown) {
    logger.error(error);

    if (error instanceof Error && error.message?.includes('API key')) {
      throw new Response('Invalid or missing API key', {
        status: 401,
        statusText: 'Unauthorized',
      });
    }

    throw new Response(null, {
      status: 500,
      statusText: 'Internal Server Error',
    });
  }
}
