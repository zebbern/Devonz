/**
 * Agent Orchestrator Service Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AgentModeSettings, ToolCallRecord } from '~/lib/agent-orchestrator/shared/agent-types';

const mockExecuteAgentTool = vi.fn();
const mockIsAgentTool = vi.fn();
const mockGetAgentToolNames = vi.fn();

vi.mock('./agentToolsService', () => ({
  agentToolDefinitions: {
    devonz_read_file: { name: 'devonz_read_file', description: 'Read file', parameters: {} },
    devonz_write_file: { name: 'devonz_write_file', description: 'Write file', parameters: {} },
  },
  executeAgentTool: (...args: unknown[]) => mockExecuteAgentTool(...args),
  isAgentTool: (...args: unknown[]) => mockIsAgentTool(...args),
  getAgentToolNames: () => mockGetAgentToolNames(),
}));

vi.mock('~/utils/logger', () => ({
  createScopedLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('~/lib/agent-orchestrator/prompts/base', () => ({
  getAgentSystemPrompt: vi.fn(() => 'System prompt'),
  AGENT_ITERATION_WARNING_PROMPT: 'Iteration warning',
}));

import {
  createAgentOrchestrator,
  getAgentOrchestrator,
  resetAgentOrchestrator,
  isAgentModeAvailable,
  getAgentStatus,
} from './legacyAgentService';

describe('AgentOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAgentOrchestrator();
    mockIsAgentTool.mockReturnValue(true);
    mockGetAgentToolNames.mockReturnValue(['devonz_read_file', 'devonz_write_file']);
  });

  afterEach(() => {
    vi.resetAllMocks();
    resetAgentOrchestrator();
  });

  describe('constructor and getState', () => {
    it('should initialize with default state', () => {
      const orchestrator = createAgentOrchestrator();
      const state = orchestrator.getState();
      expect(state.iteration).toBe(0);
      expect(state.status).toBe('idle');
      expect(state.isExecuting).toBe(false);
      expect(state.toolCalls).toEqual([]);
      expect(state.totalToolCalls).toBe(0);
    });

    it('should accept custom settings', () => {
      const settings: Partial<AgentModeSettings> = {
        maxIterations: 10,
        autoApproveFileCreation: false,
      };
      const orchestrator = createAgentOrchestrator(settings);
      const state = orchestrator.getState();
      expect(state.maxIterations).toBe(10);
    });
  });

  describe('getSettings and updateSettings', () => {
    it('should return current settings', () => {
      const orchestrator = createAgentOrchestrator({ maxIterations: 15 });
      const settings = orchestrator.getSettings();
      expect(settings.maxIterations).toBe(15);
    });

    it('should update settings', () => {
      const orchestrator = createAgentOrchestrator();
      orchestrator.updateSettings({ maxIterations: 50 });
      expect(orchestrator.getSettings().maxIterations).toBe(50);
      expect(orchestrator.getState().maxIterations).toBe(50);
    });
  });

  describe('startSession and endSession', () => {
    it('should start a new session', () => {
      const orchestrator = createAgentOrchestrator();
      orchestrator.startSession('Test task');

      const state = orchestrator.getState();
      expect(state.currentTask).toBe('Test task');
      expect(state.status).toBe('thinking');
      expect(state.sessionStartTime).toBeDefined();
    });

    it('should end session and return final state', () => {
      const orchestrator = createAgentOrchestrator();
      orchestrator.startSession('Test task');

      const finalState = orchestrator.endSession();
      expect(finalState.status).toBe('completed');
    });

    it('should reset state when starting new session', () => {
      const orchestrator = createAgentOrchestrator();
      orchestrator.startSession('First task');
      orchestrator.incrementIteration();
      orchestrator.startSession('Second task');

      const state = orchestrator.getState();
      expect(state.currentTask).toBe('Second task');
      expect(state.iteration).toBe(0);
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      const orchestrator = createAgentOrchestrator();
      orchestrator.startSession('Task');
      orchestrator.incrementIteration();
      orchestrator.reset();

      const state = orchestrator.getState();
      expect(state.iteration).toBe(0);
      expect(state.status).toBe('idle');
      expect(state.currentTask).toBeUndefined();
    });
  });

  describe('canContinue', () => {
    it('should return true when under iteration limit', () => {
      const orchestrator = createAgentOrchestrator({ maxIterations: 10 });
      orchestrator.startSession('Task');
      expect(orchestrator.canContinue()).toBe(true);
    });

    it('should return false when at iteration limit', () => {
      const orchestrator = createAgentOrchestrator({ maxIterations: 2 });
      orchestrator.startSession('Task');
      orchestrator.incrementIteration();
      orchestrator.incrementIteration();
      expect(orchestrator.canContinue()).toBe(false);
    });

    it('should return false when in error state', () => {
      const orchestrator = createAgentOrchestrator();
      orchestrator.startSession('Task');
      orchestrator.setError('Something went wrong');
      expect(orchestrator.canContinue()).toBe(false);
    });
  });

  describe('executeTool', () => {
    it('should execute a valid tool', async () => {
      const orchestrator = createAgentOrchestrator({ autoApproveFileCreation: true });
      mockExecuteAgentTool.mockResolvedValue({
        success: true,
        data: { content: 'file content' },
      });

      const result = await orchestrator.executeTool('devonz_read_file', { path: '/test.ts' });
      expect(result.success).toBe(true);
      expect(mockExecuteAgentTool).toHaveBeenCalledWith('devonz_read_file', { path: '/test.ts' });
    });

    it('should track tool calls', async () => {
      const orchestrator = createAgentOrchestrator();
      mockExecuteAgentTool.mockResolvedValue({ success: true, data: {} });
      await orchestrator.executeTool('devonz_read_file', { path: '/test.ts' });

      const state = orchestrator.getState();
      expect(state.totalToolCalls).toBe(1);
      expect(state.toolCalls).toHaveLength(1);
      expect(state.lastany /* ToolCall */?.name).toBe('devonz_read_file');
    });

    it('should return error for unknown tool', async () => {
      const orchestrator = createAgentOrchestrator();
      mockIsAgentTool.mockReturnValue(false);

      const result = await orchestrator.executeTool('unknown_tool', {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown agent tool');
    });

    it('should track files created', async () => {
      const orchestrator = createAgentOrchestrator({ autoApproveFileCreation: true });
      mockExecuteAgentTool.mockResolvedValue({
        success: true,
        data: { path: '/new-file.ts', created: true },
      });
      await orchestrator.executeTool('devonz_write_file', {
        path: '/new-file.ts',
        content: 'content',
      });

      const state = orchestrator.getState();
      expect(state.filesCreated).toContain('/new-file.ts');
    });

    it('should track commands executed', async () => {
      const orchestrator = createAgentOrchestrator({ autoApproveCommands: true });
      mockExecuteAgentTool.mockResolvedValue({
        success: true,
        data: { exitCode: 0, output: 'done' },
      });
      await orchestrator.executeTool('devonz_run_command', { command: 'npm install' });

      const state = orchestrator.getState();
      expect(state.commandsExecuted).toContain('npm install');
    });

    it('should notify onToolExecuted callback', async () => {
      const onToolExecuted = vi.fn();
      const orchestrator = createAgentOrchestrator({}, { onToolExecuted });
      mockExecuteAgentTool.mockResolvedValue({ success: true, data: {} });
      await orchestrator.executeTool('devonz_read_file', { path: '/test.ts' });
      expect(onToolExecuted).toHaveBeenCalled();

      const record = onToolExecuted.mock.calls[0][0] as ToolCallRecord;
      expect(record.name).toBe('devonz_read_file');
    });
  });

  describe('approval flow tests', () => {
    it('requests approval when autoApproveCommands is false', async () => {
      const onApprovalNeeded = vi.fn().mockResolvedValue(true);
      const orch = createAgentOrchestrator({ autoApproveCommands: false }, { onApprovalNeeded });
      mockExecuteAgentTool.mockResolvedValue({ success: true, data: {} });
      await orch.executeTool('devonz_run_command', { command: 'npm test' });
      expect(onApprovalNeeded).toHaveBeenCalled();
      expect(mockExecuteAgentTool).toHaveBeenCalled();
    });

    it('does not execute when approval is denied', async () => {
      const onApprovalNeeded = vi.fn().mockResolvedValue(false);
      const orch = createAgentOrchestrator({ autoApproveCommands: false }, { onApprovalNeeded });
      const result = await orch.executeTool('devonz_run_command', { command: 'npm test' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('not approved');
      expect(mockExecuteAgentTool).not.toHaveBeenCalled();
    });

    it('skips approval with autoApproveAll option', async () => {
      const onApprovalNeeded = vi.fn();
      const orch = createAgentOrchestrator({ autoApproveCommands: false }, { autoApproveAll: true, onApprovalNeeded });
      mockExecuteAgentTool.mockResolvedValue({ success: true, data: {} });
      await orch.executeTool('devonz_run_command', { command: 'npm test' });
      expect(onApprovalNeeded).not.toHaveBeenCalled();
      expect(mockExecuteAgentTool).toHaveBeenCalled();
    });
  });

  describe('incrementIteration', () => {
    it('should increment iteration counter', () => {
      const orchestrator = createAgentOrchestrator();
      orchestrator.startSession('Task');
      orchestrator.incrementIteration();
      expect(orchestrator.getState().iteration).toBe(1);
    });

    it('should return true when can continue', () => {
      const orchestrator = createAgentOrchestrator({ maxIterations: 10 });
      orchestrator.startSession('Task');
      expect(orchestrator.incrementIteration()).toBe(true);
    });

    it('should return false when at limit', () => {
      const orchestrator = createAgentOrchestrator({ maxIterations: 1 });
      orchestrator.startSession('Task');
      expect(orchestrator.incrementIteration()).toBe(false);
    });

    it('should notify onIterationComplete callback', () => {
      const onIterationComplete = vi.fn();
      const orchestrator = createAgentOrchestrator({}, { onIterationComplete });
      orchestrator.startSession('Task');
      orchestrator.incrementIteration();
      expect(onIterationComplete).toHaveBeenCalledWith(1, expect.any(Object));
    });
  });

  describe('isNearIterationLimit', () => {
    it('should return false when not near limit', () => {
      const orchestrator = createAgentOrchestrator({ maxIterations: 25 });
      orchestrator.startSession('Task');
      expect(orchestrator.isNearIterationLimit()).toBe(false);
    });

    it('should return true when within 5 of limit', () => {
      const orchestrator = createAgentOrchestrator({ maxIterations: 25 });
      orchestrator.startSession('Task');

      for (let i = 0; i < 20; i++) {
        orchestrator.incrementIteration();
      }
      expect(orchestrator.isNearIterationLimit()).toBe(true);
    });
  });

  describe('getIterationWarningPrompt', () => {
    it('should return null when not near limit', () => {
      const orchestrator = createAgentOrchestrator({ maxIterations: 25 });
      orchestrator.startSession('Task');
      expect(orchestrator.getIterationWarningPrompt()).toBeNull();
    });

    it('should return warning when near limit', () => {
      const orchestrator = createAgentOrchestrator({ maxIterations: 25 });
      orchestrator.startSession('Task');

      for (let i = 0; i < 21; i++) {
        orchestrator.incrementIteration();
      }
      expect(orchestrator.getIterationWarningPrompt()).toBe('Iteration warning');
    });
  });

  describe('setError', () => {
    it('should set error state', () => {
      const orchestrator = createAgentOrchestrator();
      orchestrator.startSession('Task');
      orchestrator.setError('Something went wrong');

      const state = orchestrator.getState();
      expect(state.status).toBe('error');
      expect(state.errorMessage).toBe('Something went wrong');
    });
  });

  describe('getSessionSummary', () => {
    it('should return session summary', async () => {
      const orchestrator = createAgentOrchestrator({ autoApproveFileCreation: true });
      orchestrator.startSession('Task');
      orchestrator.incrementIteration();
      mockExecuteAgentTool.mockResolvedValue({
        success: true,
        data: { path: '/test.ts', created: true },
      });
      await orchestrator.executeTool('devonz_write_file', {
        path: '/test.ts',
        content: 'content',
      });

      const summary = orchestrator.getSessionSummary();
      expect(summary).toContain('1 iterations');
      expect(summary).toContain('1 tool calls');
      expect(summary).toContain('/test.ts');
    });
  });

  describe('abort', () => {
    it('should set status to idle', () => {
      const orchestrator = createAgentOrchestrator();
      orchestrator.startSession('Task');
      orchestrator.abort();
      expect(orchestrator.getState().status).toBe('idle');
    });
  });

  describe('getAvailableTools', () => {
    it('should return list of tool names', async () => {
      const orchestrator = createAgentOrchestrator();
      const tools = await orchestrator.getAvailableTools();
      expect(tools).toContain('devonz_read_file');
      expect(tools).toContain('devonz_write_file');
    });
  });
});

