import { atom, map, type MapStore } from 'nanostores';
import Cookies from 'js-cookie';
import { PROVIDER_LIST } from '~/utils/constants';
import type { IProviderConfig, IProviderSetting } from '~/types/model';
import type { TabVisibilityConfig, TabWindowConfig, UserTabConfig } from '~/components/@settings/core/types';
import { DEFAULT_TAB_CONFIG } from '~/components/@settings/core/constants';
import { toggleTheme } from './theme';
import { createScopedLogger } from '~/utils/logger';
import {
  acceptAllWithCheckpoint,
  rejectAllChanges as rejectAllStagingChanges,
  openDiffModal,
  selectNextChange,
  selectPreviousChange,
  hasPendingChanges,
  pendingChanges,
} from './staging';

export interface Shortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  ctrlOrMetaKey?: boolean;
  action: () => void;
  description?: string; // Description of what the shortcut does
  isPreventDefault?: boolean; // Whether to prevent default browser behavior
}

const logger = createScopedLogger('SettingsStore');

export interface Shortcuts {
  toggleTheme: Shortcut;
  toggleTerminal: Shortcut;
  acceptAllChanges: Shortcut;
  rejectAllChanges: Shortcut;
  openDiffPreview: Shortcut;
  nextChange: Shortcut;
  previousChange: Shortcut;
}

export const LOCAL_PROVIDERS = ['OpenAILike', 'LMStudio', 'Ollama'];

export type ProviderSetting = Record<string, IProviderConfig>;

// Simplified shortcuts store with only theme toggle
export const shortcutsStore = map<Shortcuts>({
  toggleTheme: {
    key: 'd',
    metaKey: true,
    altKey: true,
    shiftKey: true,
    action: () => toggleTheme(),
    description: 'Toggle theme',
    isPreventDefault: true,
  },
  toggleTerminal: {
    key: '`',
    ctrlOrMetaKey: true,
    action: () => {
      // This will be handled by the terminal component
    },
    description: 'Toggle terminal',
    isPreventDefault: true,
  },
  acceptAllChanges: {
    key: 'Enter',
    ctrlOrMetaKey: true,
    shiftKey: true,
    action: () => {
      if (hasPendingChanges.get()) {
        acceptAllWithCheckpoint();
      }
    },
    description: 'Accept all pending changes',
    isPreventDefault: true,
  },
  rejectAllChanges: {
    key: 'Backspace',
    ctrlOrMetaKey: true,
    shiftKey: true,
    action: () => {
      if (hasPendingChanges.get()) {
        rejectAllStagingChanges();
      }
    },
    description: 'Reject all pending changes',
    isPreventDefault: true,
  },
  openDiffPreview: {
    key: 'd',
    ctrlOrMetaKey: true,
    shiftKey: true,
    action: () => {
      const pending = pendingChanges.get();

      if (pending.length > 0) {
        openDiffModal(pending[0].filePath);
      }
    },
    description: 'Open diff preview for first pending change',
    isPreventDefault: true,
  },
  nextChange: {
    key: ']',
    ctrlOrMetaKey: false,
    action: () => {
      selectNextChange();
    },
    description: 'Navigate to next pending change',
    isPreventDefault: false,
  },
  previousChange: {
    key: '[',
    ctrlOrMetaKey: false,
    action: () => {
      selectPreviousChange();
    },
    description: 'Navigate to previous pending change',
    isPreventDefault: false,
  },
});

// Create a single key for provider settings
const PROVIDER_SETTINGS_KEY = 'provider_settings';
const AUTO_ENABLED_KEY = 'auto_enabled_providers';

// Add this helper function at the top of the file
const isBrowser = typeof window !== 'undefined';

// Interface for configured provider info from server
interface ConfiguredProvider {
  name: string;
  isConfigured: boolean;
  configMethod: 'environment' | 'none';
}

// Env key status per provider (does the server have an env var for this provider?)
export interface EnvKeyStatus {
  hasEnvKey: boolean;
  hasCookieKey: boolean;
}

/*
 * Store for env key status - tracks which providers have server-side API keys.
 * Preserved across Vite HMR to avoid re-fetching from server.
 */
export const envKeyStatusStore: MapStore<Record<string, EnvKeyStatus>> =
  import.meta.hot?.data.envKeyStatusStore ?? map<Record<string, EnvKeyStatus>>({});

