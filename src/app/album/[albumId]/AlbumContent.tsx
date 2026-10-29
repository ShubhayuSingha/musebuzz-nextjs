'use client';

import React, { useState, useMemo } from 'react';
import usePlayerStore from '@/stores/usePlayerStore';
import { useUser, useSupabaseClient } from '@supabase/auth-helpers-react';
import { BsPlayFill, BsPauseFill, BsClock, BsThreeDotsVertical } from 'react-icons/bs';
import LikeButton from '@/components/LikeButton';
import AddToQueueButton from '@/components/AddToQueueButton';
import PlayingAnimation from '@/components/PlayingAnimation';
import { motion, Variants, PanInfo } from 'framer-motion';
import { toast } from 'react-hot-toast';

import SongContextMenu from '@/components/SongContextMenu';
import useOfflineModeStore from '@/stores/useOfflineModeStore';
import useAuthModalStore from '@/stores/useAuthModalStore';
import ViewSearchBar from '@/components/ViewSearchBar';
import useFuzzyFilter from '@/hooks/useFuzzyFilter';
import DownloadedBadge from '@/components/DownloadedBadge';

// 🟢 FIX: Added local helper function
const formatTime = (seconds: number) => {
  if (!seconds) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
};

interface AlbumContentProps {
  songs: any[];
  albumName: string;
  albumId: string;
  artistId?: string;
}

const listVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.15 } },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 220, damping: 22, mass: 0.7 } },
};

const SEARCH_KEYS = [
  { name: 'title', weight: 0.7 },
  { name: 'author', weight: 0.3 },
  { name: 'artists.name', weight: 0.3 },
];

