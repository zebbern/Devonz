import React, { useState } from 'react';
import type { UIMessage as Message } from 'ai';
import { toast } from 'react-toastify';
import { MAX_FILES, isBinaryFile, shouldIncludeFile } from '~/utils/fileUtils';
import { createChatFromFolder } from '~/utils/folderImport';
import { logStore } from '~/lib/stores/logs';
import { Button } from '~/components/ui/Button';
import { classNames } from '~/utils/classNames';
import {
  startImport,
  setImportProgress,
  setImportFile,
  setImportStatus,
  setImportError,
} from '~/lib/stores/importStore';

interface ImportFolderButtonProps {
  className?: string;
  style?: React.CSSProperties;
  importChat?: (description: string, messages: Message[]) => Promise<void>;
}

export const ImportFolderButton: React.FC<ImportFolderButtonProps> = ({ className, style, importChat }) => {
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const allFiles = Array.from(e.target.files || []);

    const filteredFiles = allFiles.filter((file) => {
      const path = file.webkitRelativePath.split('/').slice(1).join('/');
      const include = shouldIncludeFile(path);

      return include;
    });

    if (filteredFiles.length === 0) {
      const error = new Error('No valid files found');
      logStore.logError('File import failed - no valid files', error, { folderName: 'Unknown Folder' });
      toast.error('No files found in the selected folder');

      return;
    }

    if (filteredFiles.length > MAX_FILES) {
      const error = new Error(`Too many files: ${filteredFiles.length}`);
      logStore.logError('File import failed - too many files', error, {
        fileCount: filteredFiles.length,
        maxFiles: MAX_FILES,
      });
      toast.error(
        `This folder contains ${filteredFiles.length.toLocaleString()} files. This product is optimized for projects up to ${MAX_FILES.toLocaleString()} files.`,
      );

      return;
    }

    const folderName = filteredFiles[0]?.webkitRelativePath.split('/')[0] || 'Unknown Folder';
    setIsLoading(true);
    startImport(folderName, filteredFiles.length);

    try {
      const textFiles: File[] = [];
      const binaryFilePaths: string[] = [];

      // Phase 1 & 2: Storage and Indexing
      setImportStatus('storing');

      for (let i = 0; i < filteredFiles.length; i++) {
        const file = filteredFiles[i];
        const relativePath = file.webkitRelativePath.split('/').slice(1).join('/');
        const isBinary = await isBinaryFile(file);

        setImportFile(relativePath);
        setImportProgress(((i + 1) / filteredFiles.length) * 80); // First 80% for server processing

        // Send to server for MinIO and RAG
        const formData = new FormData();
        formData.append('file', file);
        formData.append('path', relativePath);
        formData.append('isBinary', String(isBinary));

        const response = await fetch('/api/import-file', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || 'Failed to process file on server');
        }

        if (isBinary) {
          binaryFilePaths.push(relativePath);
        } else {
          textFiles.push(file);
        }
      }

      if (textFiles.length === 0) {
        throw new Error('No text files found in the selected folder');
      }

      // Phase 3: Workspace Sync
      setImportStatus('syncing');
      setImportProgress(90);

      const messages = await createChatFromFolder(textFiles, binaryFilePaths, folderName);

      if (importChat) {
        await importChat(folderName, [...messages]);
      }

      setImportStatus('complete');
      setImportProgress(100);

      logStore.logSystem('Folder imported successfully with RAG indexing', {
        folderName,
        textFileCount: textFiles.length,
        binaryFileCount: binaryFilePaths.length,
      });
      toast.success('Folder imported and indexed successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setImportError(errorMessage);
      logStore.logError('Failed to import folder', error, { folderName });
      console.error('Failed to import folder:', error);
      toast.error(`Failed to import folder: ${errorMessage}`);
    } finally {
      setIsLoading(false);
      e.target.value = ''; // Reset file input
    }
  };

  return (
    <>
      <input
        type="file"
        ref={inputRef}
        className="hidden"
        title="Upload folder"
        placeholder="Upload folder"
        onChange={handleFileChange}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {...({ webkitdirectory: '', directory: '' } as any)}
      />
      <Button
        onClick={() => {
          inputRef.current?.click();
        }}
        title="Import Folder"
        variant="default"
        size="lg"
        className={classNames(
          'flex gap-2 bg-bolt-elements-background-depth-1',
          'text-bolt-elements-textPrimary',
          'hover:bg-bolt-elements-background-depth-2',
          'border border-bolt-elements-borderColor',
          'h-10 px-4 py-2 justify-center',
          'transition-all duration-200 ease-in-out',
          className,
        )}
        style={style}
        disabled={isLoading}
      >
        <span className="i-ph:upload-simple w-4 h-4" />
        {isLoading ? 'Importing...' : 'Import Folder'}
      </Button>
    </>
  );
};
