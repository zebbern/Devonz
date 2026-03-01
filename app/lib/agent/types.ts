/**
 * Agent Tools Type Definitions
 *
 * Type definitions for the Alinma coder AI Agent Mode tools and execution.
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
  /** File path relative to project root */
  path: string;

  /** Optional: Start reading from this line (1-indexed) */
  startLine?: number;

  /** Optional: Stop reading at this line (inclusive) */
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
  /** File path relative to project root */
  path: string;

  /** The complete file content to write */
  content: string;
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
  /** Directory path relative to project root (use "/" for root) */
  path?: string;

  /** If true, list all files recursively. Default false. */
  recursive?: boolean;

  /** Maximum depth for recursive listing. Default 3. */
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
  /** The shell command to execute */
  command: string;

  /** Working directory for the command (relative to project root) */
  cwd?: string;

  /** Timeout in milliseconds. Default 30000 (30 seconds). */
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
  /** Which error source to check. Default "all". */
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
  /** Text or regex pattern to search for */
  query: string;

  /** Directory path to search in. Default "/". */
  path?: string;

  /** Maximum results to return. Default 50. */
  maxResults?: number;

  /** Regex pattern to include only matching file paths */
  includePattern?: string;

  /** Regex pattern to exclude matching file paths */
  excludePattern?: string;

  /** Comma-separated file extensions or patterns to search (e.g., ".tsx,.ts" or "*.css"). Defaults to common code extensions. */
  filePattern?: string;

  /** Whether the search is case-sensitive. Default false. */
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
 * Agent tool definition
 */
export interface AgentToolDefinition<TParams = Record<string, unknown>, TResult = unknown> {
  /** Tool name (alinma_coder_* namespace) */
  name: string;

  /** Human-readable description for LLM */
  description: string;

  /** JSON Schema for parameters */
  parameters: {
    type: 'object';
    properties: Record<
      string,
      {
        type: string;
        description: string;
        default?: unknown;
        enum?: string[];
        items?: {
          type: string;
          properties?: Record<string, { type: string; description: string }>;
          required?: string[];
        };
      }
    >;
    required: string[];
  };

  /** Execute function */
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
  /** Whether agent mode is enabled */
  enabled: boolean;

  /** Auto-approve file creation without confirmation */
  autoApproveFileCreation: boolean;

  /** Auto-approve file modification without confirmation */
  autoApproveFileModification: boolean;

  /** Auto-approve shell commands without confirmation */
  autoApproveCommands: boolean;

  /** Maximum iterations before asking for user input */
  maxIterations: number;
}

/**
 * Default agent mode settings
 */
export const DEFAULT_AGENT_SETTINGS: AgentModeSettings = {
  enabled: false,
  autoApproveFileCreation: true,
  autoApproveFileModification: true,
  autoApproveCommands: true,
  maxIterations: 25,
};

/**
 * Plan phase for multi-step planning workflow
 */
export type PlanPhase = 'idle' | 'planning' | 'executing' | 'reviewing';

/**
 * Sub-task status for decomposed work items
 */
export type SubTaskStatus = 'pending' | 'in-progress' | 'done' | 'failed';

/**
 * Sub-task for decomposed complex requests.
 * Depth is capped at 2 (0 = root, 1 = child, 2 = grandchild).
 */
export interface SubTask {
  /** Unique identifier for this sub-task */
  readonly id: string;

  /** Short title describing the sub-task */
  readonly title: string;

  /** Current status of the sub-task */
  readonly status: SubTaskStatus;

  /** ID of the parent task that spawned this sub-task */
  readonly parentTaskId: string;

  /**
   * Nesting depth — 0 = root-level, 1 = child, 2 = grandchild.
   * Maximum depth is 2; deeper decomposition is not permitted.
   */
  readonly depth: 0 | 1 | 2;
}

/**
 * Self-review cycle record for run→detect→fix loops
 */
export interface ReviewCycle {
  /** Sequential cycle number within the current session (1-based) */
  readonly cycleNumber: number;

  /** What triggered this review cycle */
  readonly triggeredBy: 'auto' | 'user' | 'error-detection';

