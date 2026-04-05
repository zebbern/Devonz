export type TabType =
  | 'profile'
  | 'settings'
  | 'notifications'
  | 'features'
  | 'data'
  | 'cloud-providers'
  | 'local-providers'
  | 'github'
  | 'gitlab'
  | 'supabase'
  | 'event-logs'
  | 'mcp'
  | 'project-memory';

export type WindowType = 'user' | 'developer';

export type SidebarCategory = 'general' | 'ai' | 'services' | 'system';

export interface UserProfile {
  nickname: string;
  name: string;
  email: string;
  avatar?: string;
  theme: 'light' | 'dark' | 'system';
  notifications: boolean;
  password?: string;
  bio?: string;
  language: string;
  timezone: string;
}

export interface TabVisibilityConfig {
  id: TabType;
  visible: boolean;
  window: WindowType;
  order: number;
  isExtraDevTab?: boolean;
  locked?: boolean;
}

export interface UserTabConfig extends TabVisibilityConfig {
  window: 'user';
}

export interface TabWindowConfig {
  userTabs: UserTabConfig[];
}

export interface SidebarCategoryConfig {
  id: SidebarCategory;
  label: string;
  icon: string;
  tabs: TabType[];
}

export interface Profile {
  username?: string;
  bio?: string;
  avatar?: string;
  preferences?: {
    notifications?: boolean;
    theme?: 'light' | 'dark' | 'system';
    language?: string;
    timezone?: string;
  };
}
