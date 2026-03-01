/**
 * Agent Mode Store
 *
 * State management for the Alinma coder AI Agent Mode feature.
 * Provides reactive state for agent mode settings and status tracking.
 */

import { map, computed } from 'nanostores';
import { createScopedLogger } from '~/utils/logger';
import type {
  AgentModeSettings,
  AgentStatus,
  AgentExecutionState,
  PlanPhase,
  TokenBudgetState,
} from '~/lib/agent/types';
import { DEFAULT_AGENT_SETTINGS } from '~/lib/agent/types';

const logger = createScopedLogger('AgentModeStore');

/**
 * Agent mode UI state
 */
export interface AgentModeUIState {
  /** Current agent mode settings */
  settings: AgentModeSettings;

  /** Current agent status */
  status: AgentStatus;

  /** Current iteration count */
  iteration: number;

  /** Maximum iterations allowed */
  maxIterations: number;

  /** Total tool calls in current session */
  totalToolCalls: number;

  /** Whether agent is currently executing */
  isExecuting: boolean;

  /** Current task description */
  currentTask: string | undefined;

  /** Last error message if any */
  errorMessage: string | undefined;

  /** Files created in current session */
  filesCreated: string[];

  /** Files modified in current session */
  filesModified: string[];

  /** Commands executed in current session */
  commandsExecuted: string[];

  /** Current planning phase synchronized from orchestrator */
  planPhase: PlanPhase;

  /** Current token budget state, null until first token_budget_update event */
  tokenBudget: TokenBudgetState | null;

  /** Current parallel tool batch state, null when no batch is active */
  parallelBatch: { batchId: string; toolCount: number; status: string; completedCount: number } | null;
}

// Load settings from localStorage
function loadSettings(): AgentModeSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_AGENT_SETTINGS;
  }

  try {
    const stored = localStorage.getItem('alinma_coder_agent_mode_settings');

    if (stored) {
      const parsed = JSON.parse(stored);

      /*
       * Migration: If stored settings were saved before autoApproveCommands
       * defaulted to true, update them. We detect this by checking if the
       * stored value explicitly set autoApproveCommands to false AND
       * there's no migration marker. This ensures existing users get
       * the new default without overriding intentional user choices later.
       */
      const SETTINGS_VERSION = 2;

      if (!parsed._version || parsed._version < SETTINGS_VERSION) {
        parsed.autoApproveCommands = DEFAULT_AGENT_SETTINGS.autoApproveCommands;
        parsed._version = SETTINGS_VERSION;

        // Re-save with migration applied
        localStorage.setItem('devonz_agent_mode_settings', JSON.stringify({ ...DEFAULT_AGENT_SETTINGS, ...parsed }));
        logger.debug('Migrated agent mode settings to version', SETTINGS_VERSION);
      }

      return { ...DEFAULT_AGENT_SETTINGS, ...parsed };
    }
  } catch (error) {
    logger.error('Failed to load agent mode settings:', error);
  }

  return DEFAULT_AGENT_SETTINGS;
}

// Save settings to localStorage
function saveSettings(settings: AgentModeSettings): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem('alinma_coder_agent_mode_settings', JSON.stringify(settings));
    logger.debug('Agent mode settings saved');
  } catch (error) {
    logger.error('Failed to save agent mode settings:', error);
  }
}

// Initial UI state
const initialState: AgentModeUIState = {
  settings: loadSettings(),
  status: 'idle',
  iteration: 0,
  maxIterations: DEFAULT_AGENT_SETTINGS.maxIterations,
  totalToolCalls: 0,
  isExecuting: false,
  currentTask: undefined,
  errorMessage: undefined,
  filesCreated: [],
  filesModified: [],
  commandsExecuted: [],
  planPhase: 'idle',
  tokenBudget: null,
  parallelBatch: null,
};

/**
 * Main agent mode store
 */
export const agentModeStore = map<AgentModeUIState>(initialState);

/**
 * Derived atom: true when the agent is in a review cycle
 */
export const isInReviewCycle = computed(agentModeStore, (state) => state.planPhase === 'reviewing');

/**
 * Derived atom: true when the agent is in the planning phase
 */