/*
 * Preferred models store - maps provider name → preferred model name.
 * Shared between CloudProviderCard (settings) and CombinedModelSelector (chat).
 */
const preferredModelsCookie = isBrowser ? Cookies.get('preferredModels') : undefined;
const initialPreferredModels: Record<string, string> = preferredModelsCookie
  ? (() => {
      try {
        return JSON.parse(preferredModelsCookie);
      } catch {
        return {};
      }
    })()
  : {};

export const preferredModelsStore = map<Record<string, string>>(initialPreferredModels);

/**
 * Update the preferred model for a provider.
 * Syncs to both the nanostores map and the cookie.
 */
export function updatePreferredModel(providerName: string, modelName: string) {
  if (modelName) {
    preferredModelsStore.setKey(providerName, modelName);
  } else {
    // Remove the entry for this provider
    const current = { ...preferredModelsStore.get() };
    delete current[providerName];
    preferredModelsStore.set(current);
  }

  if (isBrowser) {
    Cookies.set('preferredModels', JSON.stringify(preferredModelsStore.get()), { expires: 30 });
  }
}

const ENV_KEY_CACHE_KEY = 'envKeyStatusCache';

/**
 * Fetch env key status for all providers from the server.
 * Uses sessionStorage to avoid redundant API calls within the same browser session.
 * Populates envKeyStatusStore and auto-enables providers with server-side env keys.
 */
export const checkCloudProviderEnvKeys = async (forceRefresh = false) => {
  if (!isBrowser) {
    return;
  }

  // Check sessionStorage cache first (skip if force refreshing)
  if (!forceRefresh) {
    try {
      const cached = sessionStorage.getItem(ENV_KEY_CACHE_KEY);

      if (cached) {
        const data = JSON.parse(cached) as Record<string, EnvKeyStatus>;
        envKeyStatusStore.set(data);
        logger.info('Loaded env key status from session cache');

        return;
      }
    } catch {
      // Ignore parse errors, proceed to fetch
    }
  }

  try {
    const response = await fetch('/api/check-env-keys');

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as Record<string, EnvKeyStatus>;
    envKeyStatusStore.set(data);

    // Cache in sessionStorage for this browser session
    try {
      sessionStorage.setItem(ENV_KEY_CACHE_KEY, JSON.stringify(data));
    } catch {
      // sessionStorage may be full or unavailable
    }

    // Auto-enable providers with server-side env keys (if no saved settings override)
    const currentSettings = providersStore.get();
    const savedSettings = localStorage.getItem(PROVIDER_SETTINGS_KEY);
    let hasChanges = false;

    Object.entries(data).forEach(([providerName, status]) => {
      if (status.hasEnvKey && !LOCAL_PROVIDERS.includes(providerName)) {
        const currentProvider = currentSettings[providerName];

        if (currentProvider && !currentProvider.settings.enabled && !savedSettings) {
          // Only auto-enable on first use (no saved settings)
          currentSettings[providerName] = {
            ...currentProvider,
            settings: { ...currentProvider.settings, enabled: true },
          };
          hasChanges = true;
        }
      }
    });

    if (hasChanges) {
      providersStore.set(currentSettings);
      localStorage.setItem(PROVIDER_SETTINGS_KEY, JSON.stringify(currentSettings));
      logger.info('Auto-enabled providers with server-side env keys');
    }
  } catch (error) {
    logger.error('Error checking env keys:', error);
  }
};

// Fetch configured providers from server
const fetchConfiguredProviders = async (): Promise<ConfiguredProvider[]> => {
  try {
    const response = await fetch('/api/configured-providers');

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as { providers?: ConfiguredProvider[] };

    return data.providers || [];
  } catch (error) {
    logger.error('Error fetching configured providers:', error);
    return [];
  }
};

