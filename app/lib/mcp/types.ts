/**
 * MCP Types - Shared types for the MCP client/server system
 *
 * MCP = Model Context Protocol
 * Provides structured tool access for the multi-agent system
 */

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * AGENT TYPES
 * ═══════════════════════════════════════════════════════════════════════════
 */

export type AgentName = 'coordinator' | 'researcher' | 'architect';

export type AgentRole = {
  name: AgentName;
  model: string;
  description: string;
  permissions: ToolPermission[];
};

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * TOOL TYPES
 * ═══════════════════════════════════════════════════════════════════════════
 */

export type ToolCategory = 'fs' | 'run' | 'sec' | 'proj' | 'diag';

export type ToolPermission =
  | 'fs.read'
  | 'fs.search'
  | 'fs.patch'
  | 'fs.create'
  | 'fs.delete'

  // Execution
  | 'run.lint'
  | 'run.typecheck'
  | 'run.tests'
  | 'run.build'
  | 'run.install'
  | 'run.format'
  | 'run.devServer'

  // Security
  | 'sec.audit'
  | 'sec.scan'
  | 'sec.secrets'

  // Project Intelligence
  | 'proj.config'
  | 'proj.deps'
  | 'proj.routes'

  // Diagnostics
  | 'diag.logs'
  | 'diag.errors';

export interface any /* ToolCall */ {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  agent: AgentName;
  runId: string;
  timestamp: number;
}

export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  duration: number;
  auditId: string;
}

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * FILE SYSTEM TOOL TYPES
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface FsListTreeResult {
  root: string;
  files: Array<{
    path: string;
    size: number;
    language?: string;
  }>;
  dirs: string[];
  totalFiles: number;
  totalDirs: number;
}

export interface FsReadFileResult {
  path: string;
  content: string;
  language: string;
  size: number;
  encoding: string;
}

export interface FsSearchResult {
  query: string;
  matches: Array<{
    file: string;
    line: number;
    column: number;
    text: string;
    context?: string;
  }>;
  totalMatches: number;
  filesSearched: number;
}

export interface FsApplyPatchResult {
  success: boolean;
  filesChanged: Array<{
    path: string;
    action: 'modified' | 'created' | 'deleted';
    linesAdded: number;
    linesRemoved: number;
  }>;
  rejected?: string[];
}

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * EXECUTION TOOL TYPES
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface RunLintResult {
  exitCode: number;
  issues: Array<{
    file: string;
    line: number;
    column: number;
    severity: 'error' | 'warning';
    rule: string;
    message: string;
  }>;
  errorCount: number;
  warningCount: number;
  fixableCount: number;
}

export interface RunTypecheckResult {
  exitCode: number;
  errors: Array<{
    file: string;
    line: number;
    column: number;
    code: string;
    message: string;
  }>;
  errorCount: number;
}

export interface RunTestsResult {
  exitCode: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  coverage?: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  failures?: Array<{
    name: string;
    file: string;
    error: string;
  }>;
}

export interface RunBuildResult {
  exitCode: number;
  success: boolean;
  duration: number;
  artifacts: string[];
  errors: string[];
  warnings: string[];
}

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * SECURITY TOOL TYPES
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface SecAuditResult {
  vulnerabilities: Array<{
    id: string;
    package: string;
    version: string;
    severity: 'low' | 'moderate' | 'high' | 'critical';
    title: string;
    url?: string;
    fixAvailable: boolean;
    fixVersion?: string;
  }>;
  metadata: {
    totalDependencies: number;
    vulnerableCount: number;
  };
}

export interface SecScanResult {
  findings: Array<{
    id: string;
    rule: string;
    severity: 'info' | 'warning' | 'error';
    file: string;
    line: number;
    message: string;
    category: string;
  }>;
  scannedFiles: number;
}

export interface SecSecretsResult {
  secrets: Array<{
    file: string;
    line: number;
    type: string;
    value: string; // Redacted
  }>;
  clean: boolean;
}

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * PROJECT INTELLIGENCE TYPES
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface ProjConfigResult {
  framework: string;
  configs: {
    tsconfig?: object;
    eslint?: object;
    prettier?: object;
    vite?: object;
    remix?: object;
  };
  packageJson: {
    name: string;
    version: string;
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };
}

export interface ProjDepsResult {
  dependencies: Array<{
    name: string;
    version: string;
    type: 'prod' | 'dev';
    outdated?: string;
  }>;
  graph: Record<string, string[]>;
}

export interface ProjRoutesResult {
  routes: Array<{
    path: string;
    file: string;
    method?: string;
    hasLoader: boolean;
    hasAction: boolean;
  }>;
}

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * AUDIT LOG TYPES
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  agent: AgentName;
  runId: string;
  tool: string;
  args: Record<string, unknown>;
  result: 'success' | 'error' | 'denied';
  duration: number;
  filesChanged?: string[];
  error?: string;
}
