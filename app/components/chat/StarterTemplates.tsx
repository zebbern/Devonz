import React, { useRef, useState, useEffect } from 'react';
import type { Template } from '~/types/template';
import { STARTER_TEMPLATES } from '~/utils/constants';

interface FrameworkLinkProps {
  template: Template;
}

const FrameworkLink: React.FC<FrameworkLinkProps> = ({ template }) => (
  <a
    href={`/git?url=https://github.com/${template.githubRepo}.git`}
    data-state="closed"
    data-discover="true"
    className="flex-shrink-0 group relative"
  >
    <div
      className={`inline-block ${template.icon} w-10 h-10 text-4xl transition-all duration-300 
        text-gray-400 opacity-60 
        group-hover:text-purple-400 group-hover:opacity-100 group-hover:scale-110
        grayscale group-hover:grayscale-0
        group-hover:drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]`}
      title={template.label}
    />
  </a>
);

const StarterTemplates: React.FC = () => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const checkScrollability = () => {
    const container = scrollContainerRef.current;

    if (container) {
      setCanScrollLeft(container.scrollLeft > 0);
      setCanScrollRight(container.scrollLeft < container.scrollWidth - container.clientWidth - 1);
    }
  };

  useEffect(() => {
    checkScrollability();
    window.addEventListener('resize', checkScrollability);

    return () => window.removeEventListener('resize', checkScrollability);
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;

    if (container) {
      const scrollAmount = 200;
      container.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-2xl mx-auto">
      <span className="text-sm text-gray-500">or start a blank app with your favorite stack</span>

      {/* Carousel Container */}
      <div className="relative w-full" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
        {/* Left Arrow */}
        <button
          type="button"
          onClick={() => scroll('left')}
          className={`absolute left-0 top-1/2 -translate-y-1/2 z-10
            w-8 h-8 flex items-center justify-center
            bg-[#1a2332]/90 backdrop-blur-sm rounded-full
            border border-bolt-elements-borderColor
            text-bolt-elements-textSecondary hover:text-purple-400
            transition-all duration-300
            ${canScrollLeft && isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 pointer-events-none'}
            hover:bg-[#2a2a2a] hover:border-purple-500/50`}
          aria-label="Scroll left"
        >
          <span className="i-ph:caret-left text-lg" />
        </button>

        {/* Left Fade Gradient */}
        <div
          className={`absolute left-8 top-0 bottom-0 w-8 bg-gradient-to-r from-bolt-elements-background-depth-1 to-transparent z-[1] pointer-events-none transition-opacity duration-300
            ${canScrollLeft ? 'opacity-100' : 'opacity-0'}`}
        />

        {/* Scrollable Container */}
        <div
          ref={scrollContainerRef}
          onScroll={checkScrollability}
          className="flex items-center gap-5 px-10 py-2 overflow-x-auto scroll-smooth
            [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        >
          {STARTER_TEMPLATES.map((template) => (
            <FrameworkLink key={template.name} template={template} />
          ))}
        </div>

        {/* Right Fade Gradient */}
        <div
          className={`absolute right-8 top-0 bottom-0 w-8 bg-gradient-to-l from-bolt-elements-background-depth-1 to-transparent z-[1] pointer-events-none transition-opacity duration-300
            ${canScrollRight ? 'opacity-100' : 'opacity-0'}`}
        />

        {/* Right Arrow */}
        <button
          type="button"
          onClick={() => scroll('right')}
          className={`absolute right-0 top-1/2 -translate-y-1/2 z-10
            w-8 h-8 flex items-center justify-center
            bg-[#1a2332]/90 backdrop-blur-sm rounded-full
            border border-bolt-elements-borderColor
            text-bolt-elements-textSecondary hover:text-purple-400
            transition-all duration-300
            ${canScrollRight && isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2 pointer-events-none'}
            hover:bg-[#2a2a2a] hover:border-purple-500/50`}
          aria-label="Scroll right"
        >
          <span className="i-ph:caret-right text-lg" />
        </button>
      </div>
    </div>
  );
};

export default StarterTemplates;
