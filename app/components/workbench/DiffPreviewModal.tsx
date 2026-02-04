import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from '@nanostores/react';
import { AnimatePresence, motion } from 'framer-motion';
import * as RadixDialog from '@radix-ui/react-dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { diffLines } from 'diff';
import { classNames } from '~/utils/classNames';
import { Button } from '~/components/ui/Button';
import { IconButton } from '~/components/ui/IconButton';
import { dialogBackdropVariants } from '~/components/ui/Dialog';
import { cubicEasingFn } from '~/utils/easings';
import {
  stagingStore,
  selectedChange,
  pendingChanges,
  acceptChange,
  rejectChange,
  closeDiffModal,
  selectNextChange,
  selectPreviousChange,
  type StagedChange,
} from '~/lib/stores/staging';

/*
 * ============================================================================
 * Types
 * ============================================================================
 */

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  lineNumberBefore?: number;
  lineNumberAfter?: number;
}

/*
 * ============================================================================
 * Animation Variants
 * ============================================================================
 */

const modalVariants = {
  closed: {
    opacity: 0,
    scale: 0.95,
    transition: {
      duration: 0.15,
      ease: cubicEasingFn,
    },
  },
  open: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.15,
      ease: cubicEasingFn,
    },
  },
};

/*
 * ============================================================================
 * Helper Functions
 * ============================================================================
 */

function computeDiffLines(original: string | null, modified: string): DiffLine[] {
  const originalContent = original ?? '';
  const lines: DiffLine[] = [];

  const changes = diffLines(originalContent, modified);

  let lineNumBefore = 1;
  let lineNumAfter = 1;

  for (const change of changes) {
    const changeLines = change.value.split('\n');

    // Remove trailing empty string from split
    if (changeLines[changeLines.length - 1] === '') {
      changeLines.pop();
    }

    for (const line of changeLines) {
      if (change.added) {
        lines.push({
          type: 'added',
          content: line,
          lineNumberAfter: lineNumAfter++,
        });
      } else if (change.removed) {
        lines.push({
          type: 'removed',
          content: line,
          lineNumberBefore: lineNumBefore++,
        });
      } else {
        lines.push({
          type: 'unchanged',
          content: line,
          lineNumberBefore: lineNumBefore++,
          lineNumberAfter: lineNumAfter++,
        });
      }
    }
  }

  return lines;
}

function getChangeTypeLabel(type: StagedChange['type']): string {
  switch (type) {
    case 'create':
      return 'New File';
    case 'modify':
      return 'Modified';
    case 'delete':
      return 'Deleted';
    default:
      return 'Unknown';
  }
}

function getChangeTypeColor(type: StagedChange['type']): string {
  switch (type) {
    case 'create':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'modify':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'delete':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
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
    go: 'i-vscode-icons:file-type-go',
    rs: 'i-vscode-icons:file-type-rust',
  };

  return iconMap[ext] ?? 'i-ph:file';
}

/*
 * ============================================================================
 * Sub-Components
 * ============================================================================
 */

interface DiffLineRowProps {
  line: DiffLine;
}

const DiffLineRow = memo(({ line }: DiffLineRowProps) => {
  const bgColor = useMemo(() => {
    switch (line.type) {
      case 'added':
        return 'bg-green-500/10';
      case 'removed':
        return 'bg-red-500/10';
      default:
        return '';
    }
  }, [line.type]);

  const lineColor = useMemo(() => {
    switch (line.type) {
      case 'added':
        return 'text-green-400';
      case 'removed':
        return 'text-red-400';
      default:
        return 'text-bolt-elements-textSecondary';
    }
  }, [line.type]);

  const prefix = useMemo(() => {
    switch (line.type) {
      case 'added':
        return '+';
      case 'removed':
        return '-';
      default:
        return ' ';
    }
  }, [line.type]);

  return (
    <div className={classNames('flex text-sm font-mono', bgColor)}>
      {/* Line numbers */}
      <div
        className="w-12 flex-shrink-0 text-right pr-2 select-none border-r border-[#333]"
        style={{ backgroundColor: '#131a24', color: '#6b7280' }}
      >
        {line.lineNumberBefore ?? ''}
      </div>
      <div
        className="w-12 flex-shrink-0 text-right pr-2 select-none border-r border-[#333]"
        style={{ backgroundColor: '#131a24', color: '#6b7280' }}
      >
        {line.lineNumberAfter ?? ''}
      </div>

      {/* Prefix */}
      <div className={classNames('w-6 flex-shrink-0 text-center select-none', lineColor)}>{prefix}</div>

      {/* Content */}
      <div className={classNames('flex-1 px-2 whitespace-pre', lineColor)}>{line.content || ' '}</div>
    </div>
  );
});