// Read API keys from the apiKeys cookie (shared with chat UI)
const getApiKeysFromCookie = (): Record<string, string> => {
  if (!isBrowser) {
    return {};
  }

  try {
    const raw = Cookies.get('apiKeys');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

// Initialize provider settings from both localStorage and server-detected configuration
const getInitialProviderSettings = (): ProviderSetting => {
  const initialSettings: ProviderSetting = {};

  // Read API keys from cookie for smart defaults
  const apiKeys = getApiKeysFromCookie();

  // Start with smart default settings
  PROVIDER_LIST.forEach((provider) => {
    const isLocal = LOCAL_PROVIDERS.includes(provider.name);
    const hasApiKey = Boolean(apiKeys[provider.name]?.trim());

    initialSettings[provider.name] = {
      ...provider,
      settings: {
        /*
         * Smart defaults:
         * - Local providers: always disabled by default
         * - Cloud providers WITH a saved API key: enabled
         * - Cloud providers WITHOUT a saved API key: disabled
         */
        enabled: isLocal ? false : hasApiKey,
      },
    };
  });

  // Only try to load from localStorage in the browser (overrides smart defaults)
  if (isBrowser) {
    const savedSettings = localStorage.getItem(PROVIDER_SETTINGS_KEY);

    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        Object.entries(parsed).forEach(([key, value]) => {
          if (initialSettings[key]) {
            initialSettings[key].settings = (value as IProviderConfig).settings;
          }
        });
      } catch (error) {
        logger.error('Error parsing saved provider settings:', error);
      }
    }
  }

  return initialSettings;
};

// Auto-enable providers that are configured on the server
const autoEnableConfiguredProviders = async () => {
  if (!isBrowser) {
    return;
  }

  try {
    const configuredProviders = await fetchConfiguredProviders();
    const currentSettings = providersStore.get();
    const savedSettings = localStorage.getItem(PROVIDER_SETTINGS_KEY);
    const autoEnabledProviders = localStorage.getItem(AUTO_ENABLED_KEY);

    // Track which providers were auto-enabled to avoid overriding user preferences
    const previouslyAutoEnabled = autoEnabledProviders ? JSON.parse(autoEnabledProviders) : [];
    const newlyAutoEnabled: string[] = [];

    let hasChanges = false;

    configuredProviders.forEach(({ name, isConfigured, configMethod }) => {
      if (isConfigured && configMethod === 'environment' && LOCAL_PROVIDERS.includes(name)) {
        const currentProvider = currentSettings[name];

        if (currentProvider) {
          /*
           * Only auto-enable if:
           * 1. Provider is not already enabled, AND
           * 2. Either we haven't saved settings yet (first time) OR provider was previously auto-enabled
           */
          const hasUserSettings = savedSettings !== null;
          const wasAutoEnabled = previouslyAutoEnabled.includes(name);
          const shouldAutoEnable = !currentProvider.settings.enabled && (!hasUserSettings || wasAutoEnabled);

          if (shouldAutoEnable) {
            currentSettings[name] = {
              ...currentProvider,
              settings: {
                ...currentProvider.settings,
                enabled: true,
              },
            };
            newlyAutoEnabled.push(name);
            hasChanges = true;
          }
        }
      }
    });

    if (hasChanges) {
      // Update the store
      providersStore.set(currentSettings);

      // Save to localStorage
      localStorage.setItem(PROVIDER_SETTINGS_KEY, JSON.stringify(currentSettings));

      // Update the auto-enabled providers list
      const allAutoEnabled = [...new Set([...previouslyAutoEnabled, ...newlyAutoEnabled])];
      localStorage.setItem(AUTO_ENABLED_KEY, JSON.stringify(allAutoEnabled));

      logger.info(`Auto-enabled providers: ${newlyAutoEnabled.join(', ')}`);
    }
  } catch (error) {
    logger.error('Error auto-enabling configured providers:', error);
  }
};

export const providersStore: MapStore<ProviderSetting> =
  import.meta.hot?.data.providersStore ?? map<ProviderSetting>(getInitialProviderSettings());

// Initialize providers when the module loads (in browser only, skip on HMR)
if (isBrowser && !import.meta.hot?.data.providersStore) {
  // Use a small delay to ensure DOM and other resources are ready
  setTimeout(() => {
    autoEnableConfiguredProviders();
    checkCloudProviderEnvKeys();
  }, 100);
}

// Preserve stores across Vite HMR updates
if (import.meta.hot) {
  import.meta.hot.data.envKeyStatusStore = envKeyStatusStore;
  import.meta.hot.data.providersStore = providersStore;
}

