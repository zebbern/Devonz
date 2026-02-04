import { useCallback } from 'react';
import type { ElementInfo } from './Inspector';

interface AiQuickActionsProps {
  selectedElement: ElementInfo | null;
  onAIAction: (message: string) => void;
}

interface QuickAction {
  id: string;
  icon: string;
  label: string;
  description: string;
  generatePrompt: (element: ElementInfo) => string;
}

const quickActions: QuickAction[] = [
  {
    id: 'center',
    icon: 'i-ph:align-center-horizontal',
    label: 'Center',
    description: 'Center this element',
    generatePrompt: (element) => {
      const selector = buildSelector(element);

      return `Please center the element \`${selector}\` both horizontally and vertically within its parent container. Use flexbox or grid for modern centering.`;
    },
  },
  {
    id: 'responsive',
    icon: 'i-ph:devices',
    label: 'Responsive',
    description: 'Make responsive',
    generatePrompt: (element) => {
      const selector = buildSelector(element);

      return `Please make the element \`${selector}\` fully responsive. Add appropriate media queries or use relative units (%, rem, vw/vh) so it adapts well to mobile, tablet, and desktop screens.`;
    },
  },
  {
    id: 'add-animation',
    icon: 'i-ph:sparkle',
    label: 'Animate',
    description: 'Add animation',
    generatePrompt: (element) => {
      const selector = buildSelector(element);

      return `Please add a subtle, professional CSS animation to the element \`${selector}\`. Consider a fade-in, slide-in, or gentle hover effect that enhances the user experience without being distracting.`;
    },
  },
  {
    id: 'improve-spacing',
    icon: 'i-ph:arrows-out',
    label: 'Spacing',
    description: 'Improve spacing',
    generatePrompt: (element) => {
      const selector = buildSelector(element);
      const boxModel = element.boxModel;
      const currentSpacing = boxModel
        ? `Current margin: ${boxModel.margin.top}px ${boxModel.margin.right}px ${boxModel.margin.bottom}px ${boxModel.margin.left}px, padding: ${boxModel.padding.top}px ${boxModel.padding.right}px ${boxModel.padding.bottom}px ${boxModel.padding.left}px`
        : '';

      return `Please improve the spacing (margin and padding) of the element \`${selector}\` to create better visual hierarchy and breathing room. ${currentSpacing}. Adjust these values for better aesthetics while maintaining consistency with the overall design.`;
    },
  },
  {
    id: 'accessibility',
    icon: 'i-ph:eye',
    label: 'A11y',
    description: 'Improve accessibility',
    generatePrompt: (element) => {
      const selector = buildSelector(element);
      const tagName = element.tagName.toLowerCase();

      return `Please improve the accessibility of the element \`${selector}\` (${tagName}). Consider adding:
- Appropriate ARIA labels and roles if needed
- Sufficient color contrast
- Focus states for interactive elements
- Screen reader friendly content
- Keyboard navigation support if applicable`;
    },
  },
  {
    id: 'add-shadow',
    icon: 'i-ph:drop-half-bottom',
    label: 'Shadow',
    description: 'Add shadow effect',
    generatePrompt: (element) => {
      const selector = buildSelector(element);

      return `Please add a subtle, modern box-shadow to the element \`${selector}\` to create depth and elevation. Use a soft shadow that works well with both light and dark themes.`;
    },
  },
  {
    id: 'rounded-corners',
    icon: 'i-ph:rounded-square',
    label: 'Round',
    description: 'Add rounded corners',
    generatePrompt: (element) => {
      const selector = buildSelector(element);

      return `Please add appropriate border-radius to the element \`${selector}\` to give it nicely rounded corners. Choose a radius that fits the overall design aesthetic.`;
    },
  },
  {
    id: 'duplicate',
    icon: 'i-ph:copy',
    label: 'Duplicate',
    description: 'Duplicate element',
    generatePrompt: (element) => {
      const selector = buildSelector(element);

      return `Please duplicate the element \`${selector}\` and place the copy right after the original. Keep all the same styling and content.`;
    },
  },
];

function buildSelector(element: ElementInfo): string {
  const parts = [element.tagName.toLowerCase()];

  if (element.id) {
    parts.push(`#${element.id}`);
  }

  if (element.className) {
    const firstClass = element.className.split(' ')[0];

    if (firstClass) {
      parts.push(`.${firstClass}`);
    }
  }

  return parts.join('');
}

export const AiQuickActions = ({ selectedElement, onAIAction }: AiQuickActionsProps) => {
  const handleAction = useCallback(
    (action: QuickAction) => {
      if (!selectedElement) {
        return;
      }

      const prompt = action.generatePrompt(selectedElement);
      onAIAction(prompt);
    },
    [selectedElement, onAIAction],
  );

  if (!selectedElement) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-bolt-elements-textSecondary">
        <div className="i-ph:magic-wand w-3.5 h-3.5 text-accent-400" />
        <span>Quick AI Actions</span>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {quickActions.map((action) => (
          <button
            key={action.id}
            onClick={() => handleAction(action)}
            className="flex flex-col items-center gap-1 p-2 rounded-lg bg-[#2D3748] border border-bolt-elements-borderColor hover:border-accent-500/50 hover:bg-bolt-elements-background-depth-4 transition-all group"
            title={action.description}
          >
            <div
              className={`${action.icon} w-4 h-4 text-bolt-elements-textSecondary group-hover:text-accent-400 transition-colors`}
            />
            <span className="text-[10px] text-bolt-elements-textSecondary group-hover:text-bolt-elements-textPrimary">
              {action.label}
            </span>
          </button>
        ))}
      </div>

      <p className="text-[10px] text-bolt-elements-textTertiary text-center italic">
        Click an action to send the request to AI
      </p>
    </div>
  );
};
