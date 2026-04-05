import type { TabVisibilityConfig } from '~/components/@settings/core/types';
import { DEFAULT_TAB_CONFIG } from '~/components/@settings/core/constants';

const envTabVisibility: Record<string, string | boolean | undefined> = {
  'features': typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SHOW_TAB_FEATURES : undefined,
  'data': typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SHOW_TAB_DATA : undefined,
  'cloud-providers': typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SHOW_TAB_CLOUD_PROVIDERS : undefined,
  'local-providers': typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SHOW_TAB_LOCAL_PROVIDERS : undefined,
  'github': typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SHOW_TAB_GITHUB : undefined,
  'gitlab': typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SHOW_TAB_GITLAB : undefined,
  'supabase': typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SHOW_TAB_SUPABASE : undefined,
  'notifications': typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SHOW_TAB_NOTIFICATIONS : undefined,
  'event-logs': typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SHOW_TAB_EVENT_LOGS : undefined,
  'mcp': typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SHOW_TAB_MCP : undefined,
  'project-memory': typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SHOW_TAB_PROJECT_MEMORY : undefined,
};

export const isTabEnabledViaEnv = (tabId: string): boolean => {
  // Tabs that are visible by default
  const defaultVisibleTabs = ['features', 'data', 'project-memory'];
  const isDefaultVisible = defaultVisibleTabs.includes(tabId);
  
  const envVal = envTabVisibility[tabId];
  
  if (envVal !== undefined && envVal !== '') {
    return envVal === 'true' || envVal === true; // Allow explicit "true" or "false" override
  }

  
  return isDefaultVisible;
};

export const getVisibleTabs = (
  tabConfiguration: { userTabs: TabVisibilityConfig[] },
  notificationsEnabled: boolean,
): TabVisibilityConfig[] => {
  if (!tabConfiguration?.userTabs || !Array.isArray(tabConfiguration.userTabs)) {
    console.warn('Invalid tab configuration, using defaults');
    return DEFAULT_TAB_CONFIG as TabVisibilityConfig[];
  }

  // In user mode, only show visible user tabs
  return tabConfiguration.userTabs
    .filter((tab) => {
      if (!tab || typeof tab.id !== 'string') {
        console.warn('Invalid tab entry:', tab);
        return false;
      }

      // Hide notifications tab if notifications are disabled
      if (tab.id === 'notifications' && !notificationsEnabled) {
        return false;
      }

      // Check environment variable configuration
      if (!isTabEnabledViaEnv(tab.id as string)) {
        return false;
      }

      // Only show tabs that are explicitly visible and assigned to the user window
      return tab.visible && tab.window === 'user';
    })
    .sort((a, b) => a.order - b.order);
};

export const reorderTabs = (
  tabs: TabVisibilityConfig[],
  startIndex: number,
  endIndex: number,
): TabVisibilityConfig[] => {
  const result = Array.from(tabs);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);

  // Update order property
  return result.map((tab, index) => ({
    ...tab,
    order: index,
  }));
};

export const resetToDefaultConfig = (isDeveloperMode: boolean): TabVisibilityConfig[] => {
  return DEFAULT_TAB_CONFIG.map((tab) => ({
    ...tab,
    visible: isDeveloperMode ? true : tab.window === 'user',
    window: isDeveloperMode ? 'developer' : tab.window,
  })) as TabVisibilityConfig[];
};