// Create a function to update provider settings that handles both store and persistence
export const updateProviderSettings = (provider: string, settings: IProviderSetting) => {
  const currentSettings = providersStore.get();

  // Create new provider config with updated settings
  const updatedProvider = {
    ...currentSettings[provider],
    settings: {
      ...currentSettings[provider].settings,
      ...settings,
    },
  };

  // Update the store with new settings
  providersStore.setKey(provider, updatedProvider);

  // Save to localStorage
  const allSettings = providersStore.get();
  localStorage.setItem(PROVIDER_SETTINGS_KEY, JSON.stringify(allSettings));

  // If this is a local provider, update the auto-enabled tracking
  if (LOCAL_PROVIDERS.includes(provider) && updatedProvider.settings.enabled !== undefined) {
    updateAutoEnabledTracking(provider, updatedProvider.settings.enabled);
  }
};

// Update auto-enabled tracking when user manually changes provider settings
const updateAutoEnabledTracking = (providerName: string, isEnabled: boolean) => {
  if (!isBrowser) {
    return;
  }

  try {
    const autoEnabledProviders = localStorage.getItem(AUTO_ENABLED_KEY);
    const currentAutoEnabled = autoEnabledProviders ? JSON.parse(autoEnabledProviders) : [];

    if (isEnabled) {
      // If user enables provider, add to auto-enabled list (for future detection)
      if (!currentAutoEnabled.includes(providerName)) {
        currentAutoEnabled.push(providerName);
        localStorage.setItem(AUTO_ENABLED_KEY, JSON.stringify(currentAutoEnabled));
      }
    } else {
      // If user disables provider, remove from auto-enabled list (respect user choice)
      const updatedAutoEnabled = currentAutoEnabled.filter((name: string) => name !== providerName);
      localStorage.setItem(AUTO_ENABLED_KEY, JSON.stringify(updatedAutoEnabled));
    }
  } catch (error) {
    logger.error('Error updating auto-enabled tracking:', error);
  }
};

export const isDebugMode = atom(false);

// Define keys for localStorage
const SETTINGS_KEYS = {
  LATEST_BRANCH: 'isLatestBranch',
  AUTO_SELECT_TEMPLATE: 'autoSelectTemplate',
  CONTEXT_OPTIMIZATION: 'contextOptimizationEnabled',
  EVENT_LOGS: 'isEventLogsEnabled',
  PROMPT_ID: 'promptId',
  DEVELOPER_MODE: 'isDeveloperMode',
  AUTO_SWITCH_TO_FILE: 'autoSwitchToFile',
  ENABLE_THINKING: 'enableThinking',
} as const;

// Initialize settings from localStorage or defaults
const getInitialSettings = () => {
  const getStoredBoolean = (key: string, defaultValue: boolean): boolean => {
    if (!isBrowser) {
      return defaultValue;
    }

    const stored = localStorage.getItem(key);

    if (stored === null) {
      return defaultValue;
    }

    try {
      return JSON.parse(stored);
    } catch {
      return defaultValue;
    }
  };

  return {
    latestBranch: getStoredBoolean(SETTINGS_KEYS.LATEST_BRANCH, false),
    autoSelectTemplate: getStoredBoolean(SETTINGS_KEYS.AUTO_SELECT_TEMPLATE, true),
    contextOptimization: getStoredBoolean(SETTINGS_KEYS.CONTEXT_OPTIMIZATION, true),
    eventLogs: getStoredBoolean(SETTINGS_KEYS.EVENT_LOGS, true),
    promptId: isBrowser ? localStorage.getItem(SETTINGS_KEYS.PROMPT_ID) || 'default' : 'default',
    developerMode: getStoredBoolean(SETTINGS_KEYS.DEVELOPER_MODE, false),
    autoSwitchToFile: getStoredBoolean(SETTINGS_KEYS.AUTO_SWITCH_TO_FILE, false),
    enableThinking: getStoredBoolean(SETTINGS_KEYS.ENABLE_THINKING, false),
  };
};

// Initialize stores with persisted values
const initialSettings = getInitialSettings();

export const latestBranchStore = atom<boolean>(initialSettings.latestBranch);
export const autoSelectStarterTemplate = atom<boolean>(initialSettings.autoSelectTemplate);
export const enableContextOptimizationStore = atom<boolean>(initialSettings.contextOptimization);
export const isEventLogsEnabled = atom<boolean>(initialSettings.eventLogs);
export const promptStore = atom<string>(initialSettings.promptId);
export const autoSwitchToFileStore = atom<boolean>(initialSettings.autoSwitchToFile);
export const enableThinkingStore = atom<boolean>(initialSettings.enableThinking);

