import React, { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { clientLazy } from '~/utils/react';
import { classNames } from '~/utils/classNames';
import { PROVIDER_LIST } from '~/utils/constants';
import { CombinedModelSelector } from '~/components/chat/CombinedModelSelector';
import FilePreview from './FilePreview';
import { IconButton } from '~/components/ui/IconButton';
import { toast } from 'react-toastify';
import { SpeechRecognitionButton } from '~/components/chat/SpeechRecognition';
import { Dialog, DialogRoot, DialogTitle, DialogDescription } from '~/components/ui/Dialog';
import styles from './BaseChat.module.scss';
import type { ProviderInfo } from '~/types/model';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { DesignScheme } from '~/types/design-scheme';
import type { ElementInfo } from '~/components/workbench/inspector-types';
import { ChatModeSelector } from './ChatModeSelector';
import { AgentToggle } from './AgentToggle';
import { AnimatePresence, motion } from 'framer-motion';
import type { TabType } from '~/components/@settings/core/types';

const SupabaseConnection = lazy(() => import('./SupabaseConnection').then((m) => ({ default: m.SupabaseConnection })));
const ExpoQrModal = lazy(() => import('~/components/workbench/ExpoQrModal').then((m) => ({ default: m.ExpoQrModal })));
const ColorSchemeDialog = lazy(() =>
  import('~/components/ui/ColorSchemeDialog').then((m) => ({ default: m.ColorSchemeDialog })),
);
const McpTools = lazy(() => import('./MCPTools').then((m) => ({ default: m.McpTools })));
const WebSearch = clientLazy(() => import('./WebSearch.client').then((m) => ({ default: m.WebSearch })));
const SendButton = clientLazy(() => import('./SendButton.client').then((m) => ({ default: m.SendButton })));
const ControlPanel = lazy(() =>
  import('~/components/@settings/core/ControlPanel').then((m) => ({ default: m.ControlPanel })),
);

interface ChatBoxProps {
  isModelSettingsCollapsed: boolean;
  setIsModelSettingsCollapsed: (collapsed: boolean) => void;
  provider?: ProviderInfo;
  providerList: ProviderInfo[];
  modelList: ModelInfo[];
  apiKeys: Record<string, string>;
  isModelLoading: string | undefined;
  onApiKeysChange: (providerName: string, apiKey: string) => void;
  uploadedFiles: File[];
  imageDataList: string[];
  textareaRef: React.RefObject<HTMLTextAreaElement | null> | undefined;
  input: string;
  handlePaste: (e: React.ClipboardEvent) => void;
  TEXTAREA_MIN_HEIGHT: number;
  TEXTAREA_MAX_HEIGHT: number;
  isStreaming: boolean;
  handleSendMessage: (event: React.UIEvent, messageInput?: string) => void;
  isListening: boolean;
  startListening: () => void;
  stopListening: () => void;
  chatStarted: boolean;
  exportChat?: () => void;
  qrModalOpen: boolean;
  setQrModalOpen: (open: boolean) => void;
  handleFileUpload: () => void;
  setProvider?: ((provider: ProviderInfo) => void) | undefined;
  model?: string | undefined;
  setModel?: ((model: string) => void) | undefined;
  setUploadedFiles?: ((files: File[]) => void) | undefined;
  setImageDataList?: ((dataList: string[]) => void) | undefined;
  handleInputChange?: ((event: React.ChangeEvent<HTMLTextAreaElement>) => void) | undefined;
  handleStop?: (() => void) | undefined;
  enhancingPrompt?: boolean | undefined;
  enhancePrompt?: (() => void) | undefined;
  chatMode?: 'discuss' | 'build';
  setChatMode?: (mode: 'discuss' | 'build') => void;
  planMode?: boolean;
  setPlanMode?: (enabled: boolean) => void;
  designScheme?: DesignScheme;
  setDesignScheme?: (scheme: DesignScheme) => void;
  selectedElement?: ElementInfo | null;
  setSelectedElement?: ((element: ElementInfo | null) => void) | undefined;
  onWebSearchResult?: (result: string) => void;
}

export const ChatBox: React.FC<ChatBoxProps> = (props) => {
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<TabType | undefined>(undefined);
  const [showMoreTools, setShowMoreTools] = useState(false);

  const handleOpenSettings = useCallback((tab?: string) => {
    setIsModelSelectorOpen(false);
    setSettingsInitialTab(tab as TabType | undefined);
    setIsSettingsOpen(true);
  }, []);

  const [isEnvKeySet, setIsEnvKeySet] = useState(false);

  // Check if API key is set via environment variable
  const checkEnvApiKey = useCallback(async () => {
    if (!props.provider?.name) {
      return;
    }

    try {
      const response = await fetch(`/api/check-env-key?provider=${encodeURIComponent(props.provider.name)}`);
      const data = await response.json();
      setIsEnvKeySet((data as { isSet: boolean }).isSet);
    } catch (error) {
      setIsEnvKeySet(false);
    }
  }, [props.provider?.name]);

  useEffect(() => {
    checkEnvApiKey();
  }, [checkEnvApiKey]);

  // Chat toolbar item visibility determined by environment variables
  const showThemeSelector = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SHOW_CHAT_THEME_SELECTOR === 'true' : false;
  const showMcpTools = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SHOW_CHAT_MCP_TOOLS === 'true' : false;
  const showAttachments = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SHOW_CHAT_ATTACHMENTS === 'true' : false;
  const showEnhancement = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SHOW_CHAT_ENHANCEMENT === 'true' : false;
  const showSpeech = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SHOW_CHAT_SPEECH === 'true' : false;
  const showModelSelector = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SHOW_CHAT_MODEL_SELECTOR === 'true' : false;

  return (
    <div
      className={classNames('relative p-4 rounded-xl w-full max-w-chat mx-auto z-prompt', 'shadow-xl')}
      style={{
        background: 'var(--devonz-chat-bg)',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'var(--devonz-chat-border)',
        boxShadow: '0 20px 25px -5px var(--devonz-chat-shadow)',
        backdropFilter: 'blur(24px)',
      }}
    >
      {/* Model Selector Modal/Popout */}
      <DialogRoot open={isModelSelectorOpen} onOpenChange={setIsModelSelectorOpen}>
        <Dialog
          className="w-[90vw] max-w-[500px] p-0 overflow-hidden"
          showCloseButton={false}
          onBackdrop={() => setIsModelSelectorOpen(false)}
        >
          {/* Visually hidden title and description for accessibility */}
          <DialogTitle className="sr-only">Select AI Model and Provider</DialogTitle>
          <DialogDescription className="sr-only">
            Choose an AI provider and model for your chat session
          </DialogDescription>
          <CombinedModelSelector
            key={props.provider?.name + ':' + props.modelList.length}
            model={props.model}
            setModel={props.setModel}
            modelList={props.modelList}
            provider={props.provider}
            setProvider={props.setProvider}
            providerList={props.providerList || (PROVIDER_LIST as ProviderInfo[])}
            apiKeys={props.apiKeys}
            modelLoading={props.isModelLoading}
            isOpen={isModelSelectorOpen}
            onOpenChange={setIsModelSelectorOpen}
            hideTrigger={true}
            onOpenSettings={handleOpenSettings}
          />
        </Dialog>
      </DialogRoot>
      <svg className={classNames(styles.PromptEffectContainer)} aria-hidden="true">
        <defs>
          <linearGradient
            id="line-gradient"
            x1="20%"
            y1="0%"
            x2="-14%"
            y2="10%"
            gradientUnits="userSpaceOnUse"
            gradientTransform="rotate(-45)"
          >
            <stop offset="0%" stopColor="#3d5a7f" stopOpacity="0%"></stop>
            <stop offset="40%" stopColor="#3d5a7f" stopOpacity="40%"></stop>
            <stop offset="50%" stopColor="#4d6a8f" stopOpacity="40%"></stop>
            <stop offset="100%" stopColor="#3d5a7f" stopOpacity="0%"></stop>
          </linearGradient>
          <linearGradient id="shine-gradient">
            <stop offset="0%" stopColor="white" stopOpacity="0%"></stop>
            <stop offset="40%" stopColor="#ffffff" stopOpacity="40%"></stop>
            <stop offset="50%" stopColor="#ffffff" stopOpacity="40%"></stop>
            <stop offset="100%" stopColor="white" stopOpacity="0%"></stop>
          </linearGradient>
        </defs>
        <rect className={classNames(styles.PromptEffectLine)} pathLength="100" strokeLinecap="round"></rect>
        <rect className={classNames(styles.PromptShine)} x="48" y="24" width="70" height="1"></rect>
      </svg>

      <FilePreview
        files={props.uploadedFiles}
        imageDataList={props.imageDataList}
        onRemove={(index) => {
          props.setUploadedFiles?.(props.uploadedFiles.filter((_, i) => i !== index));
          props.setImageDataList?.(props.imageDataList.filter((_, i) => i !== index));
        }}
      />
      {props.selectedElement && (
        <div className="flex mx-1.5 gap-2 items-center justify-between rounded-lg rounded-b-none border border-b-none border-devonz-elements-borderColor text-devonz-elements-textPrimary flex py-1 px-2.5 font-medium text-xs">
          <div className="flex gap-2 items-center lowercase">
            <code className="bg-accent-500 rounded-4px px-1.5 py-1 mr-0.5 text-white">
              {props?.selectedElement?.tagName}
            </code>
            selected for inspection
          </div>
          <button
            className="bg-transparent text-accent-500 pointer-auto"
            onClick={() => props.setSelectedElement?.(null)}
          >
            Clear
          </button>
        </div>
      )}
      <div
        className={classNames('relative shadow-xs border border-devonz-elements-borderColor backdrop-blur rounded-lg')}
      >
        <textarea
          ref={props.textareaRef}
          aria-label="Chat message input"
          className={classNames(
            'w-full pl-4 pt-4 pr-16 outline-none resize-none text-devonz-elements-textPrimary placeholder-devonz-elements-textTertiary bg-transparent text-sm',
            'transition-all duration-200',
            'hover:border-devonz-elements-focus',
          )}
          onDragEnter={(e) => {
            e.preventDefault();
            e.currentTarget.style.border = '2px solid #1488fc';
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.style.border = '2px solid #1488fc';
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.currentTarget.style.border = '1px solid var(--devonz-elements-borderColor)';
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.style.border = '1px solid var(--devonz-elements-borderColor)';

            const droppedFiles = Array.from(e.dataTransfer.files);
            const imageFiles = droppedFiles.filter((file) => file.type.startsWith('image/'));

            if (imageFiles.length === 0) {
              return;
            }

            /*
             * Read all images in parallel and set state once to avoid
             * stale-closure overwrites when multiple files are dropped.
             */
            const readPromises = imageFiles.map(
              (file) =>
                new Promise<string>((resolve) => {
                  const reader = new FileReader();
                  reader.onload = (ev) => resolve((ev.target?.result as string) ?? '');
                  reader.onerror = () => resolve('');
                  reader.readAsDataURL(file);
                }),
            );

            Promise.all(readPromises).then((results) => {
              const validIndices = results.reduce<number[]>((acc, r, i) => {
                if (r) {
                  acc.push(i);
                }

                return acc;
              }, []);
              const validFiles = validIndices.map((i) => imageFiles[i]);
              const validResults = validIndices.map((i) => results[i]);
              props.setUploadedFiles?.([...props.uploadedFiles, ...validFiles]);
              props.setImageDataList?.([...props.imageDataList, ...validResults]);
            });
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              if (event.shiftKey) {
                return;
              }

              event.preventDefault();

              if (props.isStreaming) {
                props.handleStop?.();
                return;
              }

              // ignore if using input method engine
              if (event.nativeEvent.isComposing) {
                return;
              }

              props.handleSendMessage?.(event);
            }
          }}
          value={props.input}
          onChange={(event) => {
            props.handleInputChange?.(event);
          }}
          onPaste={props.handlePaste}
          style={{
            minHeight: props.TEXTAREA_MIN_HEIGHT,
            maxHeight: props.TEXTAREA_MAX_HEIGHT,
          }}
          placeholder={
            props.planMode
              ? 'Describe what to plan...'
              : props.chatMode === 'build'
                ? 'Ask Devonz to build...'
                : 'What would you like to discuss?'
          }
          translate="no"
        />
        <Suspense fallback={null}>
          <SendButton
            show={props.input.length > 0 || props.isStreaming || props.uploadedFiles.length > 0}
            isStreaming={props.isStreaming}
            disabled={!props.providerList || props.providerList.length === 0}
            onClick={(event) => {
              if (props.isStreaming) {
                props.handleStop?.();
                return;
              }

              if (props.input.length > 0 || props.uploadedFiles.length > 0) {
                props.handleSendMessage?.(event);
              }
            }}
          />
        </Suspense>
        <div className="flex flex-col text-sm p-4 pt-2 gap-1">
          {/* Primary toolbar row */}
          <div className="flex justify-between items-center">
            <div className="flex gap-1 items-center">
              <ChatModeSelector
                chatMode={props.chatMode}
                setChatMode={props.setChatMode}
                planMode={props.planMode}
                setPlanMode={props.setPlanMode}
              />
              <AgentToggle />

              {showEnhancement && (
                <IconButton
                  title="Enhance prompt"
                  disabled={props.input.length === 0 || props.enhancingPrompt}
                  className={classNames('transition-all', props.enhancingPrompt ? 'opacity-100' : '')}
                  onClick={() => {
                    props.enhancePrompt?.();
                    toast.success('Prompt enhanced!');
                  }}
                >
                  {props.enhancingPrompt ? (
                    <div className="i-svg-spinners:90-ring-with-bg text-devonz-elements-loader-progress text-xl animate-spin"></div>
                  ) : (
                    <div className="i-devonz:stars text-xl"></div>
                  )}
                </IconButton>
              )}

              {showSpeech && (
                <SpeechRecognitionButton
                  isListening={props.isListening}
                  onStart={props.startListening}
                  onStop={props.stopListening}
                  disabled={props.isStreaming}
                />
              )}

              {/* Model Selector Button */}
              {showModelSelector && (
                <div className="relative">
                  <IconButton
                    title="Select Model"
                    className={classNames('transition-all flex items-center gap-1', {
                      'bg-devonz-elements-item-backgroundAccent text-devonz-elements-item-contentAccent':
                        isModelSelectorOpen,
                      'bg-devonz-elements-item-backgroundDefault text-devonz-elements-item-contentDefault':
                        !isModelSelectorOpen,
                    })}
                    onClick={() => setIsModelSelectorOpen(!isModelSelectorOpen)}
                    disabled={!props.providerList || props.providerList.length === 0}
                  >
                    <div className="i-ph:robot text-lg" />
                  </IconButton>
                </div>
              )}

              {/* Divider */}
              <div className="w-px h-4 bg-devonz-elements-borderColor mx-0.5" />

              {/* More tools toggle */}
              <IconButton
                title={showMoreTools ? 'Hide tools' : 'More tools'}
                className={classNames(
                  'transition-all',
                  showMoreTools
                    ? 'bg-devonz-elements-item-backgroundAccent text-devonz-elements-item-contentAccent'
                    : 'bg-devonz-elements-item-backgroundDefault text-devonz-elements-item-contentDefault',
                )}
                onClick={() => setShowMoreTools((v) => !v)}
              >
                <div
                  className={classNames(
                    'text-lg transition-transform duration-200',
                    showMoreTools ? 'i-ph:x' : 'i-devonz:expand',
                  )}
                />
              </IconButton>
            </div>

            <Suspense>
              <SupabaseConnection />
              <ExpoQrModal open={props.qrModalOpen} onClose={() => props.setQrModalOpen(false)} />
            </Suspense>
          </div>

          {/* Secondary toolbar row — slides down below primary */}
          <AnimatePresence>
            {showMoreTools && (
              <motion.div
                className="flex gap-1 items-center overflow-hidden"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
              >
                <Suspense>
                  {showThemeSelector && (
                    <ColorSchemeDialog designScheme={props.designScheme} setDesignScheme={props.setDesignScheme} />
                  )}
                  {showMcpTools && <McpTools />}
                  {showAttachments && (
                    <IconButton title="Upload file" className="transition-all" onClick={() => props.handleFileUpload()}>
                      <div className="i-ph:paperclip text-xl"></div>
                    </IconButton>
                  )}
                  <WebSearch
                    onSearchResult={(result) => props.onWebSearchResult?.(result)}
                    disabled={props.isStreaming}
                  />
                </Suspense>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {isSettingsOpen && (
        <Suspense>
          <ControlPanel
            open={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            initialTab={settingsInitialTab}
          />
        </Suspense>
      )}
    </div>
  );
};
