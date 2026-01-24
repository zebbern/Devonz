import { useStore } from '@nanostores/react';
import { AnimatePresence, motion } from 'framer-motion';
import { computed } from 'nanostores';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { createHighlighter, type BundledLanguage, type BundledTheme, type HighlighterGeneric } from 'shiki';
import type { ActionState } from '~/lib/runtime/action-runner';
import { workbenchStore } from '~/lib/stores/workbench';
import { stagingStore, getChangeForFile } from '~/lib/stores/staging';
import { classNames } from '~/utils/classNames';
import { cubicEasingFn } from '~/utils/easings';
import { WORK_DIR } from '~/utils/constants';
import {
  calculateDiffStats,
  getFileTypeIcon,
  getFileTypeIconColor,
  getSyntaxLanguage,
  truncateFilePath,
} from './artifact-utils';

const highlighterOptions = {
  langs: ['shell', 'typescript', 'javascript', 'tsx', 'jsx', 'css', 'html', 'json', 'markdown', 'python'],
  themes: ['light-plus', 'dark-plus'],
};

const codeHighlighter: HighlighterGeneric<BundledLanguage, BundledTheme> =
  import.meta.hot?.data.codeHighlighter ?? (await createHighlighter(highlighterOptions));

if (import.meta.hot) {
  import.meta.hot.data.codeHighlighter = codeHighlighter;
}

interface ArtifactProps {
  messageId: string;
  artifactId: string;
}

export const Artifact = memo(({ artifactId }: ArtifactProps) => {
  const userToggledActions = useRef(false);
  const [showActions, setShowActions] = useState(false);
  const [allActionFinished, setAllActionFinished] = useState(false);

  const artifacts = useStore(workbenchStore.artifacts);
  const artifact = artifacts[artifactId];

  const actions = useStore(
    computed(artifact.runner.actions, (actions) => {
      // Filter out Supabase actions except for migrations
      return Object.values(actions).filter((action) => {
        // Exclude actions with type 'supabase' or actions that contain 'supabase' in their content
        return action.type !== 'supabase' && !(action.type === 'shell' && action.content?.includes('supabase'));
      });
    }),
  );

  const toggleActions = () => {
    userToggledActions.current = true;
    setShowActions(!showActions);
  };

  useEffect(() => {
    if (actions.length && !showActions && !userToggledActions.current) {
      setShowActions(true);
    }

    if (actions.length !== 0 && artifact.type === 'bundled') {
      const finished = !actions.find(
        (action) => action.status !== 'complete' && !(action.type === 'start' && action.status === 'running'),
      );

      if (allActionFinished !== finished) {
        setAllActionFinished(finished);
      }
    }
  }, [actions, artifact.type, allActionFinished]);

  // Determine the dynamic title based on state for bundled artifacts
  const dynamicTitle =
    artifact?.type === 'bundled'
      ? allActionFinished
        ? artifact.id === 'restored-project-setup'
          ? 'Project Restored' // Title when restore is complete
          : 'Project Created' // Title when initial creation is complete
        : artifact.id === 'restored-project-setup'
          ? 'Restoring Project...' // Title during restore
          : 'Creating Project...' // Title during initial creation
      : artifact?.title; // Fallback to original title for non-bundled or if artifact is missing

  return (
    <>
      <div
        className="artifact border border-white/10 flex flex-col overflow-hidden rounded-xl w-full transition-all duration-150"
        style={{ background: 'linear-gradient(180deg, #1a2332 0%, #131a24 100%)' }}
      >
        {/* Header - Glossy dark style */}
        <button
          className="flex items-center justify-between w-full px-4 py-3 hover:bg-white/5 transition-colors"
          onClick={toggleActions}
          style={{ background: 'rgba(255,255,255,0.02)' }}
        >
          <div className="flex items-center gap-2.5">
            <div className="i-ph:wrench-duotone text-blue-400 text-lg" />
            <span className="text-sm text-white/90">
              Used tools {actions.length > 0 && <span className="text-white/50">{actions.length} times</span>}
            </span>
          </div>
          <div
            className={classNames('transition-transform duration-200 text-white/40', showActions ? 'rotate-180' : '')}
          >
            <div className="i-ph:caret-down" />
          </div>
        </button>

        {/* Collapsible Actions List */}
        <AnimatePresence>
          {showActions && actions.length > 0 && (
            <motion.div
              className="actions"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: cubicEasingFn }}
            >
              {/* To-dos header with progress bar */}
              <div className="px-3 py-2 border-t border-bolt-elements-borderColor bg-bolt-elements-background-depth-2">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="i-ph:list-checks text-bolt-elements-textTertiary text-xs" />
                    <span className="text-xs text-bolt-elements-textSecondary">To-dos</span>
                  </div>
                  <span className="text-xs text-bolt-elements-textTertiary">
                    {actions.filter((a) => a.status === 'complete').length} of {actions.length} Done
                  </span>
                </div>
                {/* Progress Bar */}
                <div className="h-0.5 bg-bolt-elements-borderColor rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-green-500"
                    initial={{ width: 0 }}
                    animate={{
                      width: `${(actions.filter((a) => a.status === 'complete').length / actions.length) * 100}%`,
                    }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                  />
                </div>
              </div>

              {/* Action list */}
              <div className="px-3 py-2 bg-bolt-elements-background-depth-1">
                <ActionList actions={actions} />
              </div>

              {/* Workbench button */}
              <button
                className="flex items-center gap-2 w-full px-3 py-2 border-t border-bolt-elements-borderColor hover:bg-bolt-elements-background-depth-3 transition-colors group bg-bolt-elements-background-depth-2"
                onClick={() => {
                  const showWorkbench = workbenchStore.showWorkbench.get();
                  workbenchStore.showWorkbench.set(!showWorkbench);
                }}
              >
                <div className="i-ph:code-duotone text-bolt-elements-button-primary-background text-base" />
                <div className="flex-1 text-left">
                  <div className="text-xs text-bolt-elements-textPrimary">{dynamicTitle}</div>
                  <div className="text-xs text-bolt-elements-textTertiary">Click to open Workbench</div>
                </div>
                <div className="i-ph:pencil-simple text-bolt-elements-textTertiary group-hover:text-bolt-elements-textSecondary transition-colors text-xs" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bundled artifact status */}
        {artifact.type === 'bundled' && (
          <div className="flex items-center gap-2.5 px-4 py-3 border-t border-white/8">
            <div className={classNames('text-lg', getIconColor(allActionFinished ? 'complete' : 'running'))}>
              {allActionFinished ? (
                <div className="i-ph:check-circle-fill"></div>
              ) : (
                <div className="i-svg-spinners:90-ring-with-bg"></div>
              )}
            </div>
            <div className="text-white/90 text-sm">
              {allActionFinished
                ? artifact.id === 'restored-project-setup'
                  ? 'Restore files from snapshot'
                  : 'Initial files created'
                : 'Creating initial files'}
            </div>
          </div>
        )}
      </div>
    </>
  );
});

