/**
 * Agent Types - Shared Type Definitions
 *
 * Migrated from app/lib/agent/types.ts
 * Type definitions for the Devonz AI Agent Mode tools and execution.
 */

/**
 * Result of a tool execution
 */
export interface ToolExecutionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Read file tool parameters
 */
export interface ReadFileParams {
  path: string;
  startLine?: number;
  endLine?: number;
}

/**
 * Read file tool result data
 */
export interface ReadFileResult {
  content: string;
  path: string;
  lineCount: number;
  truncated?: boolean;
}

/**
 * Write file tool parameters
 */
export interface WriteFileParams {
  path: string;
  content: string;
  encoding?: 'utf-8' | 'base64';
}

/**
 * Write file tool result data
 */
export interface WriteFileResult {
  path: string;
  bytesWritten: number;
  created: boolean;
}

/**
 * List directory tool parameters
 */
export interface ListDirectoryParams {
  path?: string;
  recursive?: boolean;
  maxDepth?: number;
}

/**
 * Directory entry
 */
export interface DirectoryEntry {
  name: string;
  isDirectory: boolean;
  size?: number;
}

/**
 * List directory tool result data
 */
export interface ListDirectoryResult {
  path: string;
  entries: DirectoryEntry[];
  totalCount?: number;
  truncated?: boolean;
}

/**
 * Run command tool parameters
 */
export interface RunCommandParams {
  command: string;
  cwd?: string;
  timeout?: number;
}

/**
 * Run command tool result data
 */
export interface RunCommandResult {
  command?: string;
  exitCode: number;
  stdout?: string;
  stderr?: string;
  output?: string;
  timedOut?: boolean;
}

/**
 * Error source types
 */
export type AgentErrorSource = 'terminal' | 'preview' | 'build' | 'all';

/**
 * Get errors tool parameters
 */
export interface GetErrorsParams {
  source?: AgentErrorSource;
}

/**
 * Error info entry used internally
 */
export interface ErrorInfo {
  source: string;
  type: string;
  message: string;
  file?: string;
  line?: number;
  column?: number;
  content?: string;
}

/**
 * Error entry for API responses
 */
export interface ErrorEntry {
  source: string;
  message: string;
  file?: string;
  line?: number;
  column?: number;
}

/**
 * Get errors tool result data
 */
export interface GetErrorsResult {
  hasErrors: boolean;
  count: number;
  errors: ErrorInfo[] | ErrorEntry[];
}

/**
 * Search code tool parameters
 */
export interface SearchCodeParams {
  query: string;
  path?: string;
  maxResults?: number;
  includePattern?: string;
  excludePattern?: string;
  caseSensitive?: boolean;
}

/**
 * Search match entry
 */
export interface SearchMatch {
  file: string;
  line: number;
  content: string;
  matchStart?: number;
  matchEnd?: number;
}

/**
 * Search code tool result data
 */
export interface SearchCodeResult {
  query: string;
  matchCount: number;
  results: SearchMatch[];
  truncated?: boolean;
}

/**
 * Read document tool parameters
 */
export interface ReadDocumentParams {
  path: string;
  sheet?: string;
  maxPages?: number;
}

/**
 * Read document tool result data
 */
export interface ReadDocumentResult {
  content: string;
  path: string;
  format: string;
  pages?: number;
  sheets?: string[];
  wordCount?: number;
}

/**
 * Apply patch tool parameters
 */
export interface ApplyPatchParams {
  path: string;
  patch: string;
}

/**
 * Apply patch tool result data
 */
export interface ApplyPatchResult {
  path: string;
  success: boolean;
}

/**
 * Index document tool parameters
 */
export interface IndexDocumentParams {
  path: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Index document tool result data
 */
export interface IndexDocumentResult {
  indexed: boolean;
  path: string;
  chunks?: number;
}

/**
 * Agent tool definition
 */
export interface AgentToolDefinition<TParams = Record<string, unknown>, TResult = unknown> {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<
      string,
      {
        type: string;
        description: string;
        default?: unknown;
        enum?: string[];
      }
    >;
    required: string[];
  };
  execute: (args: TParams) => Promise<ToolExecutionResult<TResult>>;
}

/**
 * Map of all agent tools
 */
export type AgentToolsMap = Record<string, AgentToolDefinition>;

/**
 * Agent mode settings
 */
export interface AgentModeSettings {
  enabled: boolean;
  autoApproveFileCreation: boolean;
  autoApproveFileModification: boolean;
  autoApproveCommands: boolean;
  maxIterations: number;
}

/**
 * Default agent mode settings
 */
export const DEFAULT_AGENT_SETTINGS: AgentModeSettings = {
  enabled: false,
  autoApproveFileCreation: true,
  autoApproveFileModification: false,
  autoApproveCommands: false,
  maxIterations: 25,
};

/**
 * Agent execution status
 */
export type AgentStatus =
  | 'idle'
  | 'thinking'
  | 'executing'
  | 'waiting_for_approval'
  | 'waiting_for_user'
  | 'error'
  | 'completed';

/**
 * Tool call record
 */
export interface ToolCallRecord {
  /** Unique ID for this tool call */
  id?: string;

  /** Tool name */
  name: string;
  params: Record<string, unknown>;
  result: ToolExecutionResult;
  timestamp: number;
  duration?: number;
}

/**
 * Pending approval request
 */
export interface ApprovalRequest {
  id?: string;
  type?: 'file_create' | 'file_modify' | 'command';
  description?: string;
  toolName: string;
  params: Record<string, unknown>;
  timestamp?: number;
  reason?: string;
}

/**
 * Agent execution state
 */
export interface AgentExecutionState {
  iteration: number;
  maxIterations: number;
  status: AgentStatus;
  isExecuting: boolean;
  lastany /* ToolCall */?: ToolCallRecord;
  toolCalls: ToolCallRecord[];
  totalToolCalls: number;
  sessionStartTime: number | null;
  sessionEndTime?: number;
  currentTask?: string;
  errorMessage?: string;
  filesCreated: string[];
  filesModified: string[];
  commandsExecuted: string[];

  /** Pending approval request */
  pendingApproval?: ApprovalRequest;
}

/**
 * Initial agent execution state
 */
export const INITIAL_AGENT_STATE: AgentExecutionState = {
  iteration: 0,
  maxIterations: 25,
  status: 'idle',
  isExecuting: false,
  toolCalls: [],
  totalToolCalls: 0,
  sessionStartTime: null,
  filesCreated: [],
  filesModified: [],
  commandsExecuted: [],
};

/**
 * Agent task request
 */
export interface AgentTaskRequest {
  task: string;
  chatId: string;
  maxIterations?: number;
  settings?: Partial<AgentModeSettings>;
}

/**
 * Agent task result
 */
export interface AgentTaskResult {
  success: boolean;
  summary: string;
  state: AgentExecutionState;
  error?: string;
}

/**
 * Agent orchestrator options
 */
export interface AgentOrchestratorOptions {
  maxIterations?: number;
  onStatusChange?: (status: AgentStatus) => void;
  onToolExecuted?: (record: ToolCallRecord) => void;
  onIterationComplete?: (iteration: number, state: AgentExecutionState) => void;
  onApprovalNeeded?: (request: ApprovalRequest) => Promise<boolean>;
  autoApproveAll?: boolean;
}