DiffLineRow.displayName = 'DiffLineRow';

interface DiffContentProps {
  change: StagedChange;
}

const DiffContent = memo(({ change }: DiffContentProps) => {
  const diffLines = useMemo(() => {
    return computeDiffLines(change.originalContent, change.newContent);
  }, [change.originalContent, change.newContent]);

  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;

    for (const line of diffLines) {
      if (line.type === 'added') {
        added++;
      }

      if (line.type === 'removed') {
        removed++;
      }
    }

    return { added, removed };
  }, [diffLines]);

  return (
    <div className="flex flex-col h-full">
      {/* Stats bar */}
      <div
        className="flex items-center gap-4 px-4 py-2"
        style={{ backgroundColor: '#131a24', borderBottom: '1px solid #333' }}
      >
        <span className="text-sm text-green-400">+{stats.added} additions</span>
        <span className="text-sm text-red-400">-{stats.removed} deletions</span>
        <span className="text-sm" style={{ color: '#6b7280' }}>
          {diffLines.filter((l) => l.type === 'unchanged').length} unchanged
        </span>
      </div>

      {/* Diff lines */}
      <div className="flex-1 overflow-auto diff-modal-content" style={{ backgroundColor: '#1a2332' }}>
        {diffLines.map((line, index) => (
          <DiffLineRow key={`${index}-${line.type}-${line.content.slice(0, 20)}`} line={line} />
        ))}
      </div>
    </div>
  );
});

DiffContent.displayName = 'DiffContent';

/*
 * ============================================================================
 * Main Component
 * ============================================================================
 */

