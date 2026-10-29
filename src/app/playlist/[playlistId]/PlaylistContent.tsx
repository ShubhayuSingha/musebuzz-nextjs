'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image'; 
import usePlayerStore from '@/stores/usePlayerStore';
import { useUser } from '@supabase/auth-helpers-react';
import { BsPlayFill, BsPauseFill, BsClock, BsThreeDotsVertical } from 'react-icons/bs';
import LikeButton from '@/components/LikeButton';
import AddToQueueButton from '@/components/AddToQueueButton';
import PlayingAnimation from '@/components/PlayingAnimation';
import { motion, Variants, AnimatePresence, PanInfo } from 'framer-motion';
import { toast } from 'react-hot-toast';

import SongContextMenu from '@/components/SongContextMenu'; 
import useAuthModalStore from '@/stores/useAuthModalStore'; 
import ViewSearchBar from '@/components/ViewSearchBar'; 
import useFuzzyFilter from '@/hooks/useFuzzyFilter'; 
import DownloadedBadge from '@/components/DownloadedBadge'; 

// Helpers
const formatTime = (seconds: number) => {
  if (!seconds) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
};

const formatAddedDate = (dateStr: string) => {
  if (!dateStr) return 'Unknown';
  const date = new Date(dateStr);
  const now = new Date();

  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffSeconds < 60) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  if (diffHours < 24) return `${diffHours} hr ago`;
  if (diffDays < 14) return `${diffDays} days ago`;
  if (diffWeeks < 8) return `${diffWeeks} weeks ago`;

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, type: 'spring', stiffness: 220, damping: 22 },
  }),
};

interface PlaylistContentProps {
  songs: any[];
  playlistId: string;
  playlistTitle: string;
}

const SEARCH_KEYS = [
  { name: 'title', weight: 0.6 },
  { name: 'author', weight: 0.25 },
  { name: 'albums.artists.name', weight: 0.25 },
  { name: 'album_title', weight: 0.15 },
  { name: 'albums.title', weight: 0.15 },
];

const PlaylistContent: React.FC<PlaylistContentProps> = ({ songs, playlistId, playlistTitle }) => {
  const router = useRouter();
  const player = usePlayerStore();
  const user = useUser();
  const authModal = useAuthModalStore();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSongs = useFuzzyFilter(songs, searchQuery, SEARCH_KEYS);

  const onPlay = (id: string) => {
    if (!user) {
      return authModal.onOpen('sign_in');
    }
    const context = { type: 'playlist' as const, title: playlistTitle, id: playlistId };

    const isCurrentContextActive = 
      player.activeContext?.type === 'playlist' && 
      player.activeContext?.id === playlistId;

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
  };

  if (songs.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center mt-10 text-neutral-400">
            <p>This playlist is empty.</p>
            <p className="text-sm mt-2">Right-click songs in search to add them!</p>
        </div>
    );
  }

  return (
    <div className="flex flex-col gap-y-2 w-full">
      {/* Search & Filter Bar */}
      <div className="flex items-center justify-between px-1 mb-2">
        <ViewSearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={`Search in ${playlistTitle}...`}
        />
        {searchQuery && (
          <span className="text-xs text-neutral-400">
            {filteredSongs.length} of {songs.length} song{songs.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {/* HEADER */}
      <div className="
        hidden md:grid 
        grid-cols-[40px_50px_4fr_3fr_2fr_80px_50px]
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
        <div></div>
        <div>Title</div>
        <div>Album</div>
        <div>Date Added</div>
        <div></div>
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
        <motion.ol className="flex flex-col gap-y-1 w-full">
          <AnimatePresence mode='popLayout'>
            {filteredSongs.map((song, index) => {
            const isActive = 
              player.activeId === song.id && 
              !player.isPlayingPriority && 
              player.activeContext?.type === 'playlist' && 
              player.activeContext?.id === playlistId;
              
            const isPlaying = player.isPlaying;

            return (
              <SongContextMenu 
                  key={song.id} 
                  songId={song.id} 
                  playlistId={playlistId}
                  isReadOnly={false} // 🟢 Allow Removing
                  artistId={song.albums?.artists?.id} // 🟢 Navigation
                  albumId={song.albums?.id} // 🟢 Navigation
              >
                  <motion.li
                    layout
                    custom={index}
                    variants={rowVariants}
                    initial="hidden"
                    animate="show"
                    exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
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
                      className="hidden md:grid grid-cols-[40px_50px_4fr_3fr_2fr_80px_50px] items-center px-3 py-2 w-full"
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

                      {/* IMAGE COLUMN */}
                      <div className="relative h-10 w-10 overflow-hidden rounded-md">
                          <Image
                              unoptimized
                              fill
                              sizes="40px"
                              src={song.imageUrl || '/images/album-placeholder.png'}
                              alt={song.title}
                              className="object-cover"
                              onError={(e) => {
                                e.currentTarget.src = '/images/album-placeholder.png';
                              }}
                          />
                      </div>

                      {/* TITLE */}
                      <div className="min-w-0 pr-4">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p title={song.title} className={`truncate font-medium ${isActive ? 'text-green-500' : 'text-white'}`}>{song.title}</p>
                          <DownloadedBadge songId={song.id} />
                        </div>
                        <p title={song.author} className="text-sm text-neutral-400 truncate">{song.author}</p>
                      </div>

                      {/* ALBUM */}
                      <p 
                        title={song.album_title}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (song.album_id) router.push(`/album/${song.album_id}`);
                        }}
                        className="text-sm text-neutral-400 truncate pr-4 hover:text-white hover:underline cursor-pointer transition"
                      >
                        {song.album_title}
                      </p>

                      {/* DATE ADDED */}
                      <p 
                        title={song.added_at ? new Date(song.added_at).toLocaleString() : undefined}
                        className="text-sm text-neutral-400"
                      >
                          {formatAddedDate(song.added_at)}
                      </p>

                      {/* ACTIONS */}
                      <div className="flex justify-center items-center gap-x-3">
                        <AddToQueueButton songId={song.id} />
                        <LikeButton songId={song.id} />
                      </div>

                      {/* DURATION */}
                      <p className="text-sm text-neutral-400 text-right">
                          {formatTime(song.duration_seconds)}
                      </p>
                    </div>

                    {/* === MOBILE LAYOUT === */}
                    <div 
                      className="flex md:hidden items-center justify-between px-3 py-2 w-full gap-x-3"
                    >
                      <div className="flex items-center gap-x-3 flex-1 min-w-0" onClick={() => onPlay(song.id)}>
                          <div className="flex items-center gap-x-3 flex-shrink-0">
                            {isActive && isPlaying && (
                               <PlayingAnimation />
                            )}
                            <div className="relative h-10 w-10 min-w-[40px] overflow-hidden rounded-md">
                                <Image unoptimized fill sizes="40px" src={song.imageUrl || "/images/album-placeholder.png"} alt={song.title} className="object-cover" onError={(e) => { e.currentTarget.src = "/images/album-placeholder.png"; }} />
                            </div>
                          </div>
                          <div className="flex flex-col min-w-0 flex-1">
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
        </AnimatePresence>
      </motion.ol>
      )}
    </div>
  );
};

export default PlaylistContent;