  /** Errors discovered during this review cycle */
  readonly errorsFound: readonly string[];

  /** Whether a fix was attempted in response to the errors */
  readonly fixAttempted: boolean;

  /** Stable fingerprint for deduplication across cycles */
  readonly fingerprint: string;
}

/**
 * Cross-session memory reference for persistent context
 */
export interface MemoryRef {
  /** Unique key identifying this memory entry */
  readonly key: string;

  /** Category grouping for the memory (e.g., 'preference', 'pattern', 'decision') */
  readonly category: string;

  /** Human-readable summary of the stored memory */
  readonly summary: string;

  /** ISO 8601 timestamp when the memory was first created */
  readonly createdAt: string;

  /** ISO 8601 timestamp when the memory was last updated */
  readonly updatedAt: string;
}

/**
 * Metadata for a conversation branch point
 */
export interface BranchMetadata {
  /** Unique identifier for this branch */
  readonly branchId: string;

  /** Chat ID of the parent conversation */
  readonly parentChatId: string;

  /** Message ID where the branch diverges from the parent */
  readonly branchPointMessageId: string;

  /** User-facing label for this branch */
  readonly label: string;

  /** ISO 8601 timestamp when the branch was created */
  readonly createdAt: string;
}

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

  /** Tool parameters */
  params: Record<string, unknown>;

  /** Tool result */
  result: ToolExecutionResult;

  /** Timestamp */
  timestamp: number;

  /** Duration in milliseconds */
  duration?: number;
}

/**
 * Agent execution state
 */
export interface AgentExecutionState {
  /** Current iteration count */
  iteration: number;

  /** Maximum iterations allowed */
  maxIterations: number;

  /** Current agent status */
  status: AgentStatus;

  /** Whether agent is currently executing */
  isExecuting: boolean;

  /** Last tool call made */
  lastToolCall?: ToolCallRecord;

  /** All tool calls in this session */
  toolCalls: ToolCallRecord[];

  /** Total tool calls count */
  totalToolCalls: number;

  /** Session start time */
  sessionStartTime: number | null;

  /** Current task description */
  currentTask?: string;

  /** Error message if status is 'error' */
  errorMessage?: string;

  /** Files created during this session */
  filesCreated: string[];

  /** Files modified during this session */
  filesModified: string[];

  /** Commands executed during this session */
  commandsExecuted: string[];

  /** Session end time */
  sessionEndTime?: number;

  /** Pending approval request */
  pendingApproval?: ApprovalRequest;

  /** Current plan phase for multi-step planning workflow */
  planPhase: PlanPhase;

  /** Decomposed sub-tasks for the current execution */
  subTasks: readonly SubTask[];

  /** Current self-review cycle state (undefined when no review is active) */
  reviewCycle?: ReviewCycle;

  /** Cross-session memory references loaded for this execution */
  memoryRefs: readonly MemoryRef[];
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
  planPhase: 'idle',
  subTasks: [],
  memoryRefs: [],
};

/**
 * Agent task request
 */
export interface AgentTaskRequest {
  /** The user's task description */
  task: string;

  /** Chat ID for the session */
  chatId: string;

  /** Optional: Maximum iterations for this task */
  maxIterations?: number;

  /** Optional: Settings overrides */
  settings?: Partial<AgentModeSettings>;
}

/**
 * Agent task result
 */
export interface AgentTaskResult {
  /** Whether the task completed successfully */
  success: boolean;

  /** Summary of what was accomplished */
  summary: string;

  /** Final execution state */
  state: AgentExecutionState;

  /** Error message if failed */
  error?: string;
}

/**
 * Pending approval request
 */
export interface ApprovalRequest {
  /** Unique ID for this approval request */
  id?: string;

  /** Type of action requiring approval */
  type?: 'file_create' | 'file_modify' | 'command';

  /** Reason for approval */
  reason?: string;

  /** Description of the action */
  description?: string;

  /** Tool name */
  toolName?: string;

  /** Tool parameters */
  params?: Record<string, unknown>;

  /** Timestamp when approval was requested */
  timestamp?: number;
}

