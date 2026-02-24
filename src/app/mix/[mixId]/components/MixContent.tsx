'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import usePlayerStore from '@/stores/usePlayerStore';
import { useUser } from '@supabase/auth-helpers-react';
import { BsPlayFill, BsPauseFill, BsClock } from 'react-icons/bs';
import LikeButton from '@/components/LikeButton';
import AddToQueueButton from '@/components/AddToQueueButton';
import PlayingAnimation from '@/components/PlayingAnimation';
import { motion, Variants, AnimatePresence } from 'framer-motion';
import SongContextMenu from '@/components/SongContextMenu'; // 🟢 Import

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

interface MixContentProps {
  songs: any[];
  playlistId: string;
  playlistTitle: string;
  playlistCreatedAt: string; // 🟢 ADD THIS
}

const MixContent: React.FC<MixContentProps> = ({ songs, playlistId, playlistTitle, playlistCreatedAt }) => {
  const router = useRouter();
  const player = usePlayerStore();
  const user = useUser();

  const onPlay = (id: string) => {
    const context = { type: 'playlist' as const, title: playlistTitle, id: playlistId };

    const isCurrentContextActive = 
      player.activeContext?.type === 'playlist' && 
      player.activeContext?.id === playlistId;

    if (isCurrentContextActive) {
      if (player.activeId === id && !player.isPlayingPriority) {
          player.setIsPlaying(!player.isPlaying);
          return;
      }
      player.playFromContext(id, context);
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
            <p>This mix is empty.</p>
        </div>
    );
  }

  return (
    <div className="flex flex-col gap-y-2 w-full">
      
      {/* HEADER ROW */}
      <div className="
        grid 
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

      <motion.ol className="flex flex-col gap-y-1 w-full">
        <AnimatePresence mode='popLayout'>
          {songs.map((song, index) => {
            const isActive = 
              player.activeId === song.id && 
              !player.isPlayingPriority && 
              player.activeContext?.type === 'playlist' && 
              player.activeContext?.id === playlistId;
              
            const isPlaying = player.isPlaying;

            return (
               // 🟢 WRAPPED with Context Menu (Read Only)
               <SongContextMenu 
                  key={song.id} 
                  songId={song.id} 
                  playlistId={playlistId}
                  isReadOnly={true} // 🟢 Hides 'Remove' option
                  artistId={song.albums?.artists?.id} // Navigation
                  albumId={song.album_id} // Navigation
               >
                  <motion.li
                    layout
                    custom={index}
                    variants={rowVariants}
                    initial="hidden"
                    animate="show"
                    exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                    whileTap={{ scale: 0.996 }}
                    onClick={() => onPlay(song.id)}
                    className={`
                      group
                      grid
                      grid-cols-[40px_50px_4fr_3fr_2fr_80px_50px]
                      items-center
                      px-3
                      py-2
                      rounded-md
                      cursor-pointer
                      transition-colors
                      ${isActive ? 'bg-neutral-800/50' : 'hover:bg-neutral-800/50'}
                    `}
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
                            fill
                            src={song.imageUrl}
                            alt={song.title}
                            className="object-cover"
                        />
                    </div>

                    {/* TITLE */}
                    <div className="min-w-0 pr-4">
                      <p className={`truncate font-medium ${isActive ? 'text-green-500' : 'text-white'}`}>{song.title}</p>
                      <p className="text-sm text-neutral-400 truncate">{song.author}</p>
                    </div>

                    {/* ALBUM */}
                    <p 
                      onClick={(e) => {
                          e.stopPropagation();
                          if (song.album_id) router.push(`/album/${song.album_id}`);
                      }}
                      className="text-sm text-neutral-400 truncate pr-4 hover:text-white hover:underline cursor-pointer transition"
                    >
                      {song.album_title}
                    </p>

                    {/* DATE ADDED */}
                    <p className="text-sm text-neutral-400">
                        {formatAddedDate(song.added_at || playlistCreatedAt)}
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
                  </motion.li>
               </SongContextMenu>
            );
          })}
        </AnimatePresence>
      </motion.ol>
    </div>
  );
};

export default MixContent;