import * as React from 'react';
import { memo, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Markdown } from './Markdown';
import type { JSONValue } from 'ai';
import Popover from '~/components/ui/Popover';
import { workbenchStore } from '~/lib/stores/workbenchStore';
import { WORK_DIR } from '~/utils/constants';
import WithTooltip from '~/components/ui/Tooltip';
import type { UIMessage as Message } from 'ai';
import type { ProviderInfo } from '~/types/model';
import type {
  TextUIPart,
  ReasoningUIPart,
  ToolInvocationUIPart,
  SourceUIPart,
  FileUIPart,
  StepStartUIPart,
} from '@ai-sdk/ui-utils';
import { ToolInvocations } from './ToolInvocations';
import type { ToolCallAnnotation } from '~/types/context';

interface AssistantMessageProps {
  content: string;
  annotations?: JSONValue[];
  messageId?: string;
  onRewind?: (messageId: string) => void;
  onFork?: (messageId: string) => void;
  append?: (message: Message) => void;
  chatMode?: 'discuss' | 'build';
  setChatMode?: (mode: 'discuss' | 'build') => void;
  model?: string;
  provider?: ProviderInfo;
  parts:
    | (TextUIPart | ReasoningUIPart | ToolInvocationUIPart | SourceUIPart | FileUIPart | StepStartUIPart)[]
    | undefined;
  addToolResult: ({ toolCallId, result }: { toolCallId: string; result: any }) => void;
}

function openArtifactInWorkbench(filePath: string) {
  filePath = normalizedFilePath(filePath);

  if (workbenchStore.currentView.get() !== 'code') {
    workbenchStore.currentView.set('code');
  }

  workbenchStore.setSelectedFile(`${WORK_DIR}/${filePath}`);
}

function normalizedFilePath(path: string) {
  let normalizedPath = path;

  if (normalizedPath.startsWith(WORK_DIR)) {
    normalizedPath = path.replace(WORK_DIR, '');
  }

  if (normalizedPath.startsWith('/')) {
    normalizedPath = normalizedPath.slice(1);
  }

  return normalizedPath;
}

export const AssistantMessage = memo(
  ({
    content,
    annotations,
    messageId,
    onRewind,
    onFork,
    append,
    chatMode,
    setChatMode,
    model,
    provider,
    parts,
    addToolResult,
  }: AssistantMessageProps) => {
    const { t } = useTranslation();

    const filteredAnnotations = (annotations?.filter(
      (annotation: JSONValue) =>
        annotation && typeof annotation === 'object' && Object.keys(annotation).includes('type'),
    ) || []) as { type: string; value: any } & { [key: string]: any }[];

    let chatSummary: string | undefined = undefined;

    if (filteredAnnotations.find((annotation) => annotation.type === 'chatSummary')) {
      chatSummary = filteredAnnotations.find((annotation) => annotation.type === 'chatSummary')?.summary;
    }

    let codeContext: string[] | undefined = undefined;

    if (filteredAnnotations.find((annotation) => annotation.type === 'codeContext')) {
      codeContext = filteredAnnotations.find((annotation) => annotation.type === 'codeContext')?.files;
    }

    const usage: {
      completionTokens: number;
      promptTokens: number;
      totalTokens: number;
    } = filteredAnnotations.find((annotation) => annotation.type === 'usage')?.value;

    const toolInvocations = parts?.filter((part) => part.type === 'tool-invocation');
    const toolCallAnnotations = filteredAnnotations.filter(
      (annotation) => annotation.type === 'toolCall',
    ) as ToolCallAnnotation[];

    return (
      <div className="overflow-hidden w-full">
        {/* Assistant Header - Blink style */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full bg-bolt-elements-bg-depth-3 border border-bolt-elements-borderColor flex items-center justify-center">
            <span className="text-xs font-bold text-bolt-elements-textPrimary">
              {t('common.devonz', 'Devonz').charAt(0)}
            </span>
          </div>
          <span className="text-sm font-medium text-bolt-elements-textSecondary">{t('common.devonz', 'Devonz')}</span>
          {(codeContext || chatSummary) && (
            <Popover
              side="right"
              align="start"
              trigger={
                <div className="i-ph:info text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary transition-colors cursor-pointer" />
              }
            >
              {chatSummary && (
                <div className="max-w-chat">
                  <div className="summary max-h-96 flex flex-col">
                    <h2 className="border border-bolt-elements-borderColor rounded-md p4">
                      {t('chat.summary', 'Summary')}
                    </h2>
                    <div className="overflow-y-auto m4 [zoom:0.7]">
                      <Markdown>{chatSummary}</Markdown>
                    </div>
                  </div>
                  {codeContext && (
                    <div className="code-context flex flex-col p4 border border-bolt-elements-borderColor rounded-md">
                      <h2>{t('chat.context', 'Context')}</h2>
                      <div className="flex gap-4 mt-4 bolt [zoom:0.6]">
                        {codeContext.map((x) => {
                          const normalized = normalizedFilePath(x);
                          return (
                            <Fragment key={normalized}>
                              <code
                                className="bg-bolt-elements-artifacts-inlineCode-background text-bolt-elements-artifacts-inlineCode-text px-1.5 py-1 rounded-md text-bolt-elements-item-contentAccent hover:underline cursor-pointer"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  openArtifactInWorkbench(normalized);
                                }}
                              >
                                {normalized}
                              </code>
                            </Fragment>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="context"></div>
            </Popover>
          )}
          <div className="flex-1" />
          {usage && (
            <div className="text-xs text-bolt-elements-textTertiary">
              {usage.totalTokens.toLocaleString()} {t('chat.tokens', 'tokens')}
            </div>
          )}
          {(onRewind || onFork) && messageId && (
            <div className="flex gap-1.5">
              {onRewind && (
                <WithTooltip tooltip={t('chat.revert', 'Revert to this message')}>
                  <button
                    type="button"
                    onClick={() => onRewind(messageId)}
                    key="i-ph:arrow-u-up-left"
                    title={t('chat.revert', 'Revert to this message')}
                    aria-label={t('chat.revert', 'Revert to this message')}
                    className="i-ph:arrow-u-up-left text-lg text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary transition-colors cursor-pointer p-0.5"
                  />
                </WithTooltip>
              )}
              {onFork && (
                <WithTooltip tooltip={t('chat.fork', 'Fork chat from this message')}>
                  <button
                    onClick={() => onFork(messageId)}
                    key="i-ph:git-fork"
                    title={t('chat.fork', 'Fork chat from this message')}
                    aria-label={t('chat.fork', 'Fork chat from this message')}
                    className="i-ph:git-fork text-lg text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary transition-colors"
                  />
                </WithTooltip>
              )}
            </div>
          )}
        </div>

        {/* Message Content */}
        <div className="text-bolt-elements-textPrimary text-sm leading-relaxed pl-8">
          <Markdown
            append={append}
            chatMode={chatMode}
            setChatMode={setChatMode}
            model={model}
            provider={provider}
            html
          >
            {content}
          </Markdown>
        </div>

        {toolInvocations && toolInvocations.length > 0 && (
          <div className="pl-8 mt-3">
            <ToolInvocations
              toolInvocations={toolInvocations}
              toolCallAnnotations={toolCallAnnotations}
              addToolResult={addToolResult}
            />
          </div>
        )}
      </div>
    );
  },
);
