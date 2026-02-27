/**
 * MCP Client - Agent Permission Matrix
 *
 * Defines capability-based access control per agent.
 * This is the authoritative rulebook for what each agent can do.
 */

import type { AgentName, AgentRole, ToolPermission } from '~/lib/mcp/types';

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * AGENT ROLE DEFINITIONS
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Coordinator (GPT-5.2) - Human-facing orchestrator
 * Has broad access to orchestrate other agents and interact with user
 */
const coordinatorRole: AgentRole = {
  name: 'coordinator',
  model: 'gpt-5',
  description: 'Human-facing orchestrator. Receives user requests, delegates to specialists, merges outputs.',
  permissions: [
    // Full read access
    'fs.read',
    'fs.search',

    // Write access (patch-based)
    'fs.patch',
    'fs.create',
    'fs.delete', // Gated - requires approval
    // Full execution access
    'run.lint',
    'run.typecheck',
    'run.tests',
    'run.build',
    'run.install', // Gated - requires approval
    'run.format',
    'run.devServer',

    // Security scans
    'sec.audit',
    'sec.scan',
    'sec.secrets',

    // Project intelligence
    'proj.config',
    'proj.deps',
    'proj.routes',

    // Diagnostics
    'diag.logs',
    'diag.errors',
  ],
};

/**
 * Researcher (Gemini) - Read-only research specialist
 * Cannot write files, install deps, or execute commands
 */
const researcherRole: AgentRole = {
  name: 'researcher',
  model: 'gemini-3-flash-preview',
  description: 'Read-only research specialist. Tech reality checks, competency mapping, security audits.',
  permissions: [
    // Read-only file access
    'fs.read',
    'fs.search',

    // Security scans (read-only output)
    'sec.audit',
    'sec.scan',

    // Project intelligence (read-only)
    'proj.config',
    'proj.deps',
    'proj.routes',

    /*
     * NO: fs.patch, fs.create, fs.delete
     * NO: run.* (cannot execute anything)
     * NO: diag.* (not needed)
     */
  ],
};

/**
 * Architect (Claude) - Code builder/fixer
 * Can read files, produce patches, and run validation
 */
const architectRole: AgentRole = {
  name: 'architect',
  model: 'claude-sonnet-4-5-20250929',
  description: 'Code builder/fixer. Generates patches, validates with typecheck/tests.',
  permissions: [
    // Read access
    'fs.read',
    'fs.search',

    // Patch production (Coordinator applies)
    'fs.patch',

    // Validation only (no build/install)
    'run.lint',
    'run.typecheck',
    'run.tests',
    'run.format',

    // Project intelligence
    'proj.config',
    'proj.deps',
    'proj.routes',

    // Diagnostics
    'diag.errors',

    /*
     * NO: fs.create, fs.delete (dangerous)
     * NO: run.build, run.install, run.devServer (Coordinator only)
     * NO: sec.* (Researcher handles security)
     */
  ],
};

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * PERMISSION REGISTRY
 * ═══════════════════════════════════════════════════════════════════════════
 */

const agentRoles: Record<AgentName, AgentRole> = {
  coordinator: coordinatorRole,
  researcher: researcherRole,
  architect: architectRole,
};

/**
 * Tools that require explicit user approval before execution
 */
const gatedTools: ToolPermission[] = ['fs.delete', 'run.install'];

/**
 * Tools that are completely blocked (safety net)
 */
const blockedTools: string[] = [
  'fs.rawWrite', // Never allow raw file overwrite
  'run.shell', // Never allow raw shell access
];

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * PERMISSION CHECK FUNCTIONS
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Check if an agent has permission to use a specific tool
 */
export function hasPermission(agent: AgentName, permission: ToolPermission): boolean {
  const role = agentRoles[agent];

  if (!role) {
    return false;
  }

  return role.permissions.includes(permission);
}

/**
 * Check if a tool requires user approval
 */
export function requiresApproval(permission: ToolPermission): boolean {
  return gatedTools.includes(permission);
}

/**
 * Check if a tool is completely blocked
 */
export function isBlocked(tool: string): boolean {
  return blockedTools.includes(tool);
}

/**
 * Get all permissions for an agent
 */
export function getAgentPermissions(agent: AgentName): ToolPermission[] {
  return agentRoles[agent]?.permissions || [];
}

/**
 * Get agent role definition
 */
export function getAgentRole(agent: AgentName): AgentRole | undefined {
  return agentRoles[agent];
}

/**
 * Validate a tool call against agent permissions
 */
export function validateany /* ToolCall */(
  agent: AgentName,
  tool: string,
): { allowed: boolean; reason?: string; requiresApproval?: boolean } {
  // Check if tool is blocked entirely
  if (isBlocked(tool)) {
    return { allowed: false, reason: `Tool "${tool}" is blocked for security reasons` };
  }

  // Map tool name to permission
  const permission = tool as ToolPermission;

  // Check if agent has permission
  if (!hasPermission(agent, permission)) {
    return {
      allowed: false,
      reason: `Agent "${agent}" does not have permission to use "${tool}"`,
    };
  }

  // Check if approval is required
  if (requiresApproval(permission)) {
    return { allowed: true, requiresApproval: true };
  }

  return { allowed: true };
}

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * EXPORTS
 * ═══════════════════════════════════════════════════════════════════════════
 */

export { agentRoles, gatedTools, blockedTools };
export { coordinatorRole, researcherRole, architectRole };