export const isPlanning = computed(agentModeStore, (state) => state.planPhase === 'planning');

/**
 * Budget severity level derived from token usage percentage.
 * - 'unknown' when usagePercentage is -1 (provider data unavailable)
 * - 'normal' when usage < 60%
 * - 'warning' when usage 60-80%
 * - 'critical' when usage > 80%
 * - null when no budget data is available yet
 */
export type BudgetSeverity = 'normal' | 'warning' | 'critical' | 'unknown';

export const budgetSeverity = computed(agentModeStore, (state): BudgetSeverity | null => {
  const budget = state.tokenBudget;

  if (!budget) {
    return null;
  }

  if (budget.usagePercentage === -1) {
    return 'unknown';
  }

  if (budget.usagePercentage > 80) {
    return 'critical';
  }

  if (budget.usagePercentage >= 60) {
    return 'warning';
  }

  return 'normal';
});

/**
 * Update agent mode settings
 */
export function updateAgentModeSettings(updates: Partial<AgentModeSettings>): void {
  const current = agentModeStore.get();
  const newSettings = { ...current.settings, ...updates };

  agentModeStore.setKey('settings', newSettings);
  agentModeStore.setKey('maxIterations', newSettings.maxIterations);

  saveSettings(newSettings);
  logger.debug('Agent mode settings updated', updates);
}

/**
 * Update agent status from orchestrator
 */
export function updateAgentStatus(status: AgentStatus): void {
  agentModeStore.setKey('status', status);
  agentModeStore.setKey('isExecuting', status === 'executing' || status === 'thinking');
  logger.debug('Agent status updated', { status });
}

/**
 * Sync full state from orchestrator
 */
export function syncFromOrchestratorState(state: AgentExecutionState): void {
  agentModeStore.set({
    ...agentModeStore.get(),
    status: state.status,
    iteration: state.iteration,
    maxIterations: state.maxIterations,
    totalToolCalls: state.totalToolCalls,
    isExecuting: state.isExecuting,
    currentTask: state.currentTask,
    errorMessage: state.errorMessage,
    filesCreated: [...state.filesCreated],
    filesModified: [...state.filesModified],
    commandsExecuted: [...state.commandsExecuted],
    planPhase: state.planPhase,
  });
}

/**
 * Reset agent mode state (but keep settings)
 */
export function resetAgentModeState(): void {
  const settings = agentModeStore.get().settings;

  agentModeStore.set({
    settings,
    status: 'idle',
    iteration: 0,
    maxIterations: settings.maxIterations,
    totalToolCalls: 0,
    isExecuting: false,
    currentTask: undefined,
    errorMessage: undefined,
    filesCreated: [],
    filesModified: [],
    commandsExecuted: [],
    planPhase: 'idle',
    tokenBudget: null,
    parallelBatch: null,
  });

  logger.debug('Agent mode state reset');
}

/**
 * Check if agent mode is enabled in settings
 */
export function isAgentModeEnabled(): boolean {
  return agentModeStore.get().settings.enabled;
}

/**
 * Toggle agent mode on/off
 */
export function toggleAgentMode(enabled: boolean): void {
  updateAgentModeSettings({ enabled });
}

/**
 * Get current agent mode settings
 */
export function getAgentModeSettings(): AgentModeSettings {
  return agentModeStore.get().settings;
}

/**
 * Get formatted status text for UI
 */
export function getAgentStatusText(): string {
  const state = agentModeStore.get();

  switch (state.status) {
    case 'idle':
      return 'Ready';
    case 'thinking':
      return 'Thinking...';
    case 'executing':
      return 'Executing...';
    case 'waiting_for_approval':
      return 'Awaiting Approval';
    case 'completed':
      return 'Completed';
    case 'error':
      return state.errorMessage || 'Error';
    default:
      return 'Unknown';
  }
}

/**
 * Get progress percentage for iteration limit
 */
export function getIterationProgress(): number {
  const state = agentModeStore.get();

  if (state.maxIterations === 0) {
    return 0;
  }

  return Math.min(100, (state.iteration / state.maxIterations) * 100);
}
