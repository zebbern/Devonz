import React from 'react';

/**
 * AmbientBackground - Creates a simple spotlight/ambient lighting effect
 * with a soft glow from the top and a few floating particles
 */
export const AmbientBackground: React.FC = () => {
  return (
    <div className="ambient-background">
      {/* Spotlight glow from top */}
      <div className="spotlight-glow" />

      {/* Subtle floating particles */}
      <div className="ambient-particles">
        <div className="particle" />
        <div className="particle" />
        <div className="particle" />
        <div className="particle" />
      </div>
    </div>
  );
};

export default AmbientBackground;
