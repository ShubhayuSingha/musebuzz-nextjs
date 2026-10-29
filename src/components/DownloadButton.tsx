// src/components/DownloadButton.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { toast } from 'react-hot-toast';
import { 
  HiArrowDownTray, 
  HiCheck, 
  HiArrowPath, 
  HiTrash,
  HiEllipsisVertical
} from 'react-icons/hi2';

import useDownloadStore from '@/stores/useDownloadStore';
import useOfflineModeStore from '@/stores/useOfflineModeStore';
import { 
  downloadAlbum, 
  downloadPlaylist, 
  deleteAlbumDownload, 
  deletePlaylistDownload 
} from '@/lib/downloadService';

interface DownloadButtonProps {
  id: string;
  type: 'album' | 'playlist';
  title?: string;
  disabled?: boolean;
  disabledTooltip?: string;
}

const DownloadButton: React.FC<DownloadButtonProps> = ({ 
  id, 
  type, 
  title = '',
  disabled = false,
  disabledTooltip
}) => {
  const supabase = useSupabaseClient();
  const { downloading, downloadedIds, refreshDownloadedStatus } = useDownloadStore();
  const { isOnline, isOfflineMode } = useOfflineModeStore();

  const [menuOpen, setMenuOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDownloaded = mounted && downloadedIds.has(id);
  const isOffline = mounted && (!isOnline || isOfflineMode);
  const activeProgress = mounted ? downloading[id] : undefined;
  const isDownloading = !!activeProgress && ['fetching', 'downloading', 'syncing'].includes(activeProgress.status);

  // Close popup menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleStartDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (disabled) {
      toast.error(disabledTooltip || 'Please add to library before downloading');
      return;
    }

    if (!isOnline || isOfflineMode) {
      toast.error('Downloading requires an active internet connection');
      return;
    }

    if (isDownloading) return;

    try {
      if (type === 'album') {
        const ok = await downloadAlbum(supabase, id);
        if (ok) toast.success(`"${title || 'Album'}" downloaded!`);
        else toast.error('Failed to download album');
      } else {
        const ok = await downloadPlaylist(supabase, id);
        if (ok) toast.success(`"${title || 'Playlist'}" downloaded!`);
        else toast.error('Failed to download playlist');
      }
      refreshDownloadedStatus();
    } catch (err: any) {
      toast.error(err?.message || 'Download failed');
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    setIsDeleting(true);

    try {
      if (type === 'album') {
        await deleteAlbumDownload(id, supabase);
      } else {
        await deletePlaylistDownload(id, supabase);
      }
      toast.success('Download removed from local storage');
      refreshDownloadedStatus();
    } catch (err: any) {
      toast.error('Failed to remove download');
    } finally {
      setIsDeleting(false);
    }
  };

  // State 1: Active downloading
  if (isDownloading) {
    const percent = Math.round(activeProgress?.percent || 0);
    const current = activeProgress?.current || 0;
    const total = activeProgress?.total || 0;

    return (
      <div 
        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 text-xs font-semibold animate-pulse"
        title={`Downloading ${current} of ${total} (${percent}%)`}
      >
        <HiArrowPath className="w-4 h-4 animate-spin text-emerald-400" />
        <span>
          {activeProgress.status === 'fetching' ? 'Preparing...' : `${current}/${total} (${percent}%)`}
        </span>
      </div>
    );
  }

  // State 2: Already Downloaded
  if (isDownloaded) {
    return (
      <div ref={menuRef} className="relative inline-block">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(!menuOpen);
          }}
          disabled={isDeleting}
          className="
            inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
            bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50
            text-emerald-300 text-xs font-semibold transition active:scale-95
          "
          title="Downloaded for offline listening • Click for options"
        >
          <HiCheck className="w-4 h-4 text-emerald-400" />
          <span>Downloaded</span>
          <HiEllipsisVertical className="w-3.5 h-3.5 text-emerald-400/80 ml-0.5" />
        </button>

        {menuOpen && (
          <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-48 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={handleDelete}
              className="w-full text-left px-3 py-2 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 flex items-center gap-2 transition cursor-pointer"
            >
              <HiTrash className="w-4 h-4 text-red-400" />
              Remove Download
            </button>
          </div>
        )}
      </div>
    );
  }

  // State 3: Not downloaded
  const isButtonDisabled = isOffline || disabled;
  const buttonTooltip = disabled
    ? (disabledTooltip || 'Add to library before downloading')
    : isOffline
      ? 'Download unavailable offline'
      : `Download ${type === 'album' ? 'Album' : 'Playlist'} for offline listening`;

  return (
    <button
      onClick={handleStartDownload}
      disabled={isButtonDisabled}
      className={`
        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition active:scale-95 text-xs font-semibold
        ${
          isButtonDisabled
            ? 'bg-zinc-800/40 border-zinc-700/40 text-zinc-500 cursor-not-allowed opacity-60'
            : 'bg-zinc-800/80 hover:bg-zinc-700 border-zinc-600/80 text-zinc-200 hover:text-white cursor-pointer hover:border-zinc-500 shadow-sm'
        }
      `}
      title={buttonTooltip}
    >
      <HiArrowDownTray className={`w-4 h-4 ${isButtonDisabled ? 'text-zinc-500' : 'text-zinc-400 group-hover:text-white'}`} />
      <span>Download</span>
    </button>
  );
};

export default DownloadButton;
