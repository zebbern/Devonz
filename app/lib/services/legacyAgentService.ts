/**
 * Agent Orchestrator Service
 *
 * Manages the autonomous agent execution loop with state tracking,
 * approval flows, iteration limits, and tool coordination.
 */

import { createScopedLogger } from '~/utils/logger';
import { AGENT_ITERATION_WARNING_PROMPT } from '~/lib/agent-orchestrator/prompts/base';
import type {
  AgentExecutionState,
  AgentModeSettings,
  AgentOrchestratorOptions,
  AgentStatus,
  ToolCallRecord,
  ApprovalRequest,
} from '~/lib/agent-orchestrator/shared/agent-types';
import { DEFAULT_AGENT_SETTINGS } from '~/lib/agent-orchestrator/shared/agent-types';

const logger = createScopedLogger('AgentOrchestrator');

function createInitialState(): AgentExecutionState {
  return {
    status: 'idle',
    isExecuting: false,
    iteration: 0,
    maxIterations: DEFAULT_AGENT_SETTINGS.maxIterations,
    totalToolCalls: 0,
    toolCalls: [],
    filesCreated: [],
    filesModified: [],
    commandsExecuted: [],
    sessionStartTime: null,
  };
}

export class AgentOrchestrator {
  private _state: AgentExecutionState;
  private _settings: AgentModeSettings;
  private _options: AgentOrchestratorOptions;

  constructor(settings: Partial<AgentModeSettings> = {}, options: Partial<AgentOrchestratorOptions> = {}) {
    this._settings = { ...DEFAULT_AGENT_SETTINGS, ...settings };
    this._options = options;
    this._state = createInitialState();
    this._state.maxIterations = this._settings.maxIterations;
    logger.debug('AgentOrchestrator initialized', { settings: this._settings });
  }

  getState(): Readonly<AgentExecutionState> {
    return { ...this._state };
  }

  getSettings(): Readonly<AgentModeSettings> {
    return { ...this._settings };
  }

  updateSettings(updates: Partial<AgentModeSettings>): void {
    this._settings = { ...this._settings, ...updates };
    this._state.maxIterations = this._settings.maxIterations;
    logger.debug('Settings updated', { updates });
  }

  startSession(task: string): void {
    this._state = createInitialState();
    this._state.currentTask = task;
    this._state.status = 'thinking';
    this._state.sessionStartTime = Date.now();
    this._state.maxIterations = this._settings.maxIterations;
    logger.info('Session started', { task });
    this._notifyStatusChange('thinking');
  }

  endSession(): AgentExecutionState {
    this._state.status = 'completed';
    this._state.sessionEndTime = Date.now();
    logger.info('Session ended', this.getSessionSummary());
    this._notifyStatusChange('completed');

    return this.getState();
  }

  reset(): void {
    this._state = createInitialState();
    this._state.maxIterations = this._settings.maxIterations;
    logger.debug('State reset');
    this._notifyStatusChange('idle');
  }

  canContinue(): boolean {
    if (this._state.status === 'error') {
      return false;
    }

    return this._state.iteration < this._state.maxIterations;
  }

