import React, { useState, useCallback } from 'react';

interface ExamplePromptsProps {
  sendMessage?: (event: React.UIEvent, messageInput?: string) => void;
}

const ALL_PROMPTS = [
  { text: 'AI Landing Page Builder', icon: 'i-ph:globe-duotone', color: 'text-cyan-400' },
  { text: 'AI Customer Support Chatbot Platform', icon: 'i-ph:globe-duotone', color: 'text-cyan-400' },
  { text: 'AI Interview Screening Platform', icon: 'i-ph:monitor-duotone', color: 'text-purple-400' },
  { text: 'Sales Pitch Presentation', icon: 'i-ph:presentation-chart-duotone', color: 'text-pink-400' },
  { text: 'Referral Program Platform', icon: 'i-ph:users-duotone', color: 'text-purple-400' },
  { text: 'AI Social Media Manager', icon: 'i-ph:globe-duotone', color: 'text-cyan-400' },
  { text: 'E-commerce Dashboard', icon: 'i-ph:storefront-duotone', color: 'text-green-400' },
  { text: 'Project Management Tool', icon: 'i-ph:kanban-duotone', color: 'text-blue-400' },
  { text: 'AI Content Generator', icon: 'i-ph:article-duotone', color: 'text-orange-400' },
  { text: 'Portfolio Website', icon: 'i-ph:briefcase-duotone', color: 'text-indigo-400' },
  { text: 'Real-time Chat Application', icon: 'i-ph:chat-circle-dots-duotone', color: 'text-teal-400' },
  { text: 'Invoice Generator Tool', icon: 'i-ph:receipt-duotone', color: 'text-yellow-400' },
];

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

export function ExamplePrompts({ sendMessage }: ExamplePromptsProps) {
  const [prompts, setPrompts] = useState(() => shuffleArray(ALL_PROMPTS).slice(0, 3));

  const refreshPrompts = useCallback(() => {
    setPrompts(shuffleArray(ALL_PROMPTS).slice(0, 3));
  }, []);

  const buttonStyle = {
    backgroundColor: '#1a2332',
    color: '#9ca3af',
    border: '1px solid #333333',
  };

  const hoverIn = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.backgroundColor = '#2a2a2a';
    e.currentTarget.style.color = '#ffffff';
  };

  const hoverOut = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.backgroundColor = '#1a2332';
    e.currentTarget.style.color = '#9ca3af';
  };

  return (
    <div className="flex items-center gap-2 w-full max-w-3xl mx-auto px-3 py-2">
      {prompts.map((prompt, index) => (
        <button
          key={`${prompt.text}-${index}`}
          onClick={(event) => sendMessage?.(event, prompt.text)}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs transition-colors whitespace-nowrap rounded"
          style={buttonStyle}
          onMouseEnter={hoverIn}
          onMouseLeave={hoverOut}
        >
          <div className={`${prompt.icon} ${prompt.color} text-sm flex-shrink-0`} />
          <span>{prompt.text}</span>
        </button>
      ))}

      <button
        onClick={refreshPrompts}
        className="ml-auto flex-shrink-0 p-1.5 transition-colors rounded"
        style={buttonStyle}
        onMouseEnter={hoverIn}
        onMouseLeave={hoverOut}
        title="Try different ideas"
      >
        <div className="i-ph:arrows-clockwise text-sm" />
      </button>
    </div>
  );
}
