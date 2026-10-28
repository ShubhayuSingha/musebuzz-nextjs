// src/components/OfflineBanner.tsx
'use client';

import React, { useState, useEffect } from 'react';
import useOfflineModeStore from '@/stores/useOfflineModeStore';
import { HiSignalSlash, HiCheckCircle, HiXMark } from 'react-icons/hi2';
import { RiWifiOffLine } from 'react-icons/ri';

const OfflineBanner: React.FC = () => {
  const { isOnline, isOfflineMode, setOfflineMode } = useOfflineModeStore();
  const [isDismissed, setIsDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Avoid hydration mismatch by waiting until client mount
  if (!mounted) {
    return null;
  }

  // If online and not in offline mode, show nothing
  if (isOnline && !isOfflineMode) {
    return null;
  }

  // If user explicitly dismissed for this session and we're not toggling
  if (isDismissed) {
    return (
      <div className="w-full bg-amber-950/40 border-b border-amber-500/20 px-4 py-1 text-xs text-amber-300 flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-medium">
          <HiSignalSlash className="w-3.5 h-3.5 text-amber-400" />
          {isOfflineMode ? 'Offline Mode Active' : 'Offline'}
        </span>
        <button
          onClick={() => setIsDismissed(false)}
          className="underline hover:text-white transition"
        >
          Show Banner
        </button>
      </div>
    );
  }

  return (
    <div
      className={`
        w-full transition-all duration-300 py-2.5 px-4 sm:px-6 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm font-medium border-b
        ${
          isOfflineMode
            ? 'bg-gradient-to-r from-purple-950/90 via-violet-900/80 to-purple-950/90 border-purple-500/30 text-purple-200'
            : 'bg-gradient-to-r from-amber-950/90 via-yellow-950/80 to-amber-950/90 border-amber-500/30 text-amber-200'
        }
      `}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={`
            p-1.5 rounded-full flex-shrink-0
            ${isOfflineMode ? 'bg-purple-800/60 text-purple-300' : 'bg-amber-800/60 text-amber-300'}
          `}
        >
          {isOfflineMode ? (
            <HiCheckCircle className="w-4 h-4" />
          ) : (
            <RiWifiOffLine className="w-4 h-4" />
          )}
        </div>
        <div className="truncate">
          {isOfflineMode ? (
            <span>
              <strong className="text-white font-semibold">Offline Mode:</strong> Listening to downloaded content without internet
            </span>
          ) : (
            <span>
              <strong className="text-white font-semibold">You are offline:</strong> Changes will not sync to the cloud
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {!isOfflineMode ? (
          <button
            onClick={() => setOfflineMode(true)}
            className="
              px-3 py-1 rounded-full text-xs font-semibold
              bg-amber-500 hover:bg-amber-400 text-black
              transition-transform active:scale-95 shadow-sm
            "
          >
            Switch to Offline Mode
          </button>
        ) : (
          <button
            onClick={() => setOfflineMode(false)}
            disabled={!isOnline}
            title={!isOnline ? 'Cannot exit offline mode while disconnected' : 'Return to online cloud mode'}
            className={`
              px-3 py-1 rounded-full text-xs font-semibold transition-transform active:scale-95
              ${
                isOnline
                  ? 'bg-purple-400 hover:bg-purple-300 text-black cursor-pointer'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
              }
            `}
          >
            {isOnline ? 'Exit Offline Mode' : 'Offline Mode Active'}
          </button>
        )}

        <button
          onClick={() => setIsDismissed(true)}
          className="p-1 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition"
          title="Dismiss banner"
        >
          <HiXMark className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default OfflineBanner;
