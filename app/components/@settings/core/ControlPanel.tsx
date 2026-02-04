import { useState, useEffect, useMemo, lazy, Suspense, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { classNames } from '~/utils/classNames';
import { useFeatures } from '~/lib/hooks/useFeatures';
import { useNotifications } from '~/lib/hooks/useNotifications';
import { useConnectionStatus } from '~/lib/hooks/useConnectionStatus';
import { tabConfigurationStore, resetTabConfiguration } from '~/lib/stores/settings';
import { profileStore } from '~/lib/stores/profile';
import type { TabType, Profile } from './types';
import { TAB_LABELS, TAB_ICONS, DEFAULT_TAB_CONFIG } from './constants';
import { DialogTitle } from '~/components/ui/Dialog';

// Lazy load all tab components for better initial performance
const ProfileTab = lazy(() => import('~/components/@settings/tabs/profile/ProfileTab'));
const SettingsTab = lazy(() => import('~/components/@settings/tabs/settings/SettingsTab'));
const NotificationsTab = lazy(() => import('~/components/@settings/tabs/notifications/NotificationsTab'));
const FeaturesTab = lazy(() => import('~/components/@settings/tabs/features/FeaturesTab'));
const DataTab = lazy(() => import('~/components/@settings/tabs/data/DataTab').then((m) => ({ default: m.DataTab })));
const EventLogsTab = lazy(() =>
  import('~/components/@settings/tabs/event-logs/EventLogsTab').then((m) => ({ default: m.EventLogsTab })),
);
const GitHubTab = lazy(() => import('~/components/@settings/tabs/github/GitHubTab'));
const GitLabTab = lazy(() => import('~/components/@settings/tabs/gitlab/GitLabTab'));
const SupabaseTab = lazy(() => import('~/components/@settings/tabs/supabase/SupabaseTab'));
const VercelTab = lazy(() => import('~/components/@settings/tabs/vercel/VercelTab'));
const NetlifyTab = lazy(() => import('~/components/@settings/tabs/netlify/NetlifyTab'));
const CloudProvidersTab = lazy(() => import('~/components/@settings/tabs/providers/cloud/CloudProvidersTab'));
const LocalProvidersTab = lazy(() => import('~/components/@settings/tabs/providers/local/LocalProvidersTab'));
const McpTab = lazy(() => import('~/components/@settings/tabs/mcp/McpTab'));
const ProjectMemoryTab = lazy(() => import('~/components/@settings/tabs/project-memory/ProjectMemoryTab'));

// Loading fallback for lazy-loaded tabs
const TabLoadingFallback = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full" />
  </div>
);

interface ControlPanelProps {
  open: boolean;
  onClose: () => void;
}

// Beta status for experimental features
const BETA_TABS = new Set<TabType>(['local-providers', 'mcp']);