interface CodeBlockProps {
  className?: string;
  code: string;
  language?: string;
  maxLines?: number;
}

function CodeBlock({ className, code, language = 'shell', maxLines }: CodeBlockProps) {
  const displayCode = useMemo(() => {
    if (maxLines && code) {
      const lines = code.split('\n');
      if (lines.length > maxLines) {
        return lines.slice(0, maxLines).join('\n') + `\n... (${lines.length - maxLines} more lines)`;
      }
    }
    return code;
  }, [code, maxLines]);

  // Ensure language is supported, fallback to plaintext
  const lang = highlighterOptions.langs.includes(language as any) ? language : 'shell';

  return (
    <div
      className={classNames('text-xs overflow-x-auto', className)}
      dangerouslySetInnerHTML={{
        __html: codeHighlighter.codeToHtml(displayCode || '', {
          lang: lang as BundledLanguage,
          theme: 'dark-plus',
        }),
      }}
    />
  );
}

// Keep backward compatibility
function ShellCodeBlock({ classsName, code }: { classsName?: string; code: string }) {
  return <CodeBlock className={classsName} code={code} language="shell" />;
}

interface ActionListProps {
  actions: ActionState[];
}

const actionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function openArtifactInWorkbench(filePath: any) {
  if (workbenchStore.currentView.get() !== 'code') {
    workbenchStore.currentView.set('code');
  }

  workbenchStore.setSelectedFile(`${WORK_DIR}/${filePath}`);
}

