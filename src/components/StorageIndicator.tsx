// src/components/StorageIndicator.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { HiCircleStack, HiTrash } from 'react-icons/hi2';
import { getOfflineStorageEstimate, clearAllOfflineStorage, StorageEstimate } from '@/lib/offlineAudioStorage';
import useDownloadStore from '@/stores/useDownloadStore';

interface StorageIndicatorProps {
  compact?: boolean;
  variant?: 'navbar' | 'sidebar' | 'compact';
}

const StorageIndicator: React.FC<StorageIndicatorProps> = ({ 
  compact = false, 
  variant = 'sidebar' 
}) => {
  const [estimate, setEstimate] = useState<StorageEstimate | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const { refreshDownloadedStatus, downloadedIds } = useDownloadStore();

  const loadEstimate = async () => {
    try {
      const data = await getOfflineStorageEstimate();
      setEstimate(data);
    } catch (err) {
      console.warn('[StorageIndicator] Failed to get estimate:', err);
    }
  };

  useEffect(() => {
    loadEstimate();
  }, [downloadedIds]);

  const handleClear = async () => {
    setIsClearing(true);
    try {
      await clearAllOfflineStorage();
      await refreshDownloadedStatus();
      await loadEstimate();
      setShowConfirm(false);
      toast.success('All downloaded offline storage cleared');
    } catch (err) {
      toast.error('Failed to clear storage');
    } finally {
      setIsClearing(false);
    }
  };

  const renderConfirmModal = () => (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-2xl max-w-sm w-full animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3 mb-3 text-red-400">
          <div className="p-2.5 rounded-full bg-red-500/10 border border-red-500/20">
            <HiTrash size={22} />
          </div>
          <h3 className="text-lg font-bold text-white">Clear Offline Storage?</h3>
        </div>
        
        <p className="text-zinc-400 text-xs sm:text-sm mb-6 leading-relaxed">
          {estimate && estimate.usageBytes > 0 ? (
            <>
              This will remove all <strong className="text-white">{estimate.formattedUsage}</strong> of downloaded songs, albums, and playlists from your device. You will need an internet connection to re-download them.
            </>
          ) : (
            <>Offline storage is currently empty. When you download music for offline playback, it will appear here.</>
          )}
        </p>

        <div className="flex items-center justify-end gap-3">
          <button
            disabled={isClearing}
            onClick={() => setShowConfirm(false)}
            className="px-4 py-2 text-xs font-medium text-zinc-300 hover:text-white transition"
          >
            {estimate && estimate.usageBytes > 0 ? 'Cancel' : 'Close'}
          </button>
          {estimate && estimate.usageBytes > 0 && (
            <button
              disabled={isClearing}
              onClick={handleClear}
              className="px-4 py-2 rounded-full text-xs font-semibold bg-red-500 hover:bg-red-400 text-white transition active:scale-95 disabled:opacity-50"
            >
              {isClearing ? 'Clearing...' : 'Clear All'}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (variant === 'navbar') {
    return (
      <>
        {showConfirm && renderConfirmModal()}
        <button
          onClick={() => setShowConfirm(true)}
          type="button"
          className="
            flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold
            bg-neutral-800/80 hover:bg-neutral-800 border border-neutral-700/80 text-neutral-300 hover:text-white
            transition active:scale-95 select-none whitespace-nowrap cursor-pointer
          "
          title={`Offline Storage: ${estimate?.formattedUsage || '0 B'} used • Click to view or clear storage`}
        >
          <HiCircleStack className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          <span className="hidden md:inline text-neutral-300 font-normal">Storage</span>
          <span className="font-mono text-[11px] text-emerald-400 font-medium">
            {estimate?.formattedUsage || '0 B'}
          </span>
        </button>
      </>
    );
  }

  if (!estimate) return null;

  if (compact || variant === 'compact') {
    return (
      <>
        {showConfirm && renderConfirmModal()}
        <div 
          className="flex items-center justify-center p-2 text-zinc-400 hover:text-white transition cursor-pointer"
          title={`Offline Storage: ${estimate.formattedUsage}`}
          onClick={() => setShowConfirm(true)}
        >
          <HiCircleStack size={20} />
        </div>
      </>
    );
  }

  return (
    <>
      {showConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-2xl max-w-sm w-full animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-3 text-red-400">
              <div className="p-2.5 rounded-full bg-red-500/10 border border-red-500/20">
                <HiTrash size={22} />
              </div>
              <h3 className="text-lg font-bold text-white">Clear Offline Storage?</h3>
            </div>
            
            <p className="text-zinc-400 text-xs sm:text-sm mb-6 leading-relaxed">
              This will remove all <strong className="text-white">{estimate.formattedUsage}</strong> of downloaded songs, albums, and playlists from your device. You will need an internet connection to re-download them.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                disabled={isClearing}
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-xs font-medium text-zinc-300 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                disabled={isClearing}
                onClick={handleClear}
                className="px-4 py-2 rounded-full text-xs font-semibold bg-red-500 hover:bg-red-400 text-white transition active:scale-95 disabled:opacity-50"
              >
                {isClearing ? 'Clearing...' : 'Clear All'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-4 my-2 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-xs flex flex-col gap-2">
        <div className="flex items-center justify-between text-zinc-300">
          <span className="flex items-center gap-1.5 font-medium">
            <HiCircleStack className="w-4 h-4 text-emerald-400" />
            Offline Storage
          </span>
          <span className="text-zinc-400 font-mono text-[11px]">
            {estimate.formattedUsage}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
          <div 
            className="bg-emerald-500 h-full rounded-full transition-all duration-300"
            style={{ width: `${Math.min(Math.max(estimate.percentUsed, estimate.usageBytes > 0 ? 3 : 0), 100)}%` }}
          />
        </div>

        {estimate.usageBytes > 0 && (
          <button
            onClick={() => setShowConfirm(true)}
            className="self-end text-[11px] text-zinc-400 hover:text-red-400 transition flex items-center gap-1 mt-1 cursor-pointer"
          >
            <HiTrash className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>
    </>
  );
};

export default StorageIndicator;