describe('Singleton functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAgentOrchestrator();
  });

  afterEach(() => {
    resetAgentOrchestrator();
  });

  describe('getAgentOrchestrator', () => {
    it('should return singleton instance', () => {
      const instance1 = getAgentOrchestrator();
      const instance2 = getAgentOrchestrator();
      expect(instance1).toBe(instance2);
    });

    it('should apply initial settings to new instance', () => {
      const instance = getAgentOrchestrator({ maxIterations: 50 });
      expect(instance.getSettings().maxIterations).toBe(50);
    });
  });

  describe('createAgentOrchestrator', () => {
    it('should create non-singleton instances', () => {
      const instance1 = createAgentOrchestrator();
      const instance2 = createAgentOrchestrator();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('resetAgentOrchestrator', () => {
    it('should clear singleton instance', () => {
      const instance1 = getAgentOrchestrator();
      resetAgentOrchestrator();

      const instance2 = getAgentOrchestrator();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('getAgentStatus', () => {
    it('should return null when no instance', () => {
      expect(getAgentStatus()).toBeNull();
    });

    it('should return status from singleton', () => {
      const orchestrator = getAgentOrchestrator();
      orchestrator.startSession('Task');
      expect(getAgentStatus()).toBe('thinking');
    });
  });
});

describe('isAgentModeAvailable', () => {
  it('should return boolean', async () => {
    expect(typeof (await isAgentModeAvailable())).toBe('boolean');
  });
});
