import { memo, useCallback, useState } from 'react';
import { useStore } from '@nanostores/react';
import { AnimatePresence, motion } from 'framer-motion';
import * as Collapsible from '@radix-ui/react-collapsible';
import { classNames } from '~/utils/classNames';
import { Button } from '~/components/ui/Button';
import { IconButton } from '~/components/ui/IconButton';
import { webcontainer } from '~/lib/webcontainer';
import { toast } from 'react-toastify';
import { workbenchStore } from '~/lib/stores/workbench';
import {
    stagingStore,
    pendingCount,
    hasPendingChanges,
    stagingStats,
    changesByType,
    acceptChange,
    rejectChange,
    acceptAllChanges,
    rejectAllChanges,
    applyAcceptedChanges,
    openDiffModal,
    pendingCommandsList,
    pendingCommandsCount,
    hasPendingCommands,
    clearPendingCommands,
    type StagedChange,
    type ChangeType,
} from '~/lib/stores/staging';

/*
 * ============================================================================
 * Animation Variants
 * ============================================================================
 */

const panelVariants = {
    collapsed: {
        height: 0,
        opacity: 0,
        transition: {
            duration: 0.2,
            ease: 'easeInOut',
        },
    },
    expanded: {
        height: 'auto',
        opacity: 1,
        transition: {
            duration: 0.2,
            ease: 'easeInOut',
        },
    },
};

const itemVariants = {
    hidden: {
        opacity: 0,
        x: -10,
    },
    visible: {
        opacity: 1,
        x: 0,
        transition: {
            duration: 0.15,
        },
    },
    exit: {
        opacity: 0,
        x: 10,
        transition: {
            duration: 0.1,
        },
    },
};

/*
 * ============================================================================
 * Helper Functions
 * ============================================================================
 */

function getChangeTypeIcon(type: ChangeType): string {
    switch (type) {
        case 'create':
            return 'i-ph:plus-circle';
        case 'modify':
            return 'i-ph:pencil-simple';
        case 'delete':
            return 'i-ph:trash';
        default:
            return 'i-ph:file';
    }
}

function getChangeTypeColor(type: ChangeType): string {
    switch (type) {
        case 'create':
            return 'text-green-400';
        case 'modify':
            return 'text-yellow-400';
        case 'delete':
            return 'text-red-400';
        default:
            return 'text-bolt-elements-textSecondary';
    }
}

function getFileIcon(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() ?? '';

    const iconMap: Record<string, string> = {
        ts: 'i-vscode-icons:file-type-typescript',
        tsx: 'i-vscode-icons:file-type-reactts',
        js: 'i-vscode-icons:file-type-js',
        jsx: 'i-vscode-icons:file-type-reactjs',
        json: 'i-vscode-icons:file-type-json',
        md: 'i-vscode-icons:file-type-markdown',
        css: 'i-vscode-icons:file-type-css',
        scss: 'i-vscode-icons:file-type-scss',
        html: 'i-vscode-icons:file-type-html',
        py: 'i-vscode-icons:file-type-python',
    };

    return iconMap[ext] ?? 'i-ph:file';
}

function formatFilePath(filePath: string): { dir: string; name: string } {
    const parts = filePath.split('/');
    const name = parts.pop() ?? filePath;
    const dir = parts.join('/');

    return { dir, name };
}

/*
 * ============================================================================
 * Sub-Components
 * ============================================================================
 */

interface ChangeItemProps {
    change: StagedChange;
    onAccept: (filePath: string) => void;
    onReject: (filePath: string) => void;
    onPreview: (filePath: string) => void;
}

