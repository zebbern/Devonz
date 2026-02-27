import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export default class XAIProvider extends BaseProvider {
  name = 'xAI';
  getApiKeyLink = 'https://docs.x.ai/docs/quickstart#creating-an-api-key';

  config = {
    apiTokenKey: 'XAI_API_KEY',
  };

  staticModels: ModelInfo[] = [
    // Grok 4: Latest flagship (256k context)
    { name: 'grok-4', label: 'Grok 4', provider: 'xAI', maxTokenAllowed: 256000, maxCompletionTokens: 32768 },

    // Grok 3: Standard model (131k context)
    { name: 'grok-3', label: 'Grok 3', provider: 'xAI', maxTokenAllowed: 131000, maxCompletionTokens: 16384 },

    // Grok 3 Mini: Fast and cost-efficient (131k context)
    { name: 'grok-3-mini', label: 'Grok 3 Mini', provider: 'xAI', maxTokenAllowed: 131000, maxCompletionTokens: 8192 },
  ];

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModel {
    const { model, serverEnv, apiKeys, providerSettings } = options;

    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'XAI_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const openai = createOpenAI({
      baseURL: 'https://api.x.ai/v1',
      apiKey,
    });

    return openai(model);
  }
}
