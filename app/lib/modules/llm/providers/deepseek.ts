import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createDeepSeek } from '@ai-sdk/deepseek';

export default class DeepseekProvider extends BaseProvider {
  name = 'Deepseek';
  getApiKeyLink = 'https://platform.deepseek.com/apiKeys';

  config = {
    apiTokenKey: 'DEEPSEEK_API_KEY',
  };

  staticModels: ModelInfo[] = [
    // DeepSeek V3.2 Chat: General-purpose model (128k context)
    {
      name: 'deepseek-chat',
      label: 'DeepSeek Chat (V3.2)',
      provider: 'Deepseek',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 8192,
    },

    // DeepSeek V3.2 Reasoner: Multi-step reasoning model (128k context)
    {
      name: 'deepseek-reasoner',
      label: 'DeepSeek Reasoner (V3.2)',
      provider: 'Deepseek',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 8192,
    },

    // DeepSeek Coder: Code generation specialist (128k context)
    {
      name: 'deepseek-coder',
      label: 'DeepSeek Coder',
      provider: 'Deepseek',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 8192,
    },
  ];

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv, apiKeys, providerSettings } = options;

    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'DEEPSEEK_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const deepseek = createDeepSeek({
      apiKey,
    });

    return deepseek(model, {
      // simulateStreaming: true,
    });
  }
}