const ChangeItem = memo(({ change, onAccept, onReject, onPreview }: ChangeItemProps) => {
    const { dir, name } = formatFilePath(change.filePath);

    return (
        <motion.div
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex items-center gap-2 px-3 py-2 hover:bg-bolt-elements-background-depth-2 rounded-md group cursor-pointer"
            onClick={() => onPreview(change.filePath)}
        >
            {/* File icon */}
            <div className={classNames('w-4 h-4 flex-shrink-0', getFileIcon(change.filePath))} />

            {/* File info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-bolt-elements-textPrimary truncate">{name}</span>
                    <span className={classNames('w-4 h-4', getChangeTypeIcon(change.type), getChangeTypeColor(change.type))} />
                </div>
                {dir && <span className="text-xs text-bolt-elements-textTertiary truncate block">{dir}</span>}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <IconButton
                    icon="i-ph:eye"
                    size="sm"
                    onClick={(e) => {
                        e.stopPropagation();
                        onPreview(change.filePath);
                    }}
                    title="Preview diff"
                    className="text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary"
                />
                <IconButton
                    icon="i-ph:check"
                    size="sm"
                    onClick={(e) => {
                        e.stopPropagation();
                        onAccept(change.filePath);
                    }}
                    title="Accept change"
                    className="text-green-400 hover:text-green-300"
                />
                <IconButton
                    icon="i-ph:x"
                    size="sm"
                    onClick={(e) => {
                        e.stopPropagation();
                        onReject(change.filePath);
                    }}
                    title="Reject change"
                    className="text-red-400 hover:text-red-300"
                />
            </div>
        </motion.div>
    );
});

ChangeItem.displayName = 'ChangeItem';

interface ChangeGroupProps {
    title: string;
    icon: string;
    iconColor: string;
    changes: StagedChange[];
    onAccept: (filePath: string) => void;
    onReject: (filePath: string) => void;
    onPreview: (filePath: string) => void;
}

const ChangeGroup = memo(({ title, icon, iconColor, changes, onAccept, onReject, onPreview }: ChangeGroupProps) => {
    if (changes.length === 0) {
        return null;
    }

    return (
        <div className="mb-2">
            <div className="flex items-center gap-2 px-3 py-1">
                <span className={classNames('w-4 h-4', icon, iconColor)} />
                <span className="text-xs font-medium text-bolt-elements-textSecondary uppercase tracking-wide">{title}</span>
                <span className="text-xs text-bolt-elements-textTertiary">({changes.length})</span>
            </div>
            <AnimatePresence mode="sync">
                {changes.map((change) => (
                    <ChangeItem key={change.id} change={change} onAccept={onAccept} onReject={onReject} onPreview={onPreview} />
                ))}
            </AnimatePresence>
        </div>
    );
});

ChangeGroup.displayName = 'ChangeGroup';

/*
 * ============================================================================
 * Main Component
 * ============================================================================
 */

export const StagedChangesPanel = memo(() => {
    const hasPending = useStore(hasPendingChanges);
    const count = useStore(pendingCount);
    const stats = useStore(stagingStats);
    const byType = useStore(changesByType);
    const settings = useStore(stagingStore).settings;
    const pendingCmds = useStore(pendingCommandsList);
    const cmdCount = useStore(pendingCommandsCount);
    const hasCmds = useStore(hasPendingCommands);

    const [isOpen, setIsOpen] = useState(true);
    const [isApplying, setIsApplying] = useState(false);

    // Execute all pending commands in order
    const executePendingCommands = useCallback(async () => {
        const commands = pendingCmds;

        if (commands.length === 0) {
            return;
        }

        toast.info(`Executing ${commands.length} queued command(s)...`);

        const shell = workbenchStore.boltTerminal;

        await shell.ready();

        for (const cmd of commands) {
            try {
                console.log(`Executing ${cmd.type} command: ${cmd.command}`);

                if (cmd.type === 'start') {
                    /*
                     * Start commands (like 'npm run dev') are long-running processes
                     * Don't await them - just fire and forget
                     */
                    shell.executeCommand(`staged-${cmd.id}`, cmd.command).catch((error) => {
                        console.error(`Start command failed: ${cmd.command}`, error);
                    });
                } else {
                    // Shell commands (like 'npm install') should be awaited
                    await shell.executeCommand(`staged-${cmd.id}`, cmd.command);
                }
            } catch (error) {
                console.error(`Failed to execute command: ${cmd.command}`, error);
                toast.error(`Command failed: ${cmd.command.substring(0, 30)}...`);
            }
        }

        clearPendingCommands();
        toast.success(`Executed ${commands.length} command(s)`);
    }, [pendingCmds]);

    // Helper to apply accepted changes to WebContainer
    const applyChangesToWebContainer = useCallback(async () => {
        try {
            const wc = await webcontainer;
            const result = await applyAcceptedChanges(wc);

            if (result.failed.length > 0) {
                toast.error(`Failed to apply ${result.failed.length} file(s)`);
            } else if (result.applied.length > 0) {
                toast.success(`Applied ${result.applied.length} file(s)`);
            }
        } catch (error) {
            console.error('Error applying changes:', error);
            toast.error('Failed to apply changes to WebContainer');
        }
    }, []);

    // All hooks must be called unconditionally - moved before any returns
    const handleAccept = useCallback(
        async (filePath: string) => {
            setIsApplying(true);

            try {
                acceptChange(filePath);
                await applyChangesToWebContainer();
            } finally {
                setIsApplying(false);
            }
        },
        [applyChangesToWebContainer],
    );

    const handleReject = useCallback((filePath: string) => {
        rejectChange(filePath);
    }, []);

    const handlePreview = useCallback((filePath: string) => {
        openDiffModal(filePath);
    }, []);

    const handleAcceptAll = useCallback(async () => {
        setIsApplying(true);

        try {
            acceptAllChanges();
            await applyChangesToWebContainer();

            // Execute pending commands after files are applied
            await executePendingCommands();
        } finally {
            setIsApplying(false);
        }
    }, [applyChangesToWebContainer, executePendingCommands]);

    const handleRejectAll = useCallback(() => {
        rejectAllChanges();
        clearPendingCommands();
    }, []);

    // Don't render if staging is disabled or no pending changes/commands
    if (!settings.isEnabled || (!hasPending && !hasCmds)) {
        return null;
    }

    return (
        <Collapsible.Root open={isOpen} onOpenChange={setIsOpen}>
            <div className="border-b border-bolt-elements-borderColor bg-bolt-elements-background-depth-2">
                {/* Header */}
                <Collapsible.Trigger asChild>
                    <button className="w-full flex items-center justify-between px-4 py-3 bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3 transition-colors">
                        <div className="flex items-center gap-3">
                            <motion.span
                                className="i-ph:caret-right w-4 h-4 text-bolt-elements-textSecondary"
                                animate={{ rotate: isOpen ? 90 : 0 }}
                                transition={{ duration: 0.15 }}
                            />
                            <span className="i-ph:git-diff w-5 h-5 text-bolt-elements-textSecondary" />
                            <span className="text-sm font-medium text-bolt-elements-textPrimary">Pending Changes</span>
                            <span className="px-2 py-0.5 text-xs font-medium bg-yellow-500/20 text-yellow-400 rounded-full">
                                {count + cmdCount}
                            </span>
                        </div>

                        {/* Quick stats */}
                        <div className="flex items-center gap-3 text-xs text-bolt-elements-textTertiary">
                            {byType.create.length > 0 && (
                                <span className="flex items-center gap-1 text-green-400">
                                    <span className="i-ph:plus-circle w-3.5 h-3.5" />
                                    {byType.create.length}
                                </span>
                            )}
                            {byType.modify.length > 0 && (
                                <span className="flex items-center gap-1 text-yellow-400">
                                    <span className="i-ph:pencil-simple w-3.5 h-3.5" />
                                    {byType.modify.length}
                                </span>
                            )}
                            {byType.delete.length > 0 && (
                                <span className="flex items-center gap-1 text-red-400">
                                    <span className="i-ph:trash w-3.5 h-3.5" />
                                    {byType.delete.length}
                                </span>
                            )}
                            {cmdCount > 0 && (
                                <span className="flex items-center gap-1 text-blue-400">
                                    <span className="i-ph:terminal w-3.5 h-3.5" />
                                    {cmdCount}
                                </span>
                            )}
                        </div>
                    </button>
                </Collapsible.Trigger>

                {/* Content */}
                <Collapsible.Content forceMount>
                    <motion.div
                        variants={panelVariants}
                        initial="collapsed"
                        animate={isOpen ? 'expanded' : 'collapsed'}
                        exit="collapsed"
                        className="overflow-hidden"
                    >
                        {/* Change list */}
                        <div className="max-h-64 overflow-y-auto py-2">
                            <ChangeGroup
                                title="New Files"
                                icon="i-ph:plus-circle"
                                iconColor="text-green-400"
                                changes={byType.create}
                                onAccept={handleAccept}
                                onReject={handleReject}
                                onPreview={handlePreview}
                            />
                            <ChangeGroup
                                title="Modified"
                                icon="i-ph:pencil-simple"
                                iconColor="text-yellow-400"
                                changes={byType.modify}
                                onAccept={handleAccept}
                                onReject={handleReject}
                                onPreview={handlePreview}
                            />
                            <ChangeGroup
                                title="Deleted"
                                icon="i-ph:trash"
                                iconColor="text-red-400"
                                changes={byType.delete}
                                onAccept={handleAccept}
                                onReject={handleReject}
                                onPreview={handlePreview}
                            />

                            {/* Pending Commands Section */}
                            {hasCmds && (
                                <div className="mb-2 mt-2 border-t border-bolt-elements-borderColor pt-2">
                                    <div className="flex items-center gap-2 px-3 py-1">
                                        <span className="i-ph:terminal w-4 h-4 text-blue-400" />
                                        <span className="text-xs font-medium text-bolt-elements-textSecondary uppercase tracking-wide">
                                            Queued Commands
                                        </span>
                                        <span className="text-xs text-bolt-elements-textTertiary">({cmdCount})</span>
                                    </div>
                                    {pendingCmds.map((cmd) => (
                                        <div
                                            key={cmd.id}
                                            className="flex items-center gap-2 px-3 py-2 hover:bg-bolt-elements-background-depth-2 rounded-md"
                                        >
                                            <span
                                                className={classNames(
                                                    'w-4 h-4 flex-shrink-0',
                                                    cmd.type === 'shell' ? 'i-ph:terminal-window text-blue-400' : 'i-ph:play text-green-400',
                                                )}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <span className="text-sm font-mono text-bolt-elements-textPrimary truncate block">
                                                    {cmd.command.length > 50 ? `${cmd.command.substring(0, 50)}...` : cmd.command}
                                                </span>
                                                <span className="text-xs text-bolt-elements-textTertiary">{cmd.type} command</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer actions */}
                        <div className="flex items-center justify-between px-4 py-3 border-t border-bolt-elements-borderColor bg-bolt-elements-background-depth-2">
                            <span className="text-xs text-bolt-elements-textTertiary">
                                {stats.reviewed > 0 && `${stats.reviewed} reviewed • `}
                                {count} pending{cmdCount > 0 && ` • ${cmdCount} commands`}
                            </span>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="default"
                                    size="sm"
                                    onClick={handleRejectAll}
                                    disabled={isApplying}
                                    className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                                >
                                    <span className="i-ph:x-circle mr-1.5" />
                                    Reject All
                                </Button>
                                <Button
                                    variant="default"
                                    size="sm"
                                    onClick={handleAcceptAll}
                                    disabled={isApplying}
                                    className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                                >
                                    {isApplying ? (
                                        <span className="i-ph:spinner animate-spin mr-1.5" />
                                    ) : (
                                        <span className="i-ph:check-circle mr-1.5" />
                                    )}
                                    {isApplying ? 'Applying...' : 'Accept All'}
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                </Collapsible.Content>
            </div>
        </Collapsible.Root>
    );
});

StagedChangesPanel.displayName = 'StagedChangesPanel';