/**
 * Agent orchestrator options
 */
export interface AgentOrchestratorOptions {
  /** Maximum iterations before stopping */
  maxIterations?: number;

  /** Callback when status changes */
  onStatusChange?: (status: AgentStatus) => void;

  /** Callback when tool is executed */
  onToolExecuted?: (record: ToolCallRecord) => void;

  /** Callback when iteration completes */
  onIterationComplete?: (iteration: number, state: AgentExecutionState) => void;

  /** Callback when approval is needed */
  onApprovalNeeded?: (request: ApprovalRequest) => Promise<boolean>;

  /** Whether to auto-approve all actions (for testing) */
  autoApproveAll?: boolean;
}

/*
 * ---------------------------------------------------------------------------
 * Agent Mode v3 — Multi-Turn Intelligence Types
 * ---------------------------------------------------------------------------
 */

/**
 * Tracks cumulative and per-step token usage across a conversation.
 * Used by the context window manager to decide when to summarize or prune.
 */
export interface TokenBudgetState {
  /** Cumulative prompt (input) tokens consumed so far */
  readonly promptTokens: number;

  /** Cumulative completion (output) tokens consumed so far */
  readonly completionTokens: number;

  /** Total tokens consumed (promptTokens + completionTokens) */
  readonly totalTokens: number;

  /** Maximum context window size for the active model */
  readonly maxContextTokens: number;

  /** Current usage as a percentage of maxContextTokens (0–100) */
  readonly usagePercentage: number;

  /** Estimated remaining full-sized LLM steps before the window is exhausted */
  readonly stepsRemaining: number;
}

/**
 * Configuration for context window management thresholds.
 * Determines when the agent should trigger mid-conversation summarization.
 */
export interface ContextWindowConfig {
  /**
   * Percentage of maxContextTokens at which summarization is triggered.
   * @default 75
   */
  readonly thresholdPercentage: number;

  /**
   * Safety margin percentage reserved below maxContextTokens to prevent
   * hard truncation by the provider.
   * @default 10
   */
  readonly safetyMarginPercentage: number;

  /** Maximum context window size (model-specific) */
  readonly maxContextTokens: number;
}

/**
 * Phase-boundary snapshot for conversation recovery.
 * Stored in IndexedDB so a crashed or compacted conversation can resume.
 */
export interface AgentCheckpoint {
  /** Unique checkpoint identifier */
  readonly id: string;

  /** Chat ID the checkpoint belongs to */
  readonly chatId: string;

  /** Plan phase at the time the checkpoint was created */
  readonly phase: PlanPhase;

  /** ISO 8601 timestamp of checkpoint creation */
  readonly timestamp: string;

  /** Serialised conversation messages (JSON string) */
  readonly messages: string;

  /** Serialised agent execution state (JSON string) */
  readonly agentState: string;

  /** Token budget snapshot at checkpoint time */
  readonly tokenBudget: TokenBudgetState;
}

/**
 * Status of a parallel tool batch execution
 */
export type ParallelToolBatchStatus = 'pending' | 'executing' | 'complete' | 'failed';

/**
 * Single tool invocation within a parallel batch
 */
export interface ParallelToolCall {
  /** Tool name (devonz_* namespace) */
  readonly name: string;

  /** Tool parameters */
  readonly params: Record<string, unknown>;
}

/**
 * Result of a single tool invocation within a parallel batch
 */
export interface ParallelToolResult {
  /** Tool name that produced this result */
  readonly name: string;

  /** Execution result */
  readonly result: ToolExecutionResult;
}

/**
 * A batch of independent read-only tool calls that can execute in parallel.
 * Used to speed up information-gathering steps by running multiple reads concurrently.
 */
export interface ParallelToolBatch {
  /** Unique batch identifier */
  readonly batchId: string;

  /** Grouped tool invocations to execute in parallel */
  readonly tools: readonly ParallelToolCall[];

  /** Current batch execution status */
  readonly status: ParallelToolBatchStatus;

  /** Results collected after execution (one per tool, same order as tools) */
  readonly results: readonly ParallelToolResult[];
}
