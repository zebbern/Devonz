import { computed, map, type MapStore } from 'nanostores';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('StagingStore');

/*
 * ============================================================================
 * Types
 * ============================================================================
 */

/**
 * Type of file change being staged
 */
export type ChangeType = 'create' | 'modify' | 'delete';

/**
 * Status of a staged change
 */
export type ChangeStatus = 'pending' | 'accepted' | 'rejected';

/**
 * Represents a single staged file change
 */
export interface StagedChange {
  /** Unique identifier for this change */
  id: string;

  /** Full path to the file being changed */
  filePath: string;

  /** Type of change: create, modify, or delete */
  type: ChangeType;

  /** Original file content (null for new files) */
  originalContent: string | null;

  /** New content to be written (empty string for deletions) */
  newContent: string;

  /** Timestamp when change was staged */
  timestamp: number;

  /** Current status of this change */
  status: ChangeStatus;

  /** Reference to the action that created this change */
  actionId: string;

  /** Whether this change was auto-approved by pattern matching */
  autoApproved?: boolean;

  /** Optional description of what this change does */
  description?: string;
}

/**
 * Settings for the staging system
 */
export interface StagingSettings {
  /** Whether staging/confirmation is enabled */
  isEnabled: boolean;

  /** Whether to auto-approve changes matching certain patterns */
  autoApproveEnabled: boolean;

  /** Glob patterns for files that should be auto-approved */
  autoApprovePatterns: string[];

  /** Whether to always require confirmation for deletions */
  requireDeleteConfirmation: boolean;

  /** Whether to show inline diff preview on hover */
  showInlineDiffPreview: boolean;

  /** Whether to auto-create version checkpoint before batch accept */
  autoCheckpointOnAccept: boolean;
}

/**
 * Full staging store state
 */
export interface StagingState {
  /** All staged changes indexed by file path */
  changes: Record<string, StagedChange>;

  /** Currently selected change for preview (file path) */
  selectedChangePath: string | null;

  /** Whether the diff preview modal is open */
  isDiffModalOpen: boolean;

  /** Settings for staging behavior */
  settings: StagingSettings;

  /** Pending shell/start commands queued until files are accepted */
  pendingCommands: PendingCommand[];
}

/**
 * Represents a queued shell or start command
 */
export interface PendingCommand {
  /** Unique identifier for this command */
  id: string;

  /** Type of command: shell or start */
  type: 'shell' | 'start';

  /** The command content to execute */
  command: string;

  /** Timestamp when command was queued */
  timestamp: number;

  /** Reference to the artifact that generated this command */
  artifactId: string;

  /** Optional title/description */
  title?: string;
}

/*
 * ============================================================================
 * Default Values
 * ============================================================================
 */

const DEFAULT_AUTO_APPROVE_PATTERNS = [
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  '*.lock',
  'node_modules/**',
  '.git/**',
  '*.log',
];

const DEFAULT_SETTINGS: StagingSettings = {
  isEnabled: true,
  autoApproveEnabled: true,
  autoApprovePatterns: DEFAULT_AUTO_APPROVE_PATTERNS,
  requireDeleteConfirmation: true,
  showInlineDiffPreview: true,
  autoCheckpointOnAccept: true,
};

/*
 * ============================================================================
 * Store Atoms
 * ============================================================================
 */

/**
 * Main staging store containing all staged changes
 */
export const stagingStore: MapStore<StagingState> = map<StagingState>({
  changes: {},
  selectedChangePath: null,
  isDiffModalOpen: false,
  settings: loadSettingsFromStorage(),
  pendingCommands: [],
});

/*
 * ============================================================================
 * Computed Stores
 * ============================================================================
 */

/**
 * Computed store: Array of all pending changes
 */
export const pendingChanges = computed(stagingStore, (state) => {
  return Object.values(state.changes).filter((change) => change.status === 'pending');
});

/**
 * Computed store: Count of pending changes
 */
export const pendingCount = computed(pendingChanges, (changes) => changes.length);

/**
 * Computed store: Whether there are any pending changes
 */
export const hasPendingChanges = computed(pendingCount, (count) => count > 0);

