// Remove unused imports
import React, { memo, useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { Switch } from '~/components/ui/Switch';
import { useSettings } from '~/lib/hooks/useSettings';
import { classNames } from '~/utils/classNames';
import { toast } from 'react-toastify';
import { PromptLibrary } from '~/lib/common/prompt-library';
import { useStore } from '@nanostores/react';
import { stagingStore, updateSettings as updateStagingSettings } from '~/lib/stores/staging';
import { autoFixStore, updateAutoFixSettings } from '~/lib/stores/autofix';
import { agentModeStore, updateAgentModeSettings } from '~/lib/stores/agentMode';

// Tab sections for Features
const featureTabSections = [
  { id: 'core', label: 'Core Features' },
  { id: 'beta', label: 'Beta Features' },
  { id: 'prompts', label: 'Prompt Library' },
] as const;

type FeatureTabSection = (typeof featureTabSections)[number]['id'];

interface FeatureToggle {
  id: string;
  title: string;
  description: string;
  icon: string;
  enabled: boolean;
  beta?: boolean;
  experimental?: boolean;
  tooltip?: string;
}

const FeatureCard = memo(
  ({
    feature,
    index,
    onToggle,
  }: {
    feature: FeatureToggle;
    index: number;
    onToggle: (id: string, enabled: boolean) => void;
  }) => (
    <motion.div
      key={feature.id}
      layoutId={feature.id}
      className={classNames(
        'relative group cursor-pointer',
        'bg-bolt-elements-background-depth-2',
        'hover:bg-bolt-elements-background-depth-3',
        'transition-colors duration-200',
        'rounded-lg overflow-hidden',
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={classNames(feature.icon, 'w-5 h-5 text-bolt-elements-textSecondary')} />
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-bolt-elements-textPrimary">{feature.title}</h4>
              {feature.beta && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/10 text-blue-500 font-medium">Beta</span>
              )}
              {feature.experimental && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-orange-500/10 text-orange-500 font-medium">
                  Experimental
                </span>
              )}
            </div>
          </div>
          <Switch checked={feature.enabled} onCheckedChange={(checked) => onToggle(feature.id, checked)} />
        </div>
        <p className="mt-2 text-sm text-bolt-elements-textSecondary">{feature.description}</p>
        {feature.tooltip && <p className="mt-1 text-xs text-bolt-elements-textTertiary">{feature.tooltip}</p>}
      </div>
    </motion.div>
  ),
);

const FeatureSection = memo(
  ({
    title,
    features,
    icon,
    description,
    onToggleFeature,
  }: {
    title: string;
    features: FeatureToggle[];
    icon: string;
    description: string;
    onToggleFeature: (id: string, enabled: boolean) => void;
  }) => (
    <motion.div
      layout
      className="flex flex-col gap-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-3">
        <div className={classNames(icon, 'text-xl text-purple-500')} />
        <div>
          <h3 className="text-lg font-medium text-bolt-elements-textPrimary">{title}</h3>
          <p className="text-sm text-bolt-elements-textSecondary">{description}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {features.map((feature, index) => (
          <FeatureCard key={feature.id} feature={feature} index={index} onToggle={onToggleFeature} />
        ))}
      </div>
    </motion.div>
  ),
);

export default function FeaturesTab() {
  const [activeSection, setActiveSection] = useState<FeatureTabSection>('core');

  const {
    autoSelectTemplate,
    isLatestBranch,
    contextOptimizationEnabled,
    eventLogs,
    autoSwitchToFile,
    setAutoSelectTemplate,
    enableLatestBranch,
    enableContextOptimization,
    setEventLogs,
    setAutoSwitchToFile,
    setPromptId,
    promptId,
  } = useSettings();

  // Staging settings from staging store
  const stagingState = useStore(stagingStore);
  const { settings: stagingSettings } = stagingState;

  // AutoFix settings from autofix store
  const autoFixState = useStore(autoFixStore);
  const { settings: autoFixSettings } = autoFixState;

  // Agent Mode settings from agent mode store
  const agentModeState = useStore(agentModeStore);
  const { settings: agentModeSettings } = agentModeState;

  // Enable features by default on first load
  React.useEffect(() => {
    // Only set defaults if values are undefined
    if (isLatestBranch === undefined) {
      enableLatestBranch(false); // Default: OFF - Don't auto-update from main branch
    }

    if (contextOptimizationEnabled === undefined) {
      enableContextOptimization(true); // Default: ON - Enable context optimization
    }

    if (autoSelectTemplate === undefined) {
      setAutoSelectTemplate(true); // Default: ON - Enable auto-select templates
    }

    if (promptId === undefined) {
      setPromptId('default'); // Default: 'default'
    }

    if (eventLogs === undefined) {
      setEventLogs(true); // Default: ON - Enable event logging
    }
  }, []); // Only run once on component mount

  const handleToggleFeature = useCallback(
    (id: string, enabled: boolean) => {
      switch (id) {
        case 'latestBranch': {
          enableLatestBranch(enabled);
          toast.success(`Main branch updates ${enabled ? 'enabled' : 'disabled'}`);
          break;
        }

        case 'autoSelectTemplate': {
          setAutoSelectTemplate(enabled);
          toast.success(`Auto select template ${enabled ? 'enabled' : 'disabled'}`);
          break;
        }

        case 'contextOptimization': {
          enableContextOptimization(enabled);
          toast.success(`Context optimization ${enabled ? 'enabled' : 'disabled'}`);
          break;
        }

        case 'eventLogs': {
          setEventLogs(enabled);
          toast.success(`Event logging ${enabled ? 'enabled' : 'disabled'}`);
          break;
        }

        case 'autoSwitchToFile': {
          setAutoSwitchToFile(enabled);
          toast.success(`Auto-switch to file ${enabled ? 'enabled' : 'disabled'}`);
          break;
        }

        case 'stagingEnabled': {
          updateStagingSettings({ isEnabled: enabled });
          toast.success(`Change confirmations ${enabled ? 'enabled' : 'disabled'}`);
          break;
        }

        case 'stagingAutoApprove': {
          updateStagingSettings({ autoApproveEnabled: enabled });
          toast.success(`Auto-approve patterns ${enabled ? 'enabled' : 'disabled'}`);
          break;
        }

        case 'stagingDeleteConfirmation': {
          updateStagingSettings({ requireDeleteConfirmation: enabled });
          toast.success(`Delete confirmation ${enabled ? 'required' : 'not required'}`);
          break;
        }

        case 'stagingAutoCheckpoint': {
          updateStagingSettings({ autoCheckpointOnAccept: enabled });
          toast.success(`Auto-checkpoint ${enabled ? 'enabled' : 'disabled'}`);
          break;
        }

        case 'autoFixEnabled': {
          updateAutoFixSettings({ isEnabled: enabled });
          toast.success(`Auto-fix ${enabled ? 'enabled' : 'disabled'}`);
          break;
        }

        case 'autoFixShowNotifications': {
          updateAutoFixSettings({ showNotifications: enabled });
          toast.success(`Auto-fix notifications ${enabled ? 'enabled' : 'disabled'}`);
          break;
        }

        case 'agentModeEnabled': {
          updateAgentModeSettings({ enabled });
          toast.success(`Agent Mode ${enabled ? 'enabled' : 'disabled'}`);
          break;
        }

        case 'agentModeAutoApproveCommands': {
          updateAgentModeSettings({ autoApproveCommands: enabled });
          toast.success(`Auto-approve commands ${enabled ? 'enabled' : 'disabled'}`);
          break;
        }

        case 'agentModeAutoApproveFiles': {
          updateAgentModeSettings({ autoApproveFileCreation: enabled, autoApproveFileModification: enabled });
          toast.success(`Auto-approve file operations ${enabled ? 'enabled' : 'disabled'}`);
          break;
        }

        default:
          break;
      }
    },
    [enableLatestBranch, setAutoSelectTemplate, enableContextOptimization, setEventLogs, setAutoSwitchToFile],
  );

  const features = {
    stable: [
      {
        id: 'latestBranch',
        title: 'Main Branch Updates',
        description: 'Get the latest updates from the main branch',
        icon: 'i-ph:git-branch',
        enabled: isLatestBranch,
        tooltip: 'Enabled by default to receive updates from the main development branch',
      },
      {
        id: 'autoSelectTemplate',
        title: 'Auto Select Template',
        description: 'Automatically select starter template',
        icon: 'i-ph:selection',
        enabled: autoSelectTemplate,
        tooltip: 'Enabled by default to automatically select the most appropriate starter template',
      },
      {
        id: 'contextOptimization',
        title: 'Context Optimization',
        description: 'Optimize context for better responses',
        icon: 'i-ph:brain',
        enabled: contextOptimizationEnabled,
        tooltip: 'Enabled by default for improved AI responses',
      },
      {
        id: 'eventLogs',
        title: 'Event Logging',
        description: 'Enable detailed event logging and history',
        icon: 'i-ph:list-bullets',
        enabled: eventLogs,
        tooltip: 'Enabled by default to record detailed logs of system events and user actions',
      },
      {
        id: 'autoSwitchToFile',
        title: 'Auto-Switch to File During AI Edits',
        description: 'Automatically switch to code view when AI edits files',
        icon: 'i-ph:file-code',
        enabled: autoSwitchToFile,
        tooltip:
          'When enabled, the editor will automatically switch to show each file as the AI edits it. When disabled, you can stay in preview mode while the AI works.',
      },
    ],
    beta: [
      {
        id: 'stagingEnabled',
        title: 'Change Confirmations',
        description: 'Review and approve file changes before they are applied',
        icon: 'i-ph:git-diff',
        enabled: stagingSettings.isEnabled,
        beta: true,
        tooltip: 'Shows a diff preview of changes and lets you accept or reject each file modification',
      },
      {
        id: 'stagingAutoApprove',
        title: 'Auto-Approve Safe Files',
        description: 'Automatically approve changes to lock files, logs, etc.',
        icon: 'i-ph:check-circle',
        enabled: stagingSettings.autoApproveEnabled,
        beta: true,
        tooltip: 'Files like package-lock.json, pnpm-lock.yaml, and .log files are auto-approved',
      },
      {
        id: 'stagingDeleteConfirmation',
        title: 'Require Delete Confirmation',
        description: 'Always ask for confirmation before deleting files',
        icon: 'i-ph:trash',
        enabled: stagingSettings.requireDeleteConfirmation,
        beta: true,
        tooltip: 'Even auto-approved patterns will require confirmation for deletions',
      },
      {
        id: 'stagingAutoCheckpoint',
        title: 'Auto-Checkpoint Before Accept',
        description: 'Create a version checkpoint before accepting changes',
        icon: 'i-ph:clock-counter-clockwise',
        enabled: stagingSettings.autoCheckpointOnAccept,
        beta: true,
        tooltip: 'Allows you to restore to before the changes were applied',
      },
      {
        id: 'autoFixEnabled',
        title: 'Auto-Fix Errors',
        description: 'Automatically send errors to AI for fixing (up to 3 attempts)',
        icon: 'i-ph:wrench',
        enabled: autoFixSettings.isEnabled,
        beta: true,
        tooltip:
          'When enabled, terminal and preview errors are automatically sent to the AI for fixing without user intervention',
      },
      {
        id: 'autoFixShowNotifications',
        title: 'Auto-Fix Notifications',
        description: 'Show status notifications during auto-fix',
        icon: 'i-ph:bell',
        enabled: autoFixSettings.showNotifications,
        beta: true,
        tooltip: 'Display toast notifications when auto-fix starts, succeeds, or fails',
      },
      {
        id: 'agentModeEnabled',
        title: 'Agent Mode',
        description: 'Enable autonomous AI agent that can read/write files and run commands',
        icon: 'i-ph:robot',
        enabled: agentModeSettings.enabled,
        experimental: true,
        tooltip:
          'When enabled, the AI can autonomously execute tasks using tools like file operations and terminal commands',
      },
      {
        id: 'agentModeAutoApproveCommands',
        title: 'Agent: Auto-Approve Commands',
        description: 'Skip approval for terminal commands in agent mode',
        icon: 'i-ph:terminal',
        enabled: agentModeSettings.autoApproveCommands,
        experimental: true,
        tooltip: 'When enabled, the agent can run terminal commands without asking for permission',
      },
      {
        id: 'agentModeAutoApproveFiles',
        title: 'Agent: Auto-Approve File Operations',
        description: 'Skip approval for file creation and modification in agent mode',
        icon: 'i-ph:file-plus',
        enabled: agentModeSettings.autoApproveFileCreation && agentModeSettings.autoApproveFileModification,
        experimental: true,
        tooltip: 'When enabled, the agent can create and modify files without asking for permission',
      },
    ],
  };

  return (
    <div className="flex flex-col">
      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-[#333] pb-2 mb-6">
        {featureTabSections.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id)}
            className="px-4 py-2 text-sm font-medium rounded-t-lg transition-colors"
            style={{
              backgroundColor: activeSection === tab.id ? '#21262d' : 'transparent',
              color: activeSection === tab.id ? '#fff' : '#9ca3af',
              borderBottom: activeSection === tab.id ? '2px solid #a855f7' : '2px solid transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Core Features Section */}
      {activeSection === 'core' && (
        <FeatureSection
          title="Core Features"
          features={features.stable}
          icon="i-ph:check-circle"
          description="Essential features that are enabled by default for optimal performance"
          onToggleFeature={handleToggleFeature}
        />
      )}

      {/* Beta Features Section */}
      {activeSection === 'beta' && features.beta.length > 0 && (
        <FeatureSection
          title="Beta Features"
          features={features.beta}
          icon="i-ph:test-tube"
          description="New features that are ready for testing but may have some rough edges"
          onToggleFeature={handleToggleFeature}
        />
      )}

      {/* Prompt Library Section */}
      {activeSection === 'prompts' && (
        <motion.div
          layout
          className={classNames(
            'bg-bolt-elements-background-depth-2',
            'hover:bg-bolt-elements-background-depth-3',
            'transition-all duration-200',
            'rounded-lg p-4',
            'group',
          )}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center gap-4">
            <div
              className={classNames(
                'p-2 rounded-lg text-xl',
                'bg-bolt-elements-background-depth-3 group-hover:bg-bolt-elements-background-depth-4',
                'transition-colors duration-200',
                'text-purple-500',
              )}
            >
              <div className="i-ph:book" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-bolt-elements-textPrimary group-hover:text-purple-500 transition-colors">
                Prompt Library
              </h4>
              <p className="text-xs text-bolt-elements-textSecondary mt-0.5">
                Choose a prompt from the library to use as the system prompt
              </p>
            </div>
            <select
              value={promptId}
              onChange={(e) => {
                setPromptId(e.target.value);
                toast.success('Prompt template updated');
              }}
              className={classNames(
                'p-2 rounded-lg text-sm min-w-[200px]',
                'bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor',
                'text-bolt-elements-textPrimary',
                'focus:outline-none focus:ring-2 focus:ring-purple-500/30',
                'group-hover:border-purple-500/30',
                'transition-all duration-200',
              )}
            >
              {PromptLibrary.getList().map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </select>
          </div>
        </motion.div>
      )}
    </div>
  );
}
