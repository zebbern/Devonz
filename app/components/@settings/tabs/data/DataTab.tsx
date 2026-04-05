import { useState, useRef, useCallback, useEffect, lazy, Suspense } from 'react';
import { Button } from '~/components/ui/Button';
import { ConfirmationDialog, SelectionDialog } from '~/components/ui/Dialog';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '~/components/ui/Card';
import { motion } from 'framer-motion';
import { useDataOperations } from '~/lib/hooks/useDataOperations';
import { openDatabase } from '~/lib/persistence/db';
import { getAllChats, type Chat } from '~/lib/persistence/chats';
import { classNames } from '~/utils/classNames';
import { toast } from 'react-toastify';
import { createScopedLogger } from '~/utils/logger';

const DataVisualization = lazy(() => import('./DataVisualization').then((mod) => ({ default: mod.DataVisualization })));

const logger = createScopedLogger('DataTab');

// Create a custom hook to connect to the devonzHistory database
function useDevonzHistoryDB() {
  const [db, setDb] = useState<IDBDatabase | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const initDB = async () => {
      try {
        setIsLoading(true);

        const database = await openDatabase();
        setDb(database || null);
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error initializing database'));
        setIsLoading(false);
      }
    };

    initDB();

    return () => {
      if (db) {
        db.close();
      }
    };
  }, []);

  return { db, isLoading, error };
}

// Extend the Chat interface to include the missing properties
interface ExtendedChat extends Chat {
  title?: string;
  updatedAt?: number;
}

// Helper function to create a chat label and description
function createChatItem(chat: Chat): ChatItem {
  return {
    id: chat.id,

    // Use description as title if available, or format a short ID
    label: (chat as ExtendedChat).title || chat.description || `Chat ${chat.id.slice(0, 8)}`,

    // Format the description with message count and timestamp
    description: `${chat.messages.length} messages - Last updated: ${new Date((chat as ExtendedChat).updatedAt || Date.parse(chat.timestamp)).toLocaleString()}`,
  };
}

interface SettingsCategory {
  id: string;
  label: string;
  description: string;
}

interface ChatItem {
  id: string;
  label: string;
  description: string;
}