/**
 * Computed store: Changes grouped by type
 */
export const changesByType = computed(pendingChanges, (changes) => {
  return {
    create: changes.filter((c) => c.type === 'create'),
    modify: changes.filter((c) => c.type === 'modify'),
    delete: changes.filter((c) => c.type === 'delete'),
  };
});

/**
 * Computed store: Statistics about staging
 */
export const stagingStats = computed(stagingStore, (state) => {
  const all = Object.values(state.changes);
  const pending = all.filter((c) => c.status === 'pending');
  const accepted = all.filter((c) => c.status === 'accepted');
  const rejected = all.filter((c) => c.status === 'rejected');

  return {
    total: all.length,
    pending: pending.length,
    accepted: accepted.length,
    rejected: rejected.length,
    reviewed: accepted.length + rejected.length,
  };
});

/**
 * Computed store: Currently selected change
 */
export const selectedChange = computed(stagingStore, (state) => {
  if (!state.selectedChangePath) {
    return null;
  }

  return state.changes[state.selectedChangePath] ?? null;
});

/**
 * Computed store: Array of all pending commands
 */
export const pendingCommandsList = computed(stagingStore, (state) => {
  return state.pendingCommands;
});

/**
 * Computed store: Count of pending commands
 */
export const pendingCommandsCount = computed(pendingCommandsList, (commands) => commands.length);

/**
 * Computed store: Whether there are any pending commands
 */
export const hasPendingCommands = computed(pendingCommandsCount, (count) => count > 0);

/*
 * ============================================================================
 * Helper Functions
 * ============================================================================
 */

/**
 * Generate a unique change ID
 */
