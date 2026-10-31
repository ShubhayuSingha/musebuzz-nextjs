// src/components/MusicLoader.tsx
'use client';

import React from 'react';

interface MusicLoaderProps {
  label?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const MusicLoader: React.FC<MusicLoaderProps> = ({
  label = 'Tuning in...',
  className = '',
  size = 'md',
}) => {
  const heights = {
    sm: 'h-6',
    md: 'h-9',
    lg: 'h-12',
  }[size];

  const barWidth = {
    sm: 'w-1',
    md: 'w-1.5',
    lg: 'w-2',
  }[size];

  return (
    <div className={`flex flex-col items-center justify-center gap-3 select-none ${className}`}>
      {/* 5-Bar Animated Audio Equalizer Waveform */}
      <div className={`flex items-end justify-center gap-1.5 ${heights}`}>
        <span
          className={`${barWidth} rounded-full bg-gradient-to-t from-purple-600 to-indigo-400 animate-equalizer shadow-[0_0_8px_rgba(168,85,247,0.4)]`}
          style={{ animationDelay: '0ms' }}
        />
        <span
          className={`${barWidth} rounded-full bg-gradient-to-t from-purple-600 to-purple-400 animate-equalizer shadow-[0_0_8px_rgba(168,85,247,0.4)]`}
          style={{ animationDelay: '180ms' }}
        />
        <span
          className={`${barWidth} rounded-full bg-gradient-to-t from-purple-600 to-pink-400 animate-equalizer shadow-[0_0_8px_rgba(168,85,247,0.4)]`}
          style={{ animationDelay: '360ms' }}
        />
        <span
          className={`${barWidth} rounded-full bg-gradient-to-t from-purple-600 to-purple-400 animate-equalizer shadow-[0_0_8px_rgba(168,85,247,0.4)]`}
          style={{ animationDelay: '220ms' }}
        />
        <span
          className={`${barWidth} rounded-full bg-gradient-to-t from-purple-600 to-indigo-400 animate-equalizer shadow-[0_0_8px_rgba(168,85,247,0.4)]`}
          style={{ animationDelay: '90ms' }}
        />
      </div>

      {label && (
        <p className="text-xs sm:text-sm font-medium text-neutral-400 font-sans tracking-wide animate-pulse">
          {label}
        </p>
      )}
    </div>
  );
};

export default MusicLoader;

