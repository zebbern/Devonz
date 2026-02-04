import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Template } from '~/types/template';
import { STARTER_TEMPLATES } from '~/utils/constants';

interface FrameworkIconProps {
  template: Template;
  isSpotlight?: boolean;
}

const FrameworkIcon: React.FC<FrameworkIconProps> = ({ template, isSpotlight }) => (
  <a
    href={`/git?url=https://github.com/${template.githubRepo}.git`}
    data-state="closed"
    data-discover="true"
    className="group relative flex-shrink-0"
    title={template.label}
  >
    <div
      className={`inline-block ${template.icon} w-8 h-8 text-2xl transition-all duration-500 ease-in-out ${
        isSpotlight
          ? 'text-[#4d6a8f] opacity-100 scale-125 grayscale-0 drop-shadow-[0_0_12px_rgba(61,90,127,0.8)]'
          : 'text-gray-400 opacity-50 grayscale scale-100'
      } group-hover:text-[#4d6a8f] group-hover:opacity-100 group-hover:scale-125 group-hover:grayscale-0 group-hover:drop-shadow-[0_0_12px_rgba(61,90,127,0.8)]`}
    />
  </a>
);

const RightIconPanel: React.FC = () => {
  const [isHovered, setIsHovered] = useState(false);
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const positionRef = useRef(0);
  const lastTimeRef = useRef<number>(0);
  const speedFactorRef = useRef(1); // 1 = normal speed, 0.2 = slow speed on hover

  // Triple templates for seamless infinite looping
  const triplicatedTemplates = [...STARTER_TEMPLATES, ...STARTER_TEMPLATES, ...STARTER_TEMPLATES];
  const iconWidth = 56; // 32px icon + 24px gap (gap-6)
  const singleSetWidth = STARTER_TEMPLATES.length * iconWidth;

  // Target speeds
  const NORMAL_SPEED = 1;
  const HOVER_SPEED = 0.15; // Slow but not stopped
  const LERP_FACTOR = 0.05; // Smooth interpolation speed

  const updateSpotlight = useCallback(() => {
    if (!containerRef.current || !scrollerRef.current) {
      return;
    }

    const containerWidth = containerRef.current.offsetWidth;
    const scrollerRect = scrollerRef.current.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    // Find the center point of the visible container
    const visibleCenterX = containerRect.left + containerWidth / 2;

    /*
     * Calculate which icon is at the center
     * The scroller's left edge position relative to the visible center
     */
    const offsetFromScrollerStart = visibleCenterX - scrollerRect.left;
    const iconIndex = Math.floor(offsetFromScrollerStart / iconWidth) % STARTER_TEMPLATES.length;
    setSpotlightIndex(Math.max(0, Math.min(iconIndex, STARTER_TEMPLATES.length - 1)));
  }, []);

  const animate = useCallback(
    (timestamp: number) => {
      if (!scrollerRef.current) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      if (!lastTimeRef.current) {
        lastTimeRef.current = timestamp;
      }

      const delta = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      // Smoothly interpolate speed factor towards target
      const targetSpeed = isHovered ? HOVER_SPEED : NORMAL_SPEED;
      speedFactorRef.current += (targetSpeed - speedFactorRef.current) * LERP_FACTOR;

      // Move at ~30px per second, modified by speed factor
      const baseSpeed = 0.03;
      positionRef.current += baseSpeed * delta * speedFactorRef.current;

      /*
       * Seamless reset: when we've scrolled through one complete set,
       * jump back by one set width (invisible because the next set is identical)
       */
      if (positionRef.current >= singleSetWidth) {
        positionRef.current -= singleSetWidth;
      }

      scrollerRef.current.style.transform = `translateX(-${positionRef.current}px)`;
      updateSpotlight();

      animationRef.current = requestAnimationFrame(animate);
    },
    [isHovered, singleSetWidth, updateSpotlight],
  );

  useEffect(() => {
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animate]);

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center w-full overflow-hidden"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Left fade gradient */}
      <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-[#0b0d13] via-[#0b0d13]/80 to-transparent z-[1] pointer-events-none" />

      <div ref={scrollerRef} className="flex items-center gap-6 py-3" style={{ willChange: 'transform' }}>
        {triplicatedTemplates.map((template, index) => (
          <FrameworkIcon
            key={`${template.name}-${index}`}
            template={template}
            isSpotlight={index % STARTER_TEMPLATES.length === spotlightIndex}
          />
        ))}
      </div>

      {/* Right fade gradient */}
      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[#0b0d13] via-[#0b0d13]/80 to-transparent z-[1] pointer-events-none" />
    </div>
  );
};

export default RightIconPanel;