function generateChangeId(): string {
  return `change-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Load settings from localStorage
 */
function loadSettingsFromStorage(): StagingSettings {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('bolt-staging-settings');

      if (saved) {
        const parsed = JSON.parse(saved);

        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    }
  } catch (error) {
    logger.error('Failed to load staging settings from localStorage', error);
  }

  return DEFAULT_SETTINGS;
}

/**
 * Save settings to localStorage
 */
function saveSettingsToStorage(settings: StagingSettings): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('bolt-staging-settings', JSON.stringify(settings));
    }
  } catch (error) {
    logger.error('Failed to save staging settings to localStorage', error);
  }
}

/**
 * Check if a file path matches any of the auto-approve patterns
 */
export function matchesAutoApprovePattern(filePath: string, patterns: string[]): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/');

  for (const pattern of patterns) {
    // Simple glob matching
    if (pattern.includes('**')) {
      // Handle ** glob for directory matching
      const parts = pattern.split('**');

      if (parts.length === 2) {
        const [prefix, suffix] = parts;

        if (normalizedPath.startsWith(prefix) && normalizedPath.endsWith(suffix)) {
          return true;
        }
      }
    } else if (pattern.includes('*')) {
      // Handle * glob for single segment matching
      const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');

      // Check both full path and filename
      const fileName = normalizedPath.split('/').pop() ?? '';

      if (regex.test(normalizedPath) || regex.test(fileName)) {
        return true;
      }
    } else {
      // Exact match or filename match
      const fileName = normalizedPath.split('/').pop() ?? '';

      if (normalizedPath === pattern || fileName === pattern) {
        return true;
      }
    }
  }

  return false;
}

/*
 * ============================================================================
 * Store Actions
 * ============================================================================
 */

/**
 * Stage a new file change
 */
export function stageChange(
  change: Omit<StagedChange, 'id' | 'timestamp' | 'status' | 'autoApproved'>,
): StagedChange | null {
  const state = stagingStore.get();
  const { settings } = state;

  // Debug: Log what's being staged
  console.log('[STAGING DEBUG] stageChange called:', {
    filePath: change.filePath,
    type: change.type,
    originalContentLength: change.originalContent?.length ?? 0,
    newContentLength: change.newContent?.length ?? 0,
    originalContentPreview: change.originalContent?.substring(0, 200) ?? 'null',
    newContentPreview: change.newContent?.substring(0, 200) ?? 'null',
    contentMatches: change.originalContent === change.newContent,
  });

  // Check if staging is enabled
  if (!settings.isEnabled) {
    logger.debug(`Staging disabled, skipping: ${change.filePath}`);

    return null;
  }

  // Check for auto-approve
  let autoApproved = false;

  if (settings.autoApproveEnabled) {
    // Don't auto-approve deletions if requireDeleteConfirmation is enabled
    if (change.type === 'delete' && settings.requireDeleteConfirmation) {
      autoApproved = false;
    } else {
      autoApproved = matchesAutoApprovePattern(change.filePath, settings.autoApprovePatterns);
    }
  }

  const stagedChange: StagedChange = {
    ...change,
    id: generateChangeId(),
    timestamp: Date.now(),
    status: autoApproved ? 'accepted' : 'pending',
    autoApproved,
  };

  // Update store
  stagingStore.setKey('changes', {
    ...state.changes,
    [change.filePath]: stagedChange,
  });

  logger.info(`Staged change: ${change.type} ${change.filePath}${autoApproved ? ' (auto-approved)' : ''}`);

  return stagedChange;
}

/**
 * Accept a single staged change
 * Returns the change if successful, null if not found or already processed
 */
export function acceptChange(filePathOrId: string): StagedChange | null {
  const state = stagingStore.get();

  // Find change by path or ID
  let change: StagedChange | undefined;
  let changePath: string | undefined;

  if (state.changes[filePathOrId]) {
    change = state.changes[filePathOrId];
    changePath = filePathOrId;
  } else {
    // Search by ID
    for (const [path, c] of Object.entries(state.changes)) {
      if (c.id === filePathOrId) {
        change = c;
        changePath = path;
        break;
      }
    }
  }

  if (!change || !changePath || change.status !== 'pending') {
    return null;
  }

  // Update status
  const updatedChange: StagedChange = {
    ...change,
    status: 'accepted',
  };

  stagingStore.setKey('changes', {
    ...state.changes,
    [changePath]: updatedChange,
  });

  logger.info(`Accepted change: ${change.type} ${changePath}`);

  return updatedChange;
}

/**
 * Reject a single staged change
 * Returns the change if successful, null if not found or already processed
 */
export function rejectChange(filePathOrId: string): StagedChange | null {
  const state = stagingStore.get();

  // Find change by path or ID
  let change: StagedChange | undefined;
  let changePath: string | undefined;

  if (state.changes[filePathOrId]) {
    change = state.changes[filePathOrId];
    changePath = filePathOrId;
  } else {
    // Search by ID
    for (const [path, c] of Object.entries(state.changes)) {
      if (c.id === filePathOrId) {
        change = c;
        changePath = path;
        break;
      }
    }
  }

  if (!change || !changePath || change.status !== 'pending') {
    return null;
  }

  // Update status
  const updatedChange: StagedChange = {
    ...change,
    status: 'rejected',
  };

  stagingStore.setKey('changes', {
    ...state.changes,
    [changePath]: updatedChange,
  });

  logger.info(`Rejected change: ${change.type} ${changePath}`);

  return updatedChange;
}

/**
 * Accept all pending changes
 * Returns array of accepted changes
 */
export function acceptAllChanges(): StagedChange[] {
  const state = stagingStore.get();
  const accepted: StagedChange[] = [];
  const updatedChanges = { ...state.changes };

  for (const [path, change] of Object.entries(state.changes)) {
    if (change.status === 'pending') {
      const updatedChange: StagedChange = {
        ...change,
        status: 'accepted',
      };
      updatedChanges[path] = updatedChange;
      accepted.push(updatedChange);
    }
  }

  if (accepted.length > 0) {
    stagingStore.setKey('changes', updatedChanges);
    logger.info(`Accepted ${accepted.length} changes`);
  }

  return accepted;
}

/**
 * Reject all pending changes
 * Returns array of rejected changes
 */
export function rejectAllChanges(): StagedChange[] {
  const state = stagingStore.get();
  const rejected: StagedChange[] = [];
  const updatedChanges = { ...state.changes };

  for (const [path, change] of Object.entries(state.changes)) {
    if (change.status === 'pending') {
      const updatedChange: StagedChange = {
        ...change,
        status: 'rejected',
      };
      updatedChanges[path] = updatedChange;
      rejected.push(updatedChange);
    }
  }

  if (rejected.length > 0) {
    stagingStore.setKey('changes', updatedChanges);
    logger.info(`Rejected ${rejected.length} changes`);
  }

  return rejected;
}

/**
 * Clear all changes from staging (accepted, rejected, and pending)
 */
export function clearStaging(): void {
  stagingStore.set({
    ...stagingStore.get(),
    changes: {},
    selectedChangePath: null,
    isDiffModalOpen: false,
  });
  logger.info('Staging cleared');
}

/**
 * Clear only processed changes (accepted and rejected), keep pending
 */
export function clearProcessedChanges(): void {
  const state = stagingStore.get();
  const pendingOnly: Record<string, StagedChange> = {};

  for (const [path, change] of Object.entries(state.changes)) {
    if (change.status === 'pending') {
      pendingOnly[path] = change;
    }
  }

  stagingStore.setKey('changes', pendingOnly);
  logger.info('Processed changes cleared');
}

/*
 * ============================================================================
 * Pending Commands Functions
 * ============================================================================
 */

/**
 * Check if a command with the same type and content already exists in the queue.
 * This prevents duplicate commands from being queued (e.g., from session restore or parsing issues).
 */
function isDuplicateCommand(existingCommands: PendingCommand[], newCommand: Omit<PendingCommand, 'id' | 'timestamp'>): boolean {
  // Normalize command string for comparison (trim whitespace, normalize line endings)
  const normalizedNewCommand = newCommand.command.trim().replace(/\r\n/g, '\n');

  return existingCommands.some((existing) => {
    const normalizedExisting = existing.command.trim().replace(/\r\n/g, '\n');

    return existing.type === newCommand.type && normalizedExisting === normalizedNewCommand;
  });
}

/**
 * Queue a shell or start command for execution after files are accepted.
 * Automatically deduplicates commands to prevent the same command from being queued multiple times.
 */
export function queueCommand(command: Omit<PendingCommand, 'id' | 'timestamp'>): PendingCommand | null {
  const state = stagingStore.get();

  // Check for duplicate command before adding
  if (isDuplicateCommand(state.pendingCommands, command)) {
    logger.debug(`Skipping duplicate ${command.type} command: ${command.command.substring(0, 50)}...`);

    return null; // Return null to indicate command was not queued (duplicate)
  }

  const pendingCommand: PendingCommand = {
    ...command,
    id: generateChangeId(),
    timestamp: Date.now(),
  };

  stagingStore.setKey('pendingCommands', [...state.pendingCommands, pendingCommand]);

  logger.info(`Queued ${command.type} command: ${command.command.substring(0, 50)}...`);

  return pendingCommand;
}

/**
 * Get all pending commands
 */
export function getPendingCommands(): PendingCommand[] {
  return stagingStore.get().pendingCommands;
}

/**
 * Clear all pending commands
 */
export function clearPendingCommands(): void {
  stagingStore.setKey('pendingCommands', []);
  logger.info('Pending commands cleared');
}

/**
 * Remove a specific pending command by ID
 */
export function removePendingCommand(commandId: string): boolean {
  const state = stagingStore.get();
  const filtered = state.pendingCommands.filter((cmd) => cmd.id !== commandId);

  if (filtered.length < state.pendingCommands.length) {
    stagingStore.setKey('pendingCommands', filtered);
    logger.info(`Removed pending command: ${commandId}`);

    return true;
  }

  return false;
}

/**
 * Get a specific change by file path
 */
export function getChangeForFile(filePath: string): StagedChange | null {
  return stagingStore.get().changes[filePath] ?? null;
}

/**
 * Get all accepted changes that need to be applied
 */
export function getAcceptedChanges(): StagedChange[] {
  return Object.values(stagingStore.get().changes).filter((change) => change.status === 'accepted');
}

/**
 * Get all rejected changes that need to be reverted
 */
export function getRejectedChanges(): StagedChange[] {
  return Object.values(stagingStore.get().changes).filter((change) => change.status === 'rejected');
}

/**
 * Apply all accepted changes to WebContainer filesystem
 * This actually writes the files - must be called after acceptChange/acceptAllChanges
 *
 * @param webcontainer - The WebContainer instance to write files to
 * @returns Object with arrays of applied and failed file paths
 */
export async function applyAcceptedChanges(webcontainer: {
  fs: {
    writeFile: (path: string, content: string) => Promise<void>;
    rm: (path: string, options?: { recursive?: boolean }) => Promise<void>;
    mkdir: (path: string, options: { recursive: true }) => Promise<string>;
  };
}): Promise<{ applied: string[]; failed: Array<{ path: string; error: string }> }> {
  const accepted = getAcceptedChanges();
  const applied: string[] = [];
  const failed: Array<{ path: string; error: string }> = [];

  logger.info(`Applying ${accepted.length} accepted changes to WebContainer`);

  for (const change of accepted) {
    try {
      /*
       * Convert absolute path to relative path for WebContainer
       * Paths like "/home/project/src/file.ts" -> "src/file.ts"
       */
      const relativePath = change.filePath.replace(/^\/home\/project\/?/, '');

      if (change.type === 'delete') {
        // Delete the file
        await webcontainer.fs.rm(relativePath, { recursive: false });
        logger.debug(`Deleted file: ${relativePath}`);
      } else {
        // Create directory if needed
        const pathParts = relativePath.split('/');
        const dir = pathParts.slice(0, -1).join('/');

        if (dir) {
          try {
            await webcontainer.fs.mkdir(dir, { recursive: true });
          } catch {
            // Directory might already exist, that's fine
          }
        }

        // Write the file
        await webcontainer.fs.writeFile(relativePath, change.newContent);
        logger.debug(`Wrote file: ${relativePath}`);
      }

      applied.push(change.filePath);

      // Remove the change from staging now that it's applied
      removeChange(change.filePath);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      failed.push({ path: change.filePath, error: errorMessage });
      logger.error(`Failed to apply change: ${change.filePath}`, error);

      // Don't remove failed changes - leave them for retry
    }
  }

  logger.info(`Applied ${applied.length} changes, ${failed.length} failed`);

  return { applied, failed };
}

/**
 * Revert all rejected changes by restoring original content to WebContainer filesystem
 * This actually restores the files - must be called after rejectChange/rejectAllChanges
 *
 * @param webcontainer - The WebContainer instance to write files to
 * @returns Object with arrays of reverted and failed file paths
 */
export async function applyRejectedChanges(webcontainer: {
  fs: {
    writeFile: (path: string, content: string) => Promise<void>;
    rm: (path: string, options?: { recursive?: boolean }) => Promise<void>;
    mkdir: (path: string, options: { recursive: true }) => Promise<string>;
  };
}): Promise<{ reverted: string[]; failed: Array<{ path: string; error: string }> }> {
  const rejected = getRejectedChanges();
  const reverted: string[] = [];
  const failed: Array<{ path: string; error: string }> = [];

  logger.info(`Reverting ${rejected.length} rejected changes in WebContainer`);

  for (const change of rejected) {
    try {
      /*
       * Convert absolute path to relative path for WebContainer
       * Paths like "/home/project/src/file.ts" -> "src/file.ts"
       */
      const relativePath = change.filePath.replace(/^\/home\/project\/?/, '');

      if (change.type === 'create') {
        /*
         * File was newly created and staged - it was never written to WebContainer
         * Just remove from staging, no filesystem operation needed
         */
        logger.debug(`Removing staged new file from tracking: ${relativePath}`);
      } else if (change.type === 'delete' && change.originalContent !== null) {
        // File was deleted - recreate it with original content
        const pathParts = relativePath.split('/');
        const dir = pathParts.slice(0, -1).join('/');

        if (dir) {
          try {
            await webcontainer.fs.mkdir(dir, { recursive: true });
          } catch {
            // Directory might already exist, that's fine
          }
        }

        await webcontainer.fs.writeFile(relativePath, change.originalContent);
        logger.debug(`Restored deleted file: ${relativePath}`);
      } else if (change.originalContent !== null) {
        // File was modified - restore original content
        await webcontainer.fs.writeFile(relativePath, change.originalContent);
        logger.debug(`Restored original content: ${relativePath}`);
      }

      reverted.push(change.filePath);

      // Remove the change from staging now that it's reverted
      removeChange(change.filePath);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      failed.push({ path: change.filePath, error: errorMessage });
      logger.error(`Failed to revert change: ${change.filePath}`, error);

      // Don't remove failed changes - leave them for retry
    }
  }

  logger.info(`Reverted ${reverted.length} changes, ${failed.length} failed`);

  return { reverted, failed };
}

/**
 * Revert a single rejected change by restoring original content to WebContainer filesystem
 *
 * @param filePath - The file path of the rejected change to revert
 * @param webcontainer - The WebContainer instance to write files to
 * @returns Object indicating success or failure
 */
export async function applyRejectedChange(
  filePath: string,
  webcontainer: {
    fs: {
      writeFile: (path: string, content: string) => Promise<void>;
      rm: (path: string, options?: { recursive?: boolean }) => Promise<void>;
      mkdir: (path: string, options: { recursive: true }) => Promise<string>;
    };
  },
): Promise<{ success: boolean; error?: string }> {
  const change = getChangeForFile(filePath);

  if (!change) {
    return { success: false, error: 'Change not found' };
  }

  if (change.status !== 'rejected') {
    return { success: false, error: 'Change is not rejected' };
  }

  try {
    const relativePath = change.filePath.replace(/^\/home\/project\/?/, '');

    if (change.type === 'create') {
      /*
       * File was newly created and staged - it was never written to WebContainer
       * Just remove from staging, no filesystem operation needed
       */
      logger.debug(`Removing staged new file from tracking: ${relativePath}`);
    } else if (change.type === 'delete' && change.originalContent !== null) {
      // File was deleted - recreate it with original content
      const pathParts = relativePath.split('/');
      const dir = pathParts.slice(0, -1).join('/');

      if (dir) {
        try {
          await webcontainer.fs.mkdir(dir, { recursive: true });
        } catch {
          // Directory might already exist
        }
      }

      await webcontainer.fs.writeFile(relativePath, change.originalContent);
      logger.debug(`Restored deleted file: ${relativePath}`);
    } else if (change.originalContent !== null) {
      // File was modified - restore original content
      await webcontainer.fs.writeFile(relativePath, change.originalContent);
      logger.debug(`Restored original content: ${relativePath}`);
    }

    removeChange(filePath);

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to revert change: ${filePath}`, error);

    return { success: false, error: errorMessage };
  }
}