export function DataTab() {
  // Use our custom hook for the devonzHistory database
  const { db, isLoading: dbLoading } = useDevonzHistoryDB();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const apiKeyFileInputRef = useRef<HTMLInputElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);

  // State for confirmation dialogs
  const [showResetInlineConfirm, setShowResetInlineConfirm] = useState(false);
  const [showDeleteInlineConfirm, setShowDeleteInlineConfirm] = useState(false);
  const [showSettingsSelection, setShowSettingsSelection] = useState(false);
  const [showChatsSelection, setShowChatsSelection] = useState(false);

  // State for settings categories and available chats
  const [settingsCategories] = useState<SettingsCategory[]>([
    { id: 'core', label: 'Core Settings', description: 'User profile and main settings' },
    { id: 'providers', label: 'Providers', description: 'API keys and provider configurations' },
    { id: 'features', label: 'Features', description: 'Feature flags and settings' },
    { id: 'ui', label: 'UI', description: 'UI configuration and preferences' },
    { id: 'connections', label: 'Connections', description: 'External service connections' },
    { id: 'debug', label: 'Debug', description: 'Debug settings and logs' },
    { id: 'updates', label: 'Updates', description: 'Update settings and notifications' },
  ]);

  const [availableChats, setAvailableChats] = useState<ExtendedChat[]>([]);
  const [chatItems, setChatItems] = useState<ChatItem[]>([]);

  // Data operations hook with devonzHistory database
  const {
    isExporting,
    isImporting,
    isResetting,
    isDownloadingTemplate,
    handleExportSettings,
    handleExportSelectedSettings,
    handleExportAllChats,
    handleExportSelectedChats,
    handleImportSettings,
    handleImportChats,
    handleResetSettings,
    handleResetChats,
    handleDownloadTemplate,
    handleImportAPIKeys,
  } = useDataOperations({
    customDb: db || undefined, // Pass the devonzHistory database, converting null to undefined
    onReloadSettings: () => window.location.reload(),
    onReloadChats: () => {
      // Reload chats after reset
      if (db) {
        getAllChats(db)
          .then((chats) => {
            // Cast to ExtendedChat to handle additional properties
            const extendedChats = chats as ExtendedChat[];
            setAvailableChats(extendedChats);
            setChatItems(extendedChats.map((chat) => createChatItem(chat)));
          })
          .catch((error) => {
            logger.error('Error reloading chats:', error);
          });
      }
    },
    onResetSettings: () => setShowResetInlineConfirm(false),
    onResetChats: () => setShowDeleteInlineConfirm(false),
  });

  // Loading states for operations not provided by the hook
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImportingKeys, setIsImportingKeys] = useState(false);

  // Internal tab state for organizing content
  type DataTabSection = 'chats' | 'settings' | 'api-keys' | 'data-usage';
  const [activeSection, setActiveSection] = useState<DataTabSection>('data-usage');

  const tabSections: { id: DataTabSection; label: string }[] = [
    // { id: 'chats', label: 'Chats' },
    // { id: 'settings', label: 'Settings' },
    // { id: 'api-keys', label: 'API Keys' },
    { id: 'data-usage', label: 'Data Usage' },
  ];

  // Load available chats
  useEffect(() => {
    if (db) {
      logger.debug('Loading chats from devonzHistory database', {
        name: db.name,
        version: db.version,
        objectStoreNames: Array.from(db.objectStoreNames),
      });

      getAllChats(db)
        .then((chats) => {
          logger.debug('Found chats:', chats.length);

          // Cast to ExtendedChat to handle additional properties
          const extendedChats = chats as ExtendedChat[];
          setAvailableChats(extendedChats);

          // Create ChatItems for selection dialog
          setChatItems(extendedChats.map((chat) => createChatItem(chat)));
        })
        .catch((error) => {
          logger.error('Error loading chats:', error);
          toast.error('Failed to load chats: ' + (error instanceof Error ? error.message : 'Unknown error'));
        });
    }
  }, [db]);

  // Handle file input changes
  const handleFileInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      if (file) {
        handleImportSettings(file);
      }
    },
    [handleImportSettings],
  );

  const handleAPIKeyFileInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      if (file) {
        setIsImportingKeys(true);
        handleImportAPIKeys(file).finally(() => setIsImportingKeys(false));
      }
    },
    [handleImportAPIKeys],
  );

  const handleChatFileInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      if (file) {
        handleImportChats(file);
      }
    },
    [handleImportChats],
  );

  // Wrapper for reset chats to handle loading state
  const handleResetChatsWithState = useCallback(() => {
    setIsDeleting(true);
    handleResetChats().finally(() => setIsDeleting(false));
  }, [handleResetChats]);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Hidden file inputs - wrapped to avoid affecting spacing */}
      <div className="hidden">
        <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileInputChange} />
        <input ref={apiKeyFileInputRef} type="file" accept=".json" onChange={handleAPIKeyFileInputChange} />
        <input ref={chatFileInputRef} type="file" accept=".json" onChange={handleChatFileInputChange} />
      </div>

      {/* Tab Navigation */}
      {tabSections.length > 1 && (
        <div className="flex gap-2 border-b border-devonz-elements-borderColor pb-2 mb-6">
          {tabSections.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className="px-4 py-2 text-sm font-medium rounded-t-lg transition-colors"
              style={{
                backgroundColor: activeSection === tab.id ? 'var(--devonz-elements-bg-depth-3)' : 'transparent',
                color:
                  activeSection === tab.id ? 'var(--devonz-elements-textPrimary)' : 'var(--devonz-elements-textTertiary)',
                borderBottom: activeSection === tab.id ? '2px solid #06B6D4' : '2px solid transparent',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Reset Settings Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showResetInlineConfirm}
        onClose={() => setShowResetInlineConfirm(false)}
        title="Reset All Settings?"
        description="This will reset all your settings to their default values. This action cannot be undone."
        confirmLabel="Reset Settings"
        cancelLabel="Cancel"
        variant="destructive"
        isLoading={isResetting}
        onConfirm={handleResetSettings}
      />

      {/* Delete Chats Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showDeleteInlineConfirm}
        onClose={() => setShowDeleteInlineConfirm(false)}
        title="Delete All Chats?"
        description="This will permanently delete all your chat history. This action cannot be undone."
        confirmLabel="Delete All"
        cancelLabel="Cancel"
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={handleResetChatsWithState}
      />

      {/* Settings Selection Dialog */}
      <SelectionDialog
        isOpen={showSettingsSelection}
        onClose={() => setShowSettingsSelection(false)}
        title="Select Settings to Export"
        items={settingsCategories}
        onConfirm={(selectedIds) => {
          handleExportSelectedSettings(selectedIds);
          setShowSettingsSelection(false);
        }}
        confirmLabel="Export Selected"
      />

      {/* Chats Selection Dialog */}
      <SelectionDialog
        isOpen={showChatsSelection}
        onClose={() => setShowChatsSelection(false)}
        title="Select Chats to Export"
        items={chatItems}
        onConfirm={(selectedIds) => {
          handleExportSelectedChats(selectedIds);
          setShowChatsSelection(false);
        }}
        confirmLabel="Export Selected"
      />

      {/* Chats Section */}
      {activeSection === 'chats' && (
        <div>
          <h2 className="text-xl font-semibold mb-4 text-white">Chats</h2>
          {dbLoading ? (
            <div className="flex items-center justify-center p-4">
              <div className="i-ph-spinner-gap-bold animate-spin w-6 h-6 mr-2" />
              <span>Loading chats database...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center mb-2">
                    <motion.div className="text-accent-500 mr-2" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                      <div className="i-ph-download-duotone w-5 h-5" />
                    </motion.div>
                    <CardTitle className="text-lg group-hover:text-devonz-elements-item-contentAccent transition-colors">
                      Export All Chats
                    </CardTitle>
                  </div>
                  <CardDescription>Export all your chats to a JSON file.</CardDescription>
                </CardHeader>
                <CardFooter>
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="w-full">
                    <Button
                      onClick={async () => {
                        try {
                          if (!db) {
                            toast.error('Database not available');
                            return;
                          }

                          logger.debug('Database information:', {
                            name: db.name,
                            version: db.version,
                            objectStoreNames: Array.from(db.objectStoreNames),
                          });

                          if (availableChats.length === 0) {
                            toast.warning('No chats available to export');
                            return;
                          }

                          await handleExportAllChats();
                        } catch (error) {
                          logger.error('Error exporting chats:', error);
                          toast.error(
                            `Failed to export chats: ${error instanceof Error ? error.message : 'Unknown error'}`,
                          );
                        }
                      }}
                      disabled={isExporting || availableChats.length === 0}
                      variant="outline"
                      size="sm"
                      className={classNames(
                        'hover:text-devonz-elements-item-contentAccent hover:border-devonz-elements-item-backgroundAccent hover:bg-devonz-elements-item-backgroundAccent transition-colors w-full justify-center',
                        isExporting || availableChats.length === 0 ? 'cursor-not-allowed' : '',
                      )}
                    >
                      {isExporting ? (
                        <>
                          <div className="i-ph-spinner-gap-bold animate-spin w-4 h-4 mr-2" />
                          Exporting...
                        </>
                      ) : availableChats.length === 0 ? (
                        'No Chats to Export'
                      ) : (
                        'Export All'
                      )}
                    </Button>
                  </motion.div>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center mb-2">
                    <motion.div className="text-accent-500 mr-2" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                      <div className="i-ph:list-checks w-5 h-5" />
                    </motion.div>
                    <CardTitle className="text-lg group-hover:text-devonz-elements-item-contentAccent transition-colors">
                      Export Selected Chats
                    </CardTitle>
                  </div>
                  <CardDescription>Choose specific chats to export.</CardDescription>
                </CardHeader>
                <CardFooter>
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="w-full">
                    <Button
                      onClick={() => setShowChatsSelection(true)}
                      disabled={isExporting || chatItems.length === 0}
                      variant="outline"
                      size="sm"
                      className={classNames(
                        'hover:text-devonz-elements-item-contentAccent hover:border-devonz-elements-item-backgroundAccent hover:bg-devonz-elements-item-backgroundAccent transition-colors w-full justify-center',
                        isExporting || chatItems.length === 0 ? 'cursor-not-allowed' : '',
                      )}
                    >
                      {isExporting ? (
                        <>
                          <div className="i-ph-spinner-gap-bold animate-spin w-4 h-4 mr-2" />
                          Exporting...
                        </>
                      ) : (
                        'Select Chats'
                      )}
                    </Button>
                  </motion.div>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center mb-2">
                    <motion.div className="text-accent-500 mr-2" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                      <div className="i-ph-upload-duotone w-5 h-5" />
                    </motion.div>
                    <CardTitle className="text-lg group-hover:text-devonz-elements-item-contentAccent transition-colors">
                      Import Chats
                    </CardTitle>
                  </div>
                  <CardDescription>Import chats from a JSON file.</CardDescription>
                </CardHeader>
                <CardFooter>
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="w-full">
                    <Button
                      onClick={() => chatFileInputRef.current?.click()}
                      disabled={isImporting}
                      variant="outline"
                      size="sm"
                      className={classNames(
                        'hover:text-devonz-elements-item-contentAccent hover:border-devonz-elements-item-backgroundAccent hover:bg-devonz-elements-item-backgroundAccent transition-colors w-full justify-center',
                        isImporting ? 'cursor-not-allowed' : '',
                      )}
                    >
                      {isImporting ? (
                        <>
                          <div className="i-ph-spinner-gap-bold animate-spin w-4 h-4 mr-2" />
                          Importing...
                        </>
                      ) : (
                        'Import Chats'
                      )}
                    </Button>
                  </motion.div>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center mb-2">
                    <motion.div
                      className="text-red-500 dark:text-red-400 mr-2"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <div className="i-ph-trash-duotone w-5 h-5" />
                    </motion.div>
                    <CardTitle className="text-lg group-hover:text-devonz-elements-item-contentAccent transition-colors">
                      Delete All Chats
                    </CardTitle>
                  </div>
                  <CardDescription>Delete all your chat history.</CardDescription>
                </CardHeader>
                <CardFooter>
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="w-full">
                    <Button
                      onClick={() => setShowDeleteInlineConfirm(true)}
                      disabled={isDeleting || chatItems.length === 0}
                      variant="outline"
                      size="sm"
                      className={classNames(
                        'hover:text-devonz-elements-item-contentAccent hover:border-devonz-elements-item-backgroundAccent hover:bg-devonz-elements-item-backgroundAccent transition-colors w-full justify-center',
                        isDeleting || chatItems.length === 0 ? 'cursor-not-allowed' : '',
                      )}
                    >
                      {isDeleting ? (
                        <>
                          <div className="i-ph-spinner-gap-bold animate-spin w-4 h-4 mr-2" />
                          Deleting...
                        </>
                      ) : (
                        'Delete All'
                      )}
                    </Button>
                  </motion.div>
                </CardFooter>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Settings Section */}
      {activeSection === 'settings' && (
        <div>
          <h2 className="text-xl font-semibold mb-4 text-white">Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <div className="flex items-center mb-2">
                  <motion.div className="text-accent-500 mr-2" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                    <div className="i-ph-download-duotone w-5 h-5" />
                  </motion.div>
                  <CardTitle className="text-lg group-hover:text-devonz-elements-item-contentAccent transition-colors">
                    Export All Settings
                  </CardTitle>
                </div>
                <CardDescription>Export all your settings to a JSON file.</CardDescription>
              </CardHeader>
              <CardFooter>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="w-full">
                  <Button
                    onClick={handleExportSettings}
                    disabled={isExporting}
                    variant="outline"
                    size="sm"
                    className={classNames(
                      'hover:text-devonz-elements-item-contentAccent hover:border-devonz-elements-item-backgroundAccent hover:bg-devonz-elements-item-backgroundAccent transition-colors w-full justify-center',
                      isExporting ? 'cursor-not-allowed' : '',
                    )}
                  >
                    {isExporting ? (
                      <>
                        <div className="i-ph-spinner-gap-bold animate-spin w-4 h-4 mr-2" />
                        Exporting...
                      </>
                    ) : (
                      'Export All'
                    )}
                  </Button>
                </motion.div>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center mb-2">
                  <motion.div className="text-accent-500 mr-2" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                    <div className="i-ph-filter-duotone w-5 h-5" />
                  </motion.div>
                  <CardTitle className="text-lg group-hover:text-devonz-elements-item-contentAccent transition-colors">
                    Export Selected Settings
                  </CardTitle>
                </div>
                <CardDescription>Choose specific settings to export.</CardDescription>
              </CardHeader>
              <CardFooter>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="w-full">
                  <Button
                    onClick={() => setShowSettingsSelection(true)}
                    disabled={isExporting || settingsCategories.length === 0}
                    variant="outline"
                    size="sm"
                    className={classNames(
                      'hover:text-devonz-elements-item-contentAccent hover:border-devonz-elements-item-backgroundAccent hover:bg-devonz-elements-item-backgroundAccent transition-colors w-full justify-center',
                      isExporting || settingsCategories.length === 0 ? 'cursor-not-allowed' : '',
                    )}
                  >
                    {isExporting ? (
                      <>
                        <div className="i-ph-spinner-gap-bold animate-spin w-4 h-4 mr-2" />
                        Exporting...
                      </>
                    ) : (
                      'Select Settings'
                    )}
                  </Button>
                </motion.div>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center mb-2">
                  <motion.div className="text-accent-500 mr-2" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                    <div className="i-ph-upload-duotone w-5 h-5" />
                  </motion.div>
                  <CardTitle className="text-lg group-hover:text-devonz-elements-item-contentAccent transition-colors">
                    Import Settings
                  </CardTitle>
                </div>
                <CardDescription>Import settings from a JSON file.</CardDescription>
              </CardHeader>
              <CardFooter>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="w-full">
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isImporting}
                    variant="outline"
                    size="sm"
                    className={classNames(
                      'hover:text-devonz-elements-item-contentAccent hover:border-devonz-elements-item-backgroundAccent hover:bg-devonz-elements-item-backgroundAccent transition-colors w-full justify-center',
                      isImporting ? 'cursor-not-allowed' : '',
                    )}
                  >
                    {isImporting ? (
                      <>
                        <div className="i-ph-spinner-gap-bold animate-spin w-4 h-4 mr-2" />
                        Importing...
                      </>
                    ) : (
                      'Import Settings'
                    )}
                  </Button>
                </motion.div>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center mb-2">
                  <motion.div
                    className="text-red-500 dark:text-red-400 mr-2"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <div className="i-ph-arrow-counter-clockwise-duotone w-5 h-5" />
                  </motion.div>
                  <CardTitle className="text-lg group-hover:text-devonz-elements-item-contentAccent transition-colors">
                    Reset All Settings
                  </CardTitle>
                </div>
                <CardDescription>Reset all settings to their default values.</CardDescription>
              </CardHeader>
              <CardFooter>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="w-full">
                  <Button
                    onClick={() => setShowResetInlineConfirm(true)}
                    disabled={isResetting}
                    variant="outline"
                    size="sm"
                    className={classNames(
                      'hover:text-devonz-elements-item-contentAccent hover:border-devonz-elements-item-backgroundAccent hover:bg-devonz-elements-item-backgroundAccent transition-colors w-full justify-center',
                      isResetting ? 'cursor-not-allowed' : '',
                    )}
                  >
                    {isResetting ? (
                      <>
                        <div className="i-ph-spinner-gap-bold animate-spin w-4 h-4 mr-2" />
                        Resetting...
                      </>
                    ) : (
                      'Reset All'
                    )}
                  </Button>
                </motion.div>
              </CardFooter>
            </Card>

            {/* Download Full Backup */}
            <Card>
              <CardHeader>
                <div className="flex items-center mb-2">
                  <motion.div className="text-accent-500 mr-2" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                    <div className="i-ph-download-simple-duotone w-5 h-5" />
                  </motion.div>
                  <CardTitle className="text-lg group-hover:text-devonz-elements-item-contentAccent transition-colors">
                    Download Full Backup
                  </CardTitle>
                </div>
                <CardDescription>Download all chats, snapshots, and versions as a JSON file.</CardDescription>
              </CardHeader>
              <CardFooter>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="w-full">
                  <Button
                    onClick={async () => {
                      try {
                        const { downloadBackup } = await import('~/lib/persistence/autoBackup');
                        const database = await openDatabase();

                        if (!database) {
                          toast.error('Database not available');
                          return;
                        }

                        await downloadBackup(database);
                        toast.success('Backup downloaded');
                      } catch (err) {
                        logger.error('Backup download failed:', err);
                        toast.error('Failed to download backup');
                      }
                    }}
                    variant="outline"
                    size="sm"
                    className="hover:text-devonz-elements-item-contentAccent hover:border-devonz-elements-item-backgroundAccent hover:bg-devonz-elements-item-backgroundAccent transition-colors w-full justify-center"
                  >
                    Download Backup
                  </Button>
                </motion.div>
              </CardFooter>
            </Card>

            {/* Restore from Backup */}
            <Card>
              <CardHeader>
                <div className="flex items-center mb-2">
                  <motion.div className="text-accent-500 mr-2" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                    <div className="i-ph-upload-simple-duotone w-5 h-5" />
                  </motion.div>
                  <CardTitle className="text-lg group-hover:text-devonz-elements-item-contentAccent transition-colors">
                    Restore from Backup
                  </CardTitle>
                </div>
                <CardDescription>Import chats from a previously downloaded backup JSON file.</CardDescription>
              </CardHeader>
              <CardFooter>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="w-full">
                  <Button
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = '.json';

                      input.onchange = async (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];

                        if (!file) {
                          return;
                        }

                        try {
                          const text = await file.text();
                          const data = JSON.parse(text);

                          if (!data?._meta?.version || !Array.isArray(data?.chats)) {
                            toast.error('Invalid backup file format');
                            return;
                          }

                          const database = await openDatabase();

                          if (!database) {
                            toast.error('Database not available');
                            return;
                          }

                          const { setMessages, setSnapshot, saveVersions } = await import('~/lib/persistence/db');
                          let imported = 0;

                          for (const chat of data.chats) {
                            try {
                              await setMessages(
                                database,
                                chat.id,
                                chat.messages,
                                chat.urlId,
                                chat.description,
                                chat.timestamp,
                                chat.metadata,
                              );

                              if (data.snapshots?.[chat.id]) {
                                await setSnapshot(database, chat.id, data.snapshots[chat.id]);
                              }

                              if (data.versions?.[chat.id]) {
                                await saveVersions(database, chat.id, data.versions[chat.id]);
                              }

                              imported++;
                            } catch (err) {
                              logger.error(`Failed to restore chat ${chat.id}:`, err);
                            }
                          }

                          toast.success(`Restored ${imported} of ${data.chats.length} chats`);
                        } catch (err) {
                          logger.error('Restore failed:', err);
                          toast.error('Failed to restore backup');
                        }
                      };

                      input.click();
                    }}
                    variant="outline"
                    size="sm"
                    className="hover:text-devonz-elements-item-contentAccent hover:border-devonz-elements-item-backgroundAccent hover:bg-devonz-elements-item-backgroundAccent transition-colors w-full justify-center"
                  >
                    Restore Backup
                  </Button>
                </motion.div>
              </CardFooter>
            </Card>
          </div>
        </div>
      )}

      {/* API Keys Section */}
      {activeSection === 'api-keys' && (
        <div>
          <h2 className="text-xl font-semibold mb-4 text-white">API Keys</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <div className="flex items-center mb-2">
                  <motion.div className="text-accent-500 mr-2" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                    <div className="i-ph-file-text-duotone w-5 h-5" />
                  </motion.div>
                  <CardTitle className="text-lg group-hover:text-devonz-elements-item-contentAccent transition-colors">
                    Download Template
                  </CardTitle>
                </div>
                <CardDescription>Download a template file for your API keys.</CardDescription>
              </CardHeader>
              <CardFooter>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="w-full">
                  <Button
                    onClick={handleDownloadTemplate}
                    disabled={isDownloadingTemplate}
                    variant="outline"
                    size="sm"
                    className={classNames(
                      'hover:text-devonz-elements-item-contentAccent hover:border-devonz-elements-item-backgroundAccent hover:bg-devonz-elements-item-backgroundAccent transition-colors w-full justify-center',
                      isDownloadingTemplate ? 'cursor-not-allowed' : '',
                    )}
                  >
                    {isDownloadingTemplate ? (
                      <>
                        <div className="i-ph-spinner-gap-bold animate-spin w-4 h-4 mr-2" />
                        Downloading...
                      </>
                    ) : (
                      'Download'
                    )}
                  </Button>
                </motion.div>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center mb-2">
                  <motion.div className="text-accent-500 mr-2" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                    <div className="i-ph-upload-duotone w-5 h-5" />
                  </motion.div>
                  <CardTitle className="text-lg group-hover:text-devonz-elements-item-contentAccent transition-colors">
                    Import API Keys
                  </CardTitle>
                </div>
                <CardDescription>Import API keys from a JSON file.</CardDescription>
              </CardHeader>
              <CardFooter>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="w-full">
                  <Button
                    onClick={() => apiKeyFileInputRef.current?.click()}
                    disabled={isImportingKeys}
                    variant="outline"
                    size="sm"
                    className={classNames(
                      'hover:text-devonz-elements-item-contentAccent hover:border-devonz-elements-item-backgroundAccent hover:bg-devonz-elements-item-backgroundAccent transition-colors w-full justify-center',
                      isImportingKeys ? 'cursor-not-allowed' : '',
                    )}
                  >
                    {isImportingKeys ? (
                      <>
                        <div className="i-ph-spinner-gap-bold animate-spin w-4 h-4 mr-2" />
                        Importing...
                      </>
                    ) : (
                      'Import Keys'
                    )}
                  </Button>
                </motion.div>
              </CardFooter>
            </Card>
          </div>
        </div>
      )}

      {/* Data Visualization */}
      {activeSection === 'data-usage' && (
        <div>
          <h2 className="text-xl font-semibold mb-4 text-white">Data Usage</h2>
          <Card>
            <CardContent className="p-5">
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-12 text-bolt-elements-textSecondary">
                    <div className="i-svg-spinners:90-ring-with-bg text-2xl mr-2" />
                    Loading charts…
                  </div>
                }
              >
                <DataVisualization chats={availableChats} />
              </Suspense>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
