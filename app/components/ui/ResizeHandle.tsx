import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { classNames } from '~/utils/classNames';

interface ResizeHandleProps {
  onResize: (deltaX: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
  disabled?: boolean;
  className?: string;
}

export const ResizeHandle = memo(
  ({ onResize, onResizeStart, onResizeEnd, disabled = false, className }: ResizeHandleProps) => {
    const [isDragging, setIsDragging] = useState(false);
    const startXRef = useRef<number>(0);

    const handleMouseDown = useCallback(
      (e: React.MouseEvent) => {
        if (disabled) {
          return;
        }

        e.preventDefault();
        startXRef.current = e.clientX;
        setIsDragging(true);
        onResizeStart?.();
      },
      [disabled, onResizeStart],
    );

    const handleTouchStart = useCallback(
      (e: React.TouchEvent) => {
        if (disabled) {
          return;
        }

        const touch = e.touches[0];
        startXRef.current = touch.clientX;
        setIsDragging(true);
        onResizeStart?.();
      },
      [disabled, onResizeStart],
    );

    useEffect(() => {
      if (!isDragging) {
        return undefined;
      }

      const handleMouseMove = (e: MouseEvent) => {
        const deltaX = e.clientX - startXRef.current;
        startXRef.current = e.clientX;
        onResize(deltaX);
      };

      const handleTouchMove = (e: TouchEvent) => {
        const touch = e.touches[0];
        const deltaX = touch.clientX - startXRef.current;
        startXRef.current = touch.clientX;
        onResize(deltaX);
      };

      const handleEnd = () => {
        setIsDragging(false);
        onResizeEnd?.();
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchmove', handleTouchMove, { passive: true });
      document.addEventListener('touchend', handleEnd);
      document.addEventListener('touchcancel', handleEnd);

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const cleanup = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleEnd);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleEnd);
        document.removeEventListener('touchcancel', handleEnd);

        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      return cleanup;
    }, [isDragging, onResize, onResizeEnd]);

    return (
      <div
        className={classNames(
          'flex-shrink-0 w-1 relative cursor-col-resize group hover:w-1 transition-all duration-150',
          {
            'opacity-50 cursor-not-allowed': disabled,
          },
          className,
        )}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize handle"
        tabIndex={disabled ? -1 : 0}
      >
        <div
          className={classNames(
            'absolute inset-y-0 left-1/2 -translate-x-1/2 w-[3px] rounded-full transition-all duration-150',
            'bg-bolt-elements-borderColor',
            {
              'bg-accent-500 w-[4px]': isDragging,
              'group-hover:bg-accent-500/70 group-hover:w-[4px]': !disabled && !isDragging,
            },
          )}
        />
        <div className="absolute inset-y-0 -left-2 -right-2" />
        <div
          className={classNames(
            'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
            'flex flex-col gap-1 opacity-0 transition-opacity duration-150',
            {
              'opacity-100': isDragging,
              'group-hover:opacity-70': !disabled && !isDragging,
            },
          )}
        >
          <div className="w-1 h-1 rounded-full bg-accent-500" />
          <div className="w-1 h-1 rounded-full bg-accent-500" />
          <div className="w-1 h-1 rounded-full bg-accent-500" />
        </div>
      </div>
    );
  },
);