const AlbumContent: React.FC<AlbumContentProps> = ({ songs, albumName, albumId, artistId }) => {
  const player = usePlayerStore();
  const user = useUser();
  const supabase = useSupabaseClient();
  const authModal = useAuthModalStore();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSongs = useFuzzyFilter(songs, searchQuery, SEARCH_KEYS);

  const onPlay = async (id: string) => {
    if (!user) {
      return authModal.onOpen('sign_in');
    }
    const context = { type: 'album' as const, title: albumName, id: albumId };

    const isCurrentContextActive =
      player.activeContext?.type === 'album' &&
      player.activeContext?.id === albumId;

    if (isCurrentContextActive) {
      if (player.activeId === id && !player.isPlayingPriority) {
        player.setIsPlaying(!player.isPlaying);
        return;
      }
      player.playFromContext(id, context, songs.map((song) => song.id));
    } else {
      player.setIds(
        songs.map((song) => song.id),
        context,
        user?.id
      );
      player.setId(id, context);
    }

    const isDeviceOnline = typeof navigator !== 'undefined' && navigator.onLine && !useOfflineModeStore.getState().isOfflineMode && useOfflineModeStore.getState().isOnline;

    if (user && isDeviceOnline) {
      try {
        await supabase
          .from('saved_albums')
          .update({ last_accessed_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .eq('album_id', albumId);
      } catch {
        // Silently ignore offline error
      }
    }
  };

  if (songs.length === 0) {
    return <div className="mt-4 text-neutral-400">No songs in this album.</div>;
  }

  return (
    <div className="flex flex-col gap-y-2 w-full">
      {/* Search & Filter Bar */}
      <div className="flex items-center justify-between px-1 mb-2">
        <ViewSearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={`Search in ${albumName}...`}
        />
        {searchQuery && (
          <span className="text-xs text-neutral-400">
            {filteredSongs.length} of {songs.length} song{songs.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {/* Sticky Header Row */}
      <div className="
        hidden md:grid 
        grid-cols-[40px_1fr_80px_60px] 
        items-center 
        px-3 
        py-2 
        border-b 
        border-neutral-700/50
        text-neutral-400 
        text-sm 
        font-medium
        sticky
        top-0
        bg-neutral-900/95 
        backdrop-blur-sm
        z-10
      ">
        <div className="flex justify-center">#</div>
        <div>Title</div>
        <div>{/* Actions Space */}</div>
        <div className="flex justify-end pr-2">
          <BsClock size={16} />
        </div>
      </div>

      {filteredSongs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-neutral-400">
          <p className="text-sm">No songs found matching &ldquo;{searchQuery}&rdquo;</p>
          <button
            onClick={() => setSearchQuery('')}
            className="mt-2 text-xs text-purple-400 hover:underline"
          >
            Clear filter
          </button>
        </div>
      ) : (
        <motion.ol
          variants={listVariants}
          initial="hidden"
          animate="show"
          className="flex flex-col gap-y-1"
        >
          {filteredSongs.map((song, index) => {
            const isActive =
              player.activeId === song.id &&
              !player.isPlayingPriority &&
              player.activeContext?.type === 'album' &&
              player.activeContext?.id === albumId;

            const isPlaying = player.isPlaying;

            return (
              <SongContextMenu
                key={song.id}
                songId={song.id}
                artistId={artistId}
                isReadOnly={true}
              >
                <motion.li
                  variants={rowVariants}
                  whileTap={{ scale: 0.996 }}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.1}
                  onDragEnd={(e, info) => {
                    if (info.offset.x > 80) {
                      player.addToQueue(song.id);
                      toast.success('Added to queue');
                    }
                  }}
                  className={`
                    group relative isolate rounded-md cursor-pointer transition-colors
                    ${isActive ? 'bg-neutral-800/50' : 'hover:bg-neutral-800/50'}
                  `}
                >
                  {/* === DESKTOP LAYOUT === */}
                  <div
                    onClick={() => onPlay(song.id)}
                    className="hidden md:grid grid-cols-[40px_1fr_80px_60px] items-center px-3 py-2 w-full"
                  >
                    {/* INDEX / PLAY */}
                    <div className="flex justify-center">
                      {isActive && isPlaying ? (
                        <>
                          <div className="group-hover:hidden"><PlayingAnimation /></div>
                          <BsPauseFill size={22} className="hidden group-hover:block text-white" />
                        </>
                      ) : (
                        <>
                          <span className={`group-hover:hidden ${isActive ? 'text-green-500' : 'text-neutral-400'}`}>
                            {index + 1}
                          </span>
                          <BsPlayFill size={22} className="hidden group-hover:block text-white" />
                        </>
                      )}
                    </div>

                    {/* TITLE */}
                    <div className="min-w-0 pr-4">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p title={song.title} className={`truncate font-medium ${isActive ? 'text-green-500' : 'text-white'}`}>{song.title}</p>
                        <DownloadedBadge songId={song.id} />
                      </div>
                      <p title={song.author} className="text-sm text-neutral-400 truncate">{song.author}</p>
                    </div>

                    {/* ACTIONS */}
                    <div className="flex justify-center items-center gap-x-3">
                      <AddToQueueButton songId={song.id} />
                      <LikeButton songId={song.id} />
                    </div>

                    {/* DURATION */}
                    <span className="text-sm text-neutral-400 text-right font-medium">{formatTime(song.duration_seconds)}</span>
                  </div>

                  {/* === MOBILE LAYOUT === */}
                  <div
                    className="flex md:hidden items-center justify-between px-3 py-2 w-full gap-x-3"
                  >
                    <div className="flex items-center min-w-0 flex-1 gap-x-3" onClick={() => onPlay(song.id)}>
                      {isActive && isPlaying && (
                        <div className="flex-shrink-0"><PlayingAnimation /></div>
                      )}
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p title={song.title} className={`truncate font-medium ${isActive ? 'text-green-500' : 'text-white'}`}>{song.title}</p>
                          <DownloadedBadge songId={song.id} />
                        </div>
                        <p title={song.author} className="text-sm text-neutral-400 truncate">{song.author}</p>
                      </div>
                    </div>
                    <button data-context-trigger="true" className="text-neutral-400 p-2 -mr-2 active:scale-95 transition">
                      <BsThreeDotsVertical size={20} />
                    </button>
                  </div>
                </motion.li>
              </SongContextMenu>
            );
          })}
        </motion.ol>
      )}
    </div>
  );
};

export default AlbumContent;