export const ControlPanel = ({ open, onClose }: ControlPanelProps) => {
  // State
  const [activeTab, setActiveTab] = useState<TabType | null>(null);

  // Store values
  const tabConfiguration = useStore(tabConfigurationStore);
  const profile = useStore(profileStore) as Profile;

  // Status hooks
  const { hasNewFeatures, acknowledgeAllFeatures } = useFeatures();
  const { hasUnreadNotifications, markAllAsRead } = useNotifications();
  const { hasConnectionIssues, acknowledgeIssue } = useConnectionStatus();

  // Add visibleTabs logic using useMemo with optimized calculations
  const visibleTabs = useMemo(() => {
    if (!tabConfiguration?.userTabs || !Array.isArray(tabConfiguration.userTabs)) {
      console.warn('Invalid tab configuration, resetting to defaults');
      resetTabConfiguration();

      return [];
    }

    const notificationsDisabled = profile?.preferences?.notifications === false;

    // Optimize user mode tab filtering
    return tabConfiguration.userTabs
      .filter((tab) => {
        if (!tab?.id) {
          return false;
        }

        if (tab.id === 'notifications' && notificationsDisabled) {
          return false;
        }

        return tab.visible && tab.window === 'user';
      })
      .sort((a, b) => a.order - b.order);
  }, [tabConfiguration, profile?.preferences?.notifications]);

  // Reset to default view when modal opens/closes
  useEffect(() => {
    if (!open) {
      setActiveTab(null);
    }
  }, [open]);

  // Handle closing
  const handleClose = useCallback(() => {
    setActiveTab(null);
    onClose();
  }, [onClose]);

  const getTabComponent = useCallback((tabId: TabType) => {
    const tabComponents: Record<TabType, React.ReactNode> = {
      profile: <ProfileTab />,
      settings: <SettingsTab />,
      notifications: <NotificationsTab />,
      features: <FeaturesTab />,
      data: <DataTab />,
      'cloud-providers': <CloudProvidersTab />,
      'local-providers': <LocalProvidersTab />,
      github: <GitHubTab />,
      gitlab: <GitLabTab />,
      supabase: <SupabaseTab />,
      vercel: <VercelTab />,
      netlify: <NetlifyTab />,
      'event-logs': <EventLogsTab />,
      mcp: <McpTab />,
      'project-memory': <ProjectMemoryTab />,
    };

    return <Suspense fallback={<TabLoadingFallback />}>{tabComponents[tabId] || null}</Suspense>;
  }, []);

  const getTabUpdateStatus = (tabId: TabType): boolean => {
    switch (tabId) {
      case 'features':
        return hasNewFeatures;
      case 'notifications':
        return hasUnreadNotifications;
      case 'github':
      case 'gitlab':
      case 'supabase':
      case 'vercel':
      case 'netlify':
        return hasConnectionIssues;
      default:
        return false;
    }
  };

  const getStatusMessage = (tabId: TabType): string => {
    switch (tabId) {
      case 'features':
        return `${unviewedFeatures.length} new feature${unviewedFeatures.length === 1 ? '' : 's'} to explore`;
      case 'notifications':
        return `${unreadNotifications.length} unread notification${unreadNotifications.length === 1 ? '' : 's'}`;
      case 'github':
      case 'gitlab':
      case 'supabase':
      case 'vercel':
      case 'netlify':
        return currentIssue === 'disconnected'
          ? 'Connection lost'
          : currentIssue === 'high-latency'
            ? 'High latency detected'
            : 'Connection issues detected';
      default:
        return '';
    }
  };

  const handleTabClick = (tabId: TabType) => {
    setActiveTab(tabId);

    // Acknowledge notifications based on tab
    switch (tabId) {
      case 'features':
        acknowledgeAllFeatures();
        break;
      case 'notifications':
        markAllAsRead();
        break;
      case 'github':
      case 'gitlab':
      case 'supabase':
      case 'vercel':
      case 'netlify':
        acknowledgeIssue();
        break;
    }
  };

  return (
    <RadixDialog.Root open={open}>
      <RadixDialog.Portal>
        <div className="fixed inset-0 flex items-center justify-center z-[100]">
          <RadixDialog.Overlay className="absolute inset-0 bg-black/80" onClick={handleClose} />

          <RadixDialog.Content
            aria-describedby={undefined}
            onEscapeKeyDown={handleClose}
            className="dark relative z-[101] w-[1000px] h-[80vh] rounded-xl shadow-2xl border border-[#333] flex overflow-hidden"
            style={{ backgroundColor: '#1a2332' }}
          >
            {/* Sidebar */}
            <div className="w-48 border-r border-[#333] flex flex-col" style={{ backgroundColor: '#131a24' }}>
              {/* Header */}
              <div className="px-4 py-4 border-b border-[#333]" style={{ backgroundColor: '#131a24' }}>
                <h2 className="text-sm font-semibold text-white">Settings</h2>
              </div>

              {/* Nav Items */}
              <nav className="flex-1 overflow-y-auto py-1" style={{ backgroundColor: '#131a24' }}>
                {visibleTabs.map((tab) => {
                  const IconComponent = TAB_ICONS[tab.id];
                  const hasUpdate = getTabUpdateStatus(tab.id);
                  const isActive = activeTab === tab.id;

                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTabClick(tab.id as TabType)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm"
                      style={{
                        backgroundColor: isActive ? '#21262d' : 'transparent',
                        color: isActive ? '#fff' : '#9ca3af',
                      }}
                    >
                      <IconComponent className="w-4 h-4 shrink-0" />
                      <span className="truncate">{TAB_LABELS[tab.id]}</span>
                      {hasUpdate && <span className="ml-auto w-2 h-2 rounded-full bg-purple-500" />}
                      {BETA_TABS.has(tab.id) && (
                        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">
                          BETA
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Main Content */}
            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0" style={{ backgroundColor: '#1a2332' }}>
              {/* Content Header */}
              <div
                className="flex items-center justify-between px-6 py-4 border-b border-[#333]"
                style={{ backgroundColor: '#1a2332' }}
              >
                <DialogTitle className="text-sm font-semibold text-white">
                  {activeTab ? TAB_LABELS[activeTab] : 'Select a setting'}
                </DialogTitle>
                <button
                  onClick={handleClose}
                  className="p-1.5 rounded hover:bg-[#333] transition-colors"
                  style={{ backgroundColor: '#21262d' }}
                >
                  <div className="i-ph:x w-4 h-4 text-gray-400" />
                </button>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: '#1a2332' }}>
                {activeTab ? (
                  getTabComponent(activeTab)
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    Select a setting from the sidebar
                  </div>
                )}
              </div>
            </div>
          </RadixDialog.Content>
        </div>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
};