export const DiffPreviewModal = memo(() => {
  const state = useStore(stagingStore);
  const change = useStore(selectedChange);
  const pending = useStore(pendingChanges);

  const [isProcessing, setIsProcessing] = useState(false);

  const isOpen = state.isDiffModalOpen && change !== null;

  // Calculate position in pending list
  const position = useMemo(() => {
    if (!change) {
      return { current: 0, total: 0 };
    }

    const pendingList = pending.filter((c) => c.status === 'pending');
    const currentIndex = pendingList.findIndex((c) => c.filePath === change.filePath);

    return {
      current: currentIndex + 1,
      total: pendingList.length,
    };
  }, [change, pending]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      // Escape to close
      if (event.key === 'Escape') {
        closeDiffModal();
      } else if (event.key === 'ArrowRight' || event.key === ']') {
        // Arrow keys for navigation
        event.preventDefault();
        selectNextChange();
      } else if (event.key === 'ArrowLeft' || event.key === '[') {
        event.preventDefault();
        selectPreviousChange();
      } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        // Ctrl+Enter to accept
        event.preventDefault();
        handleAccept();
      } else if (event.key === 'Backspace' && (event.ctrlKey || event.metaKey)) {
        // Ctrl+Backspace to reject
        event.preventDefault();
        handleReject();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleAccept = useCallback(async () => {
    if (!change || isProcessing) {
      return;
    }

    setIsProcessing(true);

    try {
      acceptChange(change.filePath);

      // Move to next if there are more
      if (position.total > 1) {
        selectNextChange();
      } else {
        closeDiffModal();
      }
    } finally {
      setIsProcessing(false);
    }
  }, [change, isProcessing, position.total]);

  const handleReject = useCallback(async () => {
    if (!change || isProcessing) {
      return;
    }

    setIsProcessing(true);

    try {
      rejectChange(change.filePath);

      // Move to next if there are more
      if (position.total > 1) {
        selectNextChange();
      } else {
        closeDiffModal();
      }
    } finally {
      setIsProcessing(false);
    }
  }, [change, isProcessing, position.total]);

  const handleSkip = useCallback(() => {
    selectNextChange();
  }, []);

  const handleClose = useCallback(() => {
    closeDiffModal();
  }, []);

  if (!change) {
    return null;
  }

  const fileName = change.filePath.split('/').pop() ?? change.filePath;

  return (
    <AnimatePresence>
      {isOpen && (
        <RadixDialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
          <RadixDialog.Portal>
            <RadixDialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-[9999] bg-black/70 dark:bg-black/80 backdrop-blur-sm"
                initial="closed"
                animate="open"
                exit="closed"
                variants={dialogBackdropVariants}
                onClick={handleClose}
              />
            </RadixDialog.Overlay>
            <RadixDialog.Content asChild>
              <motion.div
                className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
                initial="closed"
                animate="open"
                exit="closed"
                variants={modalVariants}
              >
                <div
                  className="w-[90vw] max-w-5xl h-[85vh] rounded-lg shadow-xl flex flex-col focus:outline-none"
                  style={{ backgroundColor: '#1a2332', borderColor: '#333', borderWidth: '1px', borderStyle: 'solid' }}
                >
                  {/* Accessibility: Hidden title and description for screen readers */}
                  <VisuallyHidden.Root asChild>
                    <RadixDialog.Title>
                      {change.type === 'create'
                        ? 'New File'
                        : change.type === 'modify'
                          ? 'Modified File'
                          : 'Deleted File'}
                      : {fileName}
                    </RadixDialog.Title>
                  </VisuallyHidden.Root>
                  <VisuallyHidden.Root asChild>
                    <RadixDialog.Description>
                      Review the diff for {change.filePath}. Use arrow keys to navigate between changes.
                    </RadixDialog.Description>
                  </VisuallyHidden.Root>

                  {/* Header */}
                  <div
                    className="flex items-center justify-between px-4 py-3 rounded-t-lg"
                    style={{ backgroundColor: '#131a24', borderBottom: '1px solid #333' }}
                  >
                    <div className="flex items-center gap-3">
                      {/* File icon and path */}
                      <div className={classNames('w-5 h-5', getFileIcon(change.filePath))} />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium" style={{ color: '#ffffff' }}>
                          {fileName}
                        </span>
                        <span className="text-xs" style={{ color: '#6b7280' }}>
                          {change.filePath}
                        </span>
                      </div>

                      {/* Change type badge */}
                      <span
                        className={classNames(
                          'px-2 py-0.5 text-xs font-medium rounded border',
                          getChangeTypeColor(change.type),
                        )}
                      >
                        {getChangeTypeLabel(change.type)}
                      </span>
                    </div>

                    {/* Navigation and close */}
                    <div className="flex items-center gap-2">
                      {position.total > 1 && (
                        <>
                          <span className="text-sm" style={{ color: '#6b7280' }}>
                            {position.current} of {position.total}
                          </span>
                          <IconButton
                            icon="i-ph:caret-left"
                            onClick={() => selectPreviousChange()}
                            title="Previous change ([)"
                          />
                          <IconButton
                            icon="i-ph:caret-right"
                            onClick={() => selectNextChange()}
                            title="Next change (])"
                          />
                          <div className="w-px h-6 mx-2" style={{ backgroundColor: '#333' }} />
                        </>
                      )}
                      <IconButton
                        icon="i-ph:x"
                        onClick={handleClose}
                        title="Close (Escape)"
                        style={{ color: '#6b7280' }}
                      />
                    </div>
                  </div>

                  {/* Diff content */}
                  <div className="flex-1 overflow-hidden">
                    <DiffContent change={change} />
                  </div>

                  {/* Footer with actions */}
                  <div
                    className="flex items-center justify-between px-4 py-3 rounded-b-lg"
                    style={{ backgroundColor: '#131a24', borderTop: '1px solid #333' }}
                  >
                    {/* Keyboard hints */}
                    <div className="flex items-center gap-4 text-xs" style={{ color: '#6b7280' }}>
                      <span>
                        <kbd className="px-1.5 py-0.5 rounded" style={{ backgroundColor: '#2a2a2a', color: '#9ca3af' }}>
                          ←
                        </kbd>{' '}
                        /{' '}
                        <kbd className="px-1.5 py-0.5 rounded" style={{ backgroundColor: '#2a2a2a', color: '#9ca3af' }}>
                          →
                        </kbd>{' '}
                        Navigate
                      </span>
                      <span>
                        <kbd className="px-1.5 py-0.5 rounded" style={{ backgroundColor: '#2a2a2a', color: '#9ca3af' }}>
                          Ctrl
                        </kbd>
                        +
                        <kbd className="px-1.5 py-0.5 rounded" style={{ backgroundColor: '#2a2a2a', color: '#9ca3af' }}>
                          Enter
                        </kbd>{' '}
                        Accept
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                      {position.total > 1 && (
                        <Button
                          variant="ghost"
                          onClick={handleSkip}
                          disabled={isProcessing}
                          style={{ backgroundColor: '#333', color: '#9ca3af' }}
                        >
                          Skip
                        </Button>
                      )}
                      <Button variant="destructive" onClick={handleReject} disabled={isProcessing}>
                        <span className="i-ph:x-circle mr-1.5" />
                        Reject
                      </Button>
                      <Button
                        variant="default"
                        onClick={handleAccept}
                        disabled={isProcessing}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <span className="i-ph:check-circle mr-1.5" />
                        Accept
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </RadixDialog.Content>
          </RadixDialog.Portal>
        </RadixDialog.Root>
      )}
    </AnimatePresence>
  );
});

DiffPreviewModal.displayName = 'DiffPreviewModal';