const ActionList = memo(({ actions }: ActionListProps) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const stagingState = useStore(stagingStore);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
      <div className="space-y-1">
        {actions.map((action, index) => {
          const { status, type, content } = action;
          const isComplete = status === 'complete';
          const isRunning = status === 'running';
          const isFailed = status === 'failed' || status === 'aborted';
          const isExpanded = expandedIndex === index;

          // Determine action label and file info
          let actionLabel = '';
          let fileName = '';
          let fileIcon = '';
          let fileIconColor = '';
          let diffStats: { linesAdded: number; linesRemoved: number } | null = null;
          let fileContent: string | null = null;
          let syntaxLanguage = 'plaintext';
          let isModified = false;

          if (type === 'file') {
            const filePath = action.filePath || '';
            fileName = truncateFilePath(filePath);
            fileIcon = getFileTypeIcon(filePath);
            fileIconColor = getFileTypeIconColor(filePath);
            syntaxLanguage = getSyntaxLanguage(filePath);

            // Get diff stats from staging store or action content
            const stagedChange = getChangeForFile(filePath);
            if (stagedChange) {
              diffStats = calculateDiffStats(stagedChange.originalContent, stagedChange.newContent);
              fileContent = stagedChange.newContent;
              isModified = stagedChange.type === 'modify';
              actionLabel = stagedChange.type === 'create' ? 'Create' : 'Edit';
            } else if (action.content) {
              // File was directly written (staging disabled or auto-approved)
              diffStats = { linesAdded: action.content.split('\n').length, linesRemoved: 0 };
              fileContent = action.content;
              actionLabel = 'Create';
            } else {
              actionLabel = 'Create';
            }
          } else if (type === 'shell') {
            actionLabel = 'Run command';
          } else if (type === 'start') {
            actionLabel = 'Start Application';
          }

          const hasExpandableContent = (type === 'file' && fileContent) || ((type === 'shell' || type === 'start') && content);

          return (
            <motion.div
              key={index}
              variants={actionVariants}
              initial="hidden"
              animate="visible"
              transition={{ duration: 0.2, ease: cubicEasingFn }}
            >
              {/* Action Card - compact dark theme design */}
              <button
                onClick={() => {
                  if (hasExpandableContent) {
                    setExpandedIndex(isExpanded ? null : index);
                  } else if (type === 'file') {
                    openArtifactInWorkbench(action.filePath);
                  }
                }}
                className={classNames(
                  'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-all duration-150',
                  'bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3',
                  isExpanded && 'ring-1 ring-bolt-elements-borderColor',
                )}
              >
                {/* Status indicator - small checkmark */}
                <div
                  className={classNames(
                    'w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0',
                    isComplete
                      ? 'bg-green-500 text-white'
                      : isRunning
                        ? 'bg-blue-500'
                        : isFailed
                          ? 'bg-red-500 text-white'
                          : 'border border-bolt-elements-borderColor',
                  )}
                >
                  {isComplete ? (
                    <div className="i-ph:check-bold" style={{ fontSize: '10px' }} />
                  ) : isRunning ? (
                    <div className="i-svg-spinners:ring-resize text-white" style={{ fontSize: '10px' }} />
                  ) : isFailed ? (
                    <div className="i-ph:x-bold" style={{ fontSize: '10px' }} />
                  ) : null}
                </div>

                {/* File type icon (for file actions) */}
                {type === 'file' && fileIcon && (
                  <div className={classNames(fileIcon, fileIconColor, 'text-sm flex-shrink-0')} />
                )}

                {/* Action label */}
                <span className="text-xs text-bolt-elements-textSecondary flex-shrink-0">{actionLabel}</span>

                {/* File name */}
                {type === 'file' && fileName && (
                  <span className="text-xs font-medium text-bolt-elements-textPrimary truncate">
                    {fileName}
                  </span>
                )}

                {/* Edit icon for modified files */}
                {type === 'file' && isModified && (
                  <div className="i-ph:pencil-simple text-amber-400/80 text-xs flex-shrink-0" />
                )}

                {/* Diff stats badge - positioned on the right */}
                {type === 'file' && diffStats && (diffStats.linesAdded > 0 || diffStats.linesRemoved > 0) && (
                  <span className="flex items-center gap-1 text-xs ml-auto">
                    {diffStats.linesAdded > 0 && (
                      <span className="text-green-400">+{diffStats.linesAdded}</span>
                    )}
                    {diffStats.linesRemoved > 0 && (
                      <span className="text-red-400">-{diffStats.linesRemoved}</span>
                    )}
                  </span>
                )}

                {/* Expand arrow */}
                {hasExpandableContent && (
                  <div
                    className={classNames(
                      'transition-transform duration-200 text-bolt-elements-textTertiary',
                      !diffStats && 'ml-auto',
                      isExpanded ? 'rotate-180' : '',
                    )}
                  >
                    <div className="i-ph:caret-down" style={{ fontSize: '14px' }} />
                  </div>
                )}
              </button>

              {/* Expandable content */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-1.5 p-2 rounded-md bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor max-h-[200px] overflow-auto">
                      {type === 'file' && fileContent ? (
                        <CodeBlock
                          code={fileContent}
                          language={syntaxLanguage}
                          maxLines={25}
                          className="opacity-90"
                        />
                      ) : (
                        <ShellCodeBlock classsName="opacity-80" code={content || ''} />
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
});

function getIconColor(status: ActionState['status']) {
  switch (status) {
    case 'pending': {
      return 'text-bolt-elements-textTertiary';
    }
    case 'running': {
      return 'text-bolt-elements-loader-progress';
    }
    case 'complete': {
      return 'text-bolt-elements-icon-success';
    }
    case 'aborted': {
      return 'text-bolt-elements-textSecondary';
    }
    case 'failed': {
      return 'text-bolt-elements-icon-error';
    }
    default: {
      return undefined;
    }
  }
}