// Helper functions to update settings with persistence
export const updateLatestBranch = (enabled: boolean) => {
  latestBranchStore.set(enabled);
  localStorage.setItem(SETTINGS_KEYS.LATEST_BRANCH, JSON.stringify(enabled));
};

export const updateAutoSwitchToFile = (enabled: boolean) => {
  autoSwitchToFileStore.set(enabled);
  localStorage.setItem(SETTINGS_KEYS.AUTO_SWITCH_TO_FILE, JSON.stringify(enabled));
};

export const updateEnableThinking = (enabled: boolean) => {
  enableThinkingStore.set(enabled);
  localStorage.setItem(SETTINGS_KEYS.ENABLE_THINKING, JSON.stringify(enabled));
};

export const updateAutoSelectTemplate = (enabled: boolean) => {
  autoSelectStarterTemplate.set(enabled);
  localStorage.setItem(SETTINGS_KEYS.AUTO_SELECT_TEMPLATE, JSON.stringify(enabled));
};

export const updateContextOptimization = (enabled: boolean) => {
  enableContextOptimizationStore.set(enabled);
  localStorage.setItem(SETTINGS_KEYS.CONTEXT_OPTIMIZATION, JSON.stringify(enabled));
};

export const updateEventLogs = (enabled: boolean) => {
  isEventLogsEnabled.set(enabled);
  localStorage.setItem(SETTINGS_KEYS.EVENT_LOGS, JSON.stringify(enabled));
};

export const updatePromptId = (id: string) => {
  promptStore.set(id);
  localStorage.setItem(SETTINGS_KEYS.PROMPT_ID, id);
};

// Initialize tab configuration from localStorage or defaults
const getInitialTabConfiguration = (): TabWindowConfig => {
  const defaultConfig: TabWindowConfig = {
    userTabs: DEFAULT_TAB_CONFIG.filter((tab): tab is UserTabConfig => tab.window === 'user'),
  };

  if (!isBrowser) {
    return defaultConfig;
  }

  try {
    const saved = localStorage.getItem('alinma_coder_tab_configuration');

    if (!saved) {
      return defaultConfig;
    }

    const parsed = JSON.parse(saved);

    if (!parsed?.userTabs) {
      return defaultConfig;
    }

    // Ensure proper typing of loaded configuration
    return {
      userTabs: parsed.userTabs.filter((tab: TabVisibilityConfig): tab is UserTabConfig => tab.window === 'user'),
    };
  } catch (error) {
    logger.warn('Failed to parse tab configuration:', error);
    return defaultConfig;
  }
};

export const tabConfigurationStore = map<TabWindowConfig>(getInitialTabConfiguration());

// Helper function to reset tab configuration
export const resetTabConfiguration = () => {
  const defaultConfig: TabWindowConfig = {
    userTabs: DEFAULT_TAB_CONFIG.filter((tab): tab is UserTabConfig => tab.window === 'user'),
  };

  tabConfigurationStore.set(defaultConfig);
  localStorage.setItem('alinma_coder_tab_configuration', JSON.stringify(defaultConfig));
};

// --- Model Routing Configuration ---

import type { ModelRoutingConfig } from '~/lib/.server/llm/model-router';

const MODEL_ROUTING_KEY = 'model_routing_config';

const getInitialModelRoutingConfig = (): ModelRoutingConfig => {
  if (!isBrowser) {
    return {};
  }

  try {
    const saved = localStorage.getItem(MODEL_ROUTING_KEY);

    if (!saved) {
      return {};
    }

    return JSON.parse(saved) as ModelRoutingConfig;
  } catch {
    return {};
  }
};

export const modelRoutingConfigStore = map<ModelRoutingConfig>(getInitialModelRoutingConfig());

// --- Blueprint Mode ---

const BLUEPRINT_MODE_KEY = 'blueprint_mode';

const getInitialBlueprintMode = (): boolean => {
  if (!isBrowser) {
    return false;
  }

  try {
    return localStorage.getItem(BLUEPRINT_MODE_KEY) === 'true';
  } catch {
    return false;
  }
};

export const blueprintModeStore = atom<boolean>(getInitialBlueprintMode());

export function setBlueprintMode(enabled: boolean) {
  blueprintModeStore.set(enabled);

  if (isBrowser) {
    localStorage.setItem(BLUEPRINT_MODE_KEY, String(enabled));
  }
}
