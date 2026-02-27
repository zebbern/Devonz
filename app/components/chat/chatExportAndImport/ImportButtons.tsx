import type { UIMessage as Message } from 'ai';
import { toast } from 'react-toastify';
import { ImportFolderButton } from '~/components/chat/ImportFolderButton';
import { Button } from '~/components/ui/Button';
import { classNames } from '~/utils/classNames';

type ChatData = {
  messages?: Message[]; // Standard Bolt format
  description?: string; // Optional description
};

export function ImportButtons(importChat: ((description: string, messages: Message[]) => Promise<void>) | undefined) {
  return (
    <div className="flex flex-col items-center justify-center w-auto">
      <input
        type="file"
        id="chat-import"
        className="hidden"
        accept=".json"
        title="Upload chat JSON file"
        aria-label="Upload chat JSON file"
        onChange={async (e) => {
          const file = e.target.files?.[0];

          if (file && importChat) {
            try {
              const reader = new FileReader();

              reader.onload = async (e) => {
                try {
                  const content = e.target?.result as string;
                  const data = JSON.parse(content) as ChatData;

                  // Standard format
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
            e.target.value = ''; // Reset file input
          } else {
            toast.error('Something went wrong');
          }
        }}
      />
      <div className="flex flex-col items-center gap-4 max-w-2xl text-center">
        <div className="flex gap-2">
          <Button
            onClick={() => {
              const input = document.getElementById('chat-import');
              input?.click();
            }}
            variant="default"
            size="lg"
            className={classNames(
              'gap-2',
              'text-gray-300 hover:text-white',
              'border border-[#333333] hover:border-purple-500/50',
              'h-10 px-4 py-2 min-w-[120px] justify-center',
              'transition-all duration-200 ease-in-out',
              'hover:shadow-[0_0_12px_rgba(168,85,247,0.15)]',
              'bg-[#2a2a2a]',
            )}
          >
            <span className="i-ph:upload-simple w-4 h-4" />
            Import Chat
          </Button>
          <ImportFolderButton
            importChat={importChat}
            className={classNames(
              'gap-2',
              'text-gray-300 hover:text-white',
              'border border-[#333333] hover:border-purple-500/50',
              'h-10 px-4 py-2 min-w-[120px] justify-center',
              'transition-all duration-200 ease-in-out rounded-lg',
              'hover:shadow-[0_0_12px_rgba(168,85,247,0.15)]',
              'bg-[#2a2a2a]',
            )}
          />
        </div>
      </div>
    </div>
  );
}
