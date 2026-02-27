import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { LanguageModel } from 'ai';
import type { IProviderSetting } from '~/types/model';
import { createAnthropic } from '@ai-sdk/anthropic';

export default class AnthropicProvider extends BaseProvider {
  name = 'Anthropic';
  getApiKeyLink = 'https://console.anthropic.com/settings/keys';

  config = {
    apiTokenKey: 'ANTHROPIC_API_KEY',
  };

  staticModels: ModelInfo[] = [
    // Claude Opus 4.6: Flagship (February 5, 2026) — 200k context, 128k output
    {
      name: 'claude-opus-4-6',
      label: 'Claude Opus 4.6',
      provider: 'Anthropic',
      maxTokenAllowed: 200000,
      maxCompletionTokens: 128000,
    },

    // Claude Sonnet 4.6: Balanced (February 17, 2026) — 200k context, 64k output
    {
      name: 'claude-sonnet-4-6',
      label: 'Claude Sonnet 4.6',
      provider: 'Anthropic',
      maxTokenAllowed: 200000,
      maxCompletionTokens: 64000,
    },

    // Claude Haiku 4.5: Fast and cost-efficient (October 15, 2025) — 200k context
    {
      name: 'claude-haiku-4-5-20251015',
      label: 'Claude Haiku 4.5',
      provider: 'Anthropic',
      maxTokenAllowed: 200000,
      maxCompletionTokens: 32000,
    },
  ];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv?: Record<string, string>,
  ): Promise<ModelInfo[]> {
    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: settings,
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'ANTHROPIC_API_KEY',
    });

    if (!apiKey) {
      throw `Missing Api Key configuration for ${this.name} provider`;
    }

    const response = await fetch(`https://api.anthropic.com/v1/models`, {
      headers: {
        'x-api-key': `${apiKey}`,
        'anthropic-version': '2023-06-01',
      },
    });

    const res = (await response.json()) as any;
    const staticModelIds = this.staticModels.map((m) => m.name);

    const data = res.data.filter((model: any) => model.type === 'model' && !staticModelIds.includes(model.id));

    return data.map((m: any) => {
      // Get accurate context window from Anthropic API
      let contextWindow = 32000; // default fallback

      // Anthropic provides max_tokens in their API response
      if (m.max_tokens) {
        contextWindow = m.max_tokens;
      } else if (m.id?.includes('claude-3-5-sonnet')) {
        contextWindow = 200000; // Claude 3.5 Sonnet has 200k context
      } else if (m.id?.includes('claude-3-haiku')) {
        contextWindow = 200000; // Claude 3 Haiku has 200k context
      } else if (m.id?.includes('claude-3-opus')) {
        contextWindow = 200000; // Claude 3 Opus has 200k context
      } else if (m.id?.includes('claude-3-sonnet')) {
        contextWindow = 200000; // Claude 3 Sonnet has 200k context
      }

      // Determine completion token limits based on specific model
      let maxCompletionTokens = 128000; // default for older Claude 3 models

      if (m.id?.includes('claude-opus-4')) {
        maxCompletionTokens = 32000; // Claude 4 Opus: 32K output limit
      } else if (m.id?.includes('claude-sonnet-4')) {
        maxCompletionTokens = 64000; // Claude 4 Sonnet: 64K output limit
      } else if (m.id?.includes('claude-4')) {
        maxCompletionTokens = 32000; // Other Claude 4 models: conservative 32K limit
      }

      return {
        name: m.id,
        label: `${m.display_name} (${Math.floor(contextWindow / 1000)}k context)`,
        provider: this.name,
        maxTokenAllowed: contextWindow,
        maxCompletionTokens,
      };
    });
  }

  getModelInstance: (options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }) => LanguageModel = (options) => {
    const { apiKeys, providerSettings, serverEnv, model } = options;
    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings,
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'ANTHROPIC_API_KEY',
    });
    const anthropic = createAnthropic({
      apiKey,
    });

    return anthropic(model);
  };
}
