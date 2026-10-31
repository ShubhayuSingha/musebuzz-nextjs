// src/components/PlayingAnimation.tsx
'use client';

const PlayingAnimation = () => {
  return (
    <div className="flex items-end justify-center gap-[2.5px] h-4 w-4">
      {/* Bar 1 */}
      <span className="w-[2.5px] min-h-[3px] bg-gradient-to-t from-purple-400 to-purple-200 rounded-full animate-soundwave-1 shadow-[0_0_6px_rgba(216,180,254,0.45)]" />
      {/* Bar 2 */}
      <span className="w-[2.5px] min-h-[3px] bg-gradient-to-t from-purple-400 to-purple-200 rounded-full animate-soundwave-2 shadow-[0_0_6px_rgba(216,180,254,0.45)]" />
      {/* Bar 3 */}
      <span className="w-[2.5px] min-h-[3px] bg-gradient-to-t from-purple-400 to-purple-200 rounded-full animate-soundwave-3 shadow-[0_0_6px_rgba(216,180,254,0.45)]" />
    </div>
  );
};

export default PlayingAnimation;
