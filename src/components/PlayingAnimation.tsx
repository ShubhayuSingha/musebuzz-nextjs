// src/components/PlayingAnimation.tsx
'use client';

const PlayingAnimation = () => {
  return (
    /* Container: aligns items to the bottom, small gap */
    <div className="flex items-end gap-[1px] h-4 w-5 justify-center">
      {/* Bar 1: Standard bounce speed, full height */}
      <span className="w-[3px] bg-green-500 rounded-sm animate-[bounce_1s_infinite] h-[80%]" />
      
      {/* Bar 2: Slower bounce, starts at 60% height */}
      <span className="w-[3px] bg-green-500 rounded-sm animate-[bounce_1.2s_infinite] h-[60%]" />
      
      {/* Bar 3: Faster bounce, starts at 80% height */}
      <span className="w-[3px] bg-green-500 rounded-sm animate-[bounce_0.8s_infinite] h-[80%]" />
    </div>
  );
};

export default PlayingAnimation;