  async executeTool(
    toolName: string,
    params: Record<string, unknown>,
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    const { isAgentTool, executeAgentTool } = await import('./agentToolsService');

    if (!isAgentTool(toolName)) {
      const error = `Unknown agent tool: ${toolName}`;
      logger.error(error);

      return { success: false, error };
    }

    const needsApproval = this._checkNeedsApproval(toolName, params);

    if (needsApproval && !this._options.autoApproveAll) {
      const approved = await this._requestApproval({
        toolName,
        params,
        reason: `Tool ${toolName} requires approval`,
      });

      if (!approved) {
        return { success: false, error: 'Tool execution not approved by user' };
      }
    }

    this._state.status = 'executing';
    this._notifyStatusChange('executing');

    const startTime = Date.now();

    try {
      const result = await executeAgentTool(toolName, params);
      const duration = Date.now() - startTime;

      const record: ToolCallRecord = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: toolName,
        params,
        result,
        timestamp: startTime,
        duration,
      };

      this._state.toolCalls.push(record);
      this._state.totalToolCalls++;
      this._state.lastany /* ToolCall */ = record;

      if (result.success && result.data) {
        const data = result.data as Record<string, unknown>;

        if (data.created && data.path) {
          this._state.filesCreated.push(data.path as string);
        } else if (data.modified && data.path) {
          this._state.filesModified.push(data.path as string);
        } else if (toolName === 'devonz_write_file' && data.path) {
          this._state.filesCreated.push(data.path as string);
        }

        if (toolName === 'devonz_run_command' && params.command) {
          this._state.commandsExecuted.push(params.command as string);
        }
      }

      this._options.onToolExecuted?.(record);

      this._state.status = 'thinking';
      this._notifyStatusChange('thinking');

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Tool execution failed', { toolName, error: errorMessage });

      return { success: false, error: errorMessage };
    }
  }

  private _checkNeedsApproval(toolName: string, params: Record<string, unknown>): boolean {
    if (toolName === 'devonz_run_command' && !this._settings.autoApproveCommands) {
      return true;
    }

    if (toolName === 'devonz_write_file') {
      const path = params.path as string | undefined;

      if (path && !this._settings.autoApproveFileCreation) {
        return true;
      }
    }

    return false;
  }

  private async _requestApproval(request: ApprovalRequest): Promise<boolean> {
    if (!this._options.onApprovalNeeded) {
      return false;
    }

    this._state.status = 'waiting_for_approval';
    this._state.pendingApproval = request;
    this._notifyStatusChange('waiting_for_approval');

    try {
      const approved = await this._options.onApprovalNeeded(request);
      this._state.pendingApproval = undefined;

      return approved;
    } catch {
      this._state.pendingApproval = undefined;
      return false;
    }
  }

  incrementIteration(): boolean {
    this._state.iteration++;
    logger.debug('Iteration incremented', { iteration: this._state.iteration });
    this._options.onIterationComplete?.(this._state.iteration, this.getState());

    return this.canContinue();
  }

  isNearIterationLimit(): boolean {
    const threshold = 5;
    return this._state.maxIterations - this._state.iteration <= threshold;
  }

  getIterationWarningPrompt(): string | null {
    if (!this.isNearIterationLimit()) {
      return null;
    }

    return AGENT_ITERATION_WARNING_PROMPT;
  }

  setError(message: string): void {
    this._state.status = 'error';
    this._state.errorMessage = message;
    logger.error('Error set', { message });
    this._notifyStatusChange('error');
  }

  getSessionSummary(): string {
    const parts: string[] = [];
    parts.push(`${this._state.iteration} iterations`);
    parts.push(`${this._state.totalToolCalls} tool calls`);

    if (this._state.filesCreated.length > 0) {
      parts.push(`Files created: ${this._state.filesCreated.join(', ')}`);
    }

    if (this._state.filesModified.length > 0) {
      parts.push(`Files modified: ${this._state.filesModified.join(', ')}`);
    }

    if (this._state.commandsExecuted.length > 0) {
      parts.push(`Commands: ${this._state.commandsExecuted.join(', ')}`);
    }

    return parts.join(' | ');
  }

  abort(): void {
    this._state.status = 'idle';
    this._state.isExecuting = false;
    logger.info('Execution aborted');
    this._notifyStatusChange('idle');
  }

  async getAvailableTools(): Promise<string[]> {
    const { getAgentToolNames } = await import('./agentToolsService');
    return getAgentToolNames();
  }

  private _notifyStatusChange(status: AgentStatus): void {
    this._options.onStatusChange?.(status);
  }
}

let singletonInstance: AgentOrchestrator | null = null;

export function getAgentOrchestrator(
  settings?: Partial<AgentModeSettings>,
  options?: Partial<AgentOrchestratorOptions>,
): AgentOrchestrator {
  if (!singletonInstance) {
    singletonInstance = new AgentOrchestrator(settings, options);
  }

  return singletonInstance;
}

export function createAgentOrchestrator(
  settings?: Partial<AgentModeSettings>,
  options?: Partial<AgentOrchestratorOptions>,
): AgentOrchestrator {
  return new AgentOrchestrator(settings, options);
}

export function resetAgentOrchestrator(): void {
  singletonInstance = null;
}

export async function runAgentTask(
  task: string,
  options?: Partial<AgentOrchestratorOptions>,
): Promise<AgentExecutionState> {
  const orchestrator = getAgentOrchestrator({}, options);
  orchestrator.startSession(task);

  return orchestrator.endSession();
}

export async function isAgentModeAvailable(): Promise<boolean> {
  try {
    const { getAgentToolNames } = await import('./agentToolsService');
    return getAgentToolNames().length > 0;
  } catch {
    return false;
  }
}

export function getAgentStatus(): AgentStatus | null {
  if (!singletonInstance) {
    return null;
  }

  return singletonInstance.getState().status;
}