/**
 * Remove a change from staging (after it's been applied or discarded)
 */
export function removeChange(filePath: string): void {
  const state = stagingStore.get();
  const { [filePath]: removed, ...remaining } = state.changes;

  if (removed) {
    stagingStore.setKey('changes', remaining);

    // Clear selection if this was selected
    if (state.selectedChangePath === filePath) {
      stagingStore.setKey('selectedChangePath', null);
    }

    logger.debug(`Removed change: ${filePath}`);
  }
}

/*
 * ============================================================================
 * Selection & Modal Actions
 * ============================================================================
 */

/**
 * Select a change for preview
 */
export function selectChange(filePath: string | null): void {
  stagingStore.setKey('selectedChangePath', filePath);
}

/**
 * Open the diff preview modal for a specific file
 */
export function openDiffModal(filePath: string): void {
  stagingStore.set({
    ...stagingStore.get(),
    selectedChangePath: filePath,
    isDiffModalOpen: true,
  });
}

/**
 * Close the diff preview modal
 */
export function closeDiffModal(): void {
  stagingStore.setKey('isDiffModalOpen', false);
}

/**
 * Navigate to the next pending change
 */
export function selectNextChange(): string | null {
  const pending = pendingChanges.get();

  if (pending.length === 0) {
    return null;
  }

  const currentPath = stagingStore.get().selectedChangePath;

  if (!currentPath) {
    const firstPath = pending[0].filePath;
    selectChange(firstPath);

    return firstPath;
  }

  const currentIndex = pending.findIndex((c) => c.filePath === currentPath);
  const nextIndex = (currentIndex + 1) % pending.length;
  const nextPath = pending[nextIndex].filePath;

  selectChange(nextPath);

  return nextPath;
}

