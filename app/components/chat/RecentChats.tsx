import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from '@remix-run/react';
import { classNames } from '~/utils/classNames';
import { db, getAll, type ChatHistoryItem } from '~/lib/persistence';
import { formatDistanceToNow } from 'date-fns';

interface RecentChatsProps {
  maxItems?: number;
}

export const RecentChats: React.FC<RecentChatsProps> = ({ maxItems = 10 }) => {
  const navigate = useNavigate();
  const [chats, setChats] = useState<ChatHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadChats = useCallback(async () => {
    if (!db) {
      setLoading(false);
      return;
    }

    try {
      const allChats = await getAll(db);

      // Filter chats with urlId and description, sort by timestamp descending
      const filteredChats = allChats
        .filter((item) => item.urlId && item.description)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, maxItems);

      setChats(filteredChats);
    } catch (error) {
      console.error('Failed to load chat history:', error);
    } finally {
      setLoading(false);
    }
  }, [maxItems]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto mt-8 px-4">
        <div className="flex items-center justify-center py-8">
          <div className="i-svg-spinners:90-ring-with-bg text-2xl text-bolt-elements-loader-progress" />
        </div>
      </div>
    );
  }

  if (chats.length === 0) {
    return null; // Don't show section if no chats
  }

  const handleChatClick = (chat: ChatHistoryItem) => {
    navigate(`/chat/${chat.urlId}`);
  };

  const formatRelativeTime = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return timestamp;
    }
  };

  const getPreviewText = (chat: ChatHistoryItem) => {
    // Get the first user message as preview
    const firstUserMessage = chat.messages.find((m) => m.role === 'user');

    if (firstUserMessage && typeof firstUserMessage.content === 'string') {
      return firstUserMessage.content.slice(0, 120) + (firstUserMessage.content.length > 120 ? '...' : '');
    }

    return 'No preview available';
  };

  return (
    <div className="w-full max-w-4xl mx-auto mt-8 px-4 pb-8">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="i-ph:clock-counter-clockwise text-xl text-[#6b8bb8]" />
        <h2 className="text-lg font-medium text-bolt-elements-textPrimary">Recent Chats</h2>
        <div className="flex-1 h-px bg-gradient-to-r from-[#3d5a7f]/40 to-transparent" />
      </div>

      {/* Chats Table */}
      <div
        className={classNames(
          'rounded-xl overflow-hidden',
          'border border-[#3d5a7f]/30',
          'bg-gradient-to-b from-[#1e3a5f]/10 to-[#0b0d13]/90',
        )}
      >
        {/* Table Header */}
        <div className="grid grid-cols-[1fr_auto] gap-4 px-4 py-3 border-b border-[#3d5a7f]/20 bg-[#1e3a5f]/10">
          <div className="text-xs font-medium text-[#6b8bb8] uppercase tracking-wider">Task</div>
          <div className="text-xs font-medium text-[#6b8bb8] uppercase tracking-wider text-right">Last Modified</div>
        </div>

        {/* Chat Items */}
        <div className="divide-y divide-[#3d5a7f]/10">
          {chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => handleChatClick(chat)}
              className={classNames(
                'grid grid-cols-[1fr_auto] gap-4 px-4 py-3',
                'cursor-pointer transition-all duration-200',
                'hover:bg-[#1e3a5f]/20',
                'group',
              )}
            >
              {/* Task Info */}
              <div className="min-w-0">
                <div className="font-medium text-bolt-elements-textPrimary truncate group-hover:text-[#8badd4] transition-colors">
                  {chat.description || 'Untitled Chat'}
                </div>
                <div className="text-xs text-bolt-elements-textTertiary truncate mt-0.5">{getPreviewText(chat)}</div>
              </div>

              {/* Timestamp */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm text-bolt-elements-textSecondary">{formatRelativeTime(chat.timestamp)}</span>
                <div className="i-ph:arrow-right text-bolt-elements-textTertiary opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          ))}
        </div>

        {/* View All Link */}
        {chats.length >= maxItems && (
          <div className="px-4 py-3 border-t border-[#3d5a7f]/20 bg-[#0b0d13]/50">
            <button
              onClick={() => {
                /* Could navigate to a full history page or open sidebar */
              }}
              className="text-sm text-[#6b8bb8] hover:text-[#8badd4] transition-colors flex items-center gap-1"
            >
              View all chats
              <div className="i-ph:arrow-right text-xs" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentChats;
