import type { Message } from 'ai';
import { toast } from 'react-toastify';
import { ImportFolderButton } from '~/components/chat/ImportFolderButton';
import { Button } from '~/components/ui/Button';
import { classNames } from '~/utils/classNames';
import GitCloneButton from './GitCloneButton';
import type { IChatMetadata } from '~/lib/persistence/db';

type ChatData = {
  messages?: Message[];
  description?: string;
};

interface LeftActionPanelProps {
  importChat?: (description: string, messages: Message[], metadata?: IChatMetadata) => Promise<void>;
}

export function LeftActionPanel({ importChat }: LeftActionPanelProps) {
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (file && importChat) {
      try {
        const reader = new FileReader();

        reader.onload = async (event) => {
          try {
            const content = event.target?.result as string;
            const data = JSON.parse(content) as ChatData;

            if (Array.isArray(data.messages)) {
              await importChat(data.description || 'Imported Chat', data.messages);
              toast.success('Chat imported successfully');

              return;
            }

            toast.error('Invalid chat file format');
          } catch (error: unknown) {
            if (error instanceof Error) {
              toast.error('Failed to parse chat file: ' + error.message);
            } else {
              toast.error('Failed to parse chat file');
            }
          }
        };

        reader.onerror = () => toast.error('Failed to read chat file');
        reader.readAsText(file);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to import chat');
      }

      e.target.value = '';
    } else {
      toast.error('Something went wrong');
    }
  };

  const buttonBaseClass = classNames(
    '!flex w-full items-center gap-2 justify-center',
    'text-gray-300 hover:text-white',
    'border border-[#333333] hover:border-[#4a5568]',
    'h-10 px-4 py-2',
    'transition-all duration-200 ease-in-out',
    'rounded-lg text-sm font-medium',
    'hover:bg-[#2a2a2a]',
  );

  const primaryButtonClass = classNames(
    '!flex w-full items-center gap-2 justify-center',
    'text-white',
    'bg-gradient-to-r from-[#1e3a5f] to-[#2d4a6f]',
    'border border-[#3d5a7f] hover:border-[#4d6a8f]',
    'h-10 px-4 py-2',
    'transition-all duration-200 ease-in-out',
    'rounded-lg text-sm font-medium',
    'hover:from-[#2a4a6f] hover:to-[#3d5a7f]',
    'shadow-[0_2px_8px_rgba(30,58,95,0.3)]',
  );

  return (
    <div className="grid grid-cols-3 gap-3 w-full max-w-xl items-stretch">
      {/* Hidden file input */}
      <input type="file" id="chat-import-left" className="hidden" accept=".json" onChange={handleFileImport} />

      {/* Import Chat Button */}
      <div className="flex h-10">
        <Button
          onClick={() => {
            const input = document.getElementById('chat-import-left');
            input?.click();
          }}
          variant="default"
          className={buttonBaseClass}
          style={{ backgroundColor: '#1a2332', width: '100%', height: '100%' }}
        >
          <span className="i-ph:upload-simple w-4 h-4" />
          <span>Import Chat</span>
        </Button>
      </div>

      {/* Import Folder Button */}
      <div className="flex h-10">
        <ImportFolderButton
          importChat={importChat}
          className={buttonBaseClass}
          style={{ backgroundColor: '#1a2332', width: '100%', height: '100%' }}
        />
      </div>

      {/* Clone a Repo Button - Primary/Highlighted */}
      <div className="flex h-10">
        <GitCloneButton
         
         
         
       
          importChat={importChat}
          className={primaryButtonClass}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  );
}