/**
 * Navigate to the previous pending change
 */
export function selectPreviousChange(): string | null {
  const pending = pendingChanges.get();

  if (pending.length === 0) {
    return null;
  }

  const currentPath = stagingStore.get().selectedChangePath;

  if (!currentPath) {
    const lastPath = pending[pending.length - 1].filePath;
    selectChange(lastPath);

    return lastPath;
  }

  const currentIndex = pending.findIndex((c) => c.filePath === currentPath);
  const prevIndex = currentIndex <= 0 ? pending.length - 1 : currentIndex - 1;
  const prevPath = pending[prevIndex].filePath;

  selectChange(prevPath);

  return prevPath;
}

/*
 * ============================================================================
 * Settings Actions
 * ============================================================================
 */

/**
 * Update staging settings
 */
export function updateSettings(updates: Partial<StagingSettings>): void {
  const currentSettings = stagingStore.get().settings;
  const newSettings = { ...currentSettings, ...updates };

  stagingStore.setKey('settings', newSettings);
  saveSettingsToStorage(newSettings);

  logger.info('Staging settings updated');
}

/**
 * Toggle staging enabled/disabled
 */
export function toggleStaging(): boolean {
  const isEnabled = !stagingStore.get().settings.isEnabled;
  updateSettings({ isEnabled });

  return isEnabled;
}

