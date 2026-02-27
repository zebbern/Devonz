import type { UIMessage } from 'ai';
import { useCallback, useState } from 'react';
import { EnhancedStreamingMessageParser } from '~/lib/runtime/enhanced-message-parser';
import { workbenchStore } from '~/lib/stores/workbenchStore';
import { versionsStore } from '~/lib/stores/versions';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('useMessageParser');

// Track which messages have already had versions created
const versionedMessages = new Set<string>();

// Debounce timer for version creation (wait for all artifacts in a message to complete)
let versionDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingVersionData: { messageId: string; title: string } | null = null;

const messageParser = new EnhancedStreamingMessageParser({
  callbacks: {
    onArtifactOpen: (data) => {
      logger.trace('onArtifactOpen', data);

      workbenchStore.showWorkbench.set(true);
      workbenchStore.addArtifact(data);
    },
    onArtifactClose: (data) => {
      logger.trace('onArtifactClose');

      workbenchStore.updateArtifact(data, { closed: true });

      // Only create one version per message (debounced)
      const artifact = data.artifactId ? workbenchStore.artifacts.get()[data.artifactId] : undefined;
      const messageId = data.messageId || artifact?.id || '';

      // Skip if we've already versioned this message
      if (versionedMessages.has(messageId)) {
        return;
      }

      // Store the pending version data
      pendingVersionData = {
        messageId,
        title: artifact?.title || 'Project Update',
      };

      // Clear any existing timer
      if (versionDebounceTimer) {
        clearTimeout(versionDebounceTimer);
      }

      /*
       * Wait 500ms after last artifact closes before creating version
       * This groups all artifacts from one message into a single version
       */
      versionDebounceTimer = setTimeout(() => {
        if (!pendingVersionData) {
          return;
        }

        const { messageId: versionMessageId, title } = pendingVersionData;

        // Mark this message as versioned
        versionedMessages.add(versionMessageId);

        const files = workbenchStore.files.get();
        const fileSnapshot: Record<string, { content: string; type: string }> = {};

        for (const [path, dirent] of Object.entries(files)) {
          if (dirent?.type === 'file' && !dirent.isBinary) {
            fileSnapshot[path] = {
              content: dirent.content || '',
              type: 'file',
            };
          }
        }

        // Capture thumbnail asynchronously and create version
        versionsStore.capturePreviewThumbnail().then((thumbnail) => {
          versionsStore.createVersion(versionMessageId, title, `Completed: ${title}`, fileSnapshot, thumbnail);

          logger.trace('Version created for message:', versionMessageId);
        });

        pendingVersionData = null;
      }, 500);
    },
    onActionOpen: (data) => {
      logger.trace('onActionOpen', data.action);

      /*
       * Skip file actions during session restore ONLY if:
       * 1. We're currently restoring a session (isRestoringSession is true)
       * 2. AND this message is from the initial restore (is a reloaded message)
       * This prevents skipping actions for NEW messages sent after restore.
       */
      const isRestoring = workbenchStore.isRestoringSession.get();
      const isReloadedMsg = workbenchStore.isReloadedMessage(data.messageId);

      if (data.action.type === 'file' && isRestoring && isReloadedMsg) {
        logger.debug('Skipping file action during restore for reloaded message:', data.messageId);

        return;
      }

      /*
       * File actions are streamed, so we add them immediately to show progress
       * Shell actions are complete when created by enhanced parser, so we wait for close
       */
      if (data.action.type === 'file') {
        workbenchStore.addAction(data);
      }
    },
    onActionClose: (data) => {
      logger.trace('onActionClose', data.action);

      /*
       * Skip file actions during session restore ONLY if:
       * 1. We're currently restoring a session (isRestoringSession is true)
       * 2. AND this message is from the initial restore (is a reloaded message)
       * This prevents skipping actions for NEW messages sent after restore.
       */
      const isRestoring = workbenchStore.isRestoringSession.get();
      const isReloadedMsg = workbenchStore.isReloadedMessage(data.messageId);

      if (data.action.type === 'file' && isRestoring && isReloadedMsg) {
        logger.debug('Skipping file action close during restore for reloaded message:', data.messageId);

        return;
      }

      /*
       * Add non-file actions (shell, build, start, etc.) when they close
       * Enhanced parser creates complete shell actions, so they're ready to execute
       */
      if (data.action.type !== 'file') {
        workbenchStore.addAction(data);
      }

      workbenchStore.runAction(data);
    },
    onActionStream: (data) => {
      logger.trace('onActionStream', data.action);

      /*
       * Skip file streaming during session restore ONLY if:
       * 1. We're currently restoring a session (isRestoringSession is true)
       * 2. AND this message is from the initial restore (is a reloaded message)
       */
      const isRestoring = workbenchStore.isRestoringSession.get();
      const isReloadedMsg = workbenchStore.isReloadedMessage(data.messageId);

      if (data.action.type === 'file' && isRestoring && isReloadedMsg) {
        return;
      }

      workbenchStore.runAction(data, true);
    },
  },
});
const extractTextContent = (message: Message) =>
  Array.isArray(message.content)
    ? (message.content.find((item) => item.type === 'text')?.text as string) || ''
    : message.content;

export function useMessageParser() {
  const [parsedMessages, setParsedMessages] = useState<{ [key: number]: string }>({});

  const parseMessages = useCallback((messages: Message[], isLoading: boolean) => {
    let reset = false;

    if (import.meta.env.DEV && !isLoading) {
      reset = true;
      messageParser.reset();
    }

    for (const [index, message] of messages.entries()) {
      if (message.role === 'assistant' || message.role === 'user') {
        const newParsedContent = messageParser.parse(message.id, extractTextContent(message));

        /*
         * Check if the enhanced parser internally reset (e.g., when wrapping code blocks in artifact tags).
         * When this happens, we need to REPLACE the previous content, not append to it,
         * to avoid duplicate content during streaming.
         */
        const parserDidReset = messageParser.didResetOccur();
        const shouldReplace = reset || parserDidReset;

        // DEBUG: Log reset detection
        if (parserDidReset) {
          logger.debug('Parser reset detected for message', message.id, 'shouldReplace:', shouldReplace);
          logger.debug('New content length:', newParsedContent.length);
        }

        setParsedMessages((prevParsed) => ({
          ...prevParsed,
          [index]: !shouldReplace ? (prevParsed[index] || '') + newParsedContent : newParsedContent,
        }));
      }
    }
  }, []);

  return { parsedMessages, parseMessages };
}