/**
 * Add an auto-approve pattern
 */
export function addAutoApprovePattern(pattern: string): void {
  const settings = stagingStore.get().settings;

  if (!settings.autoApprovePatterns.includes(pattern)) {
    updateSettings({
      autoApprovePatterns: [...settings.autoApprovePatterns, pattern],
    });
  }
}

/**
 * Remove an auto-approve pattern
 */
export function removeAutoApprovePattern(pattern: string): void {
  const settings = stagingStore.get().settings;
  updateSettings({
    autoApprovePatterns: settings.autoApprovePatterns.filter((p) => p !== pattern),
  });
}

/**
 * Reset settings to defaults
 */
export function resetSettings(): void {
  updateSettings(DEFAULT_SETTINGS);
}

/*
 * ============================================================================
 * Version Integration
 * ============================================================================
 */

import { versionsStore } from './versions';

/**
 * Create a version checkpoint before accepting changes
 * This allows users to restore to before the changes were applied
 */
export function createCheckpointBeforeAccept(): string | null {
  const pending = pendingChanges.get();

  if (pending.length === 0) {
    return null;
  }

  const settings = stagingStore.get().settings;

  if (!settings.autoCheckpointOnAccept) {
    return null;
  }

  // Build a simple summary of changes for the version description
  const summary = pending.map((c) => `${c.type}: ${c.filePath.split('/').pop()}`).join(', ');

  // Create version with original file contents
  const files: Record<string, { content: string; type: string }> = {};

  for (const change of pending) {
    if (change.originalContent !== null) {
      files[change.filePath] = {
        content: change.originalContent,
        type: 'file',
      };
    }
  }

  const version = versionsStore.createVersion(
    `checkpoint-${Date.now()}`,
    `Before accepting ${pending.length} changes`,
    summary,
    files,
  );

  logger.info(`Created checkpoint: ${version.id}`);

  return version.id;
}

/**
 * Accept all changes with optional checkpoint creation
 * Returns the checkpoint version ID if created, null otherwise
 */
export function acceptAllWithCheckpoint(): { accepted: StagedChange[]; checkpointId: string | null } {
  const checkpointId = createCheckpointBeforeAccept();
  const accepted = acceptAllChanges();

  return { accepted, checkpointId };
}

/*
 * ============================================================================
 * Export type for external use
 * ============================================================================
 */

export type { MapStore };
