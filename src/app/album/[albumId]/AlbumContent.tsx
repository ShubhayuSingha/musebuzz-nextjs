'use client';

import React from 'react';
import usePlayerStore from '@/stores/usePlayerStore';
import { useUser, useSupabaseClient } from '@supabase/auth-helpers-react';
import { BsPlayFill, BsPauseFill, BsClock } from 'react-icons/bs'; 
import LikeButton from '@/components/LikeButton';
import AddToQueueButton from '@/components/AddToQueueButton';
import PlayingAnimation from '@/components/PlayingAnimation';
import { motion, Variants } from 'framer-motion';

import SongContextMenu from '@/components/SongContextMenu';

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

const AlbumContent: React.FC<AlbumContentProps> = ({ songs, albumName, albumId, artistId }) => {
  const player = usePlayerStore();
  const user = useUser();
  const supabase = useSupabaseClient();

  const onPlay = async (id: string) => {
    const context = { type: 'album' as const, title: albumName, id: albumId };

    const isCurrentContextActive = 
      player.activeContext?.type === 'album' && 
      player.activeContext?.id === albumId;

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

    if (user) {
       const { error } = await supabase
        .from('saved_albums')
        .update({ last_accessed_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('album_id', albumId);

       if (error) {
         console.error("Failed to update album access time:", error);
       }
    }
  };

  if (songs.length === 0) {
    return <div className="mt-4 text-neutral-400">No songs in this album.</div>;
  }

  return (
    <div className="flex flex-col gap-y-2 w-full">
      
      {/* Sticky Header Row */}
      <div className="
        grid 
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

      <motion.ol
        variants={listVariants}
        initial="hidden"
        animate="show"
        className="flex flex-col gap-y-1"
      >
        {songs.map((song, index) => {
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
                  onClick={() => onPlay(song.id)}
                  className={`
                    group grid grid-cols-[40px_1fr_80px_60px] items-center px-3 py-2 rounded-md cursor-pointer transition-colors isolate
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

                  {/* TITLE */}
                  <div className="min-w-0">
                    <p className={`truncate font-medium ${isActive ? 'text-green-500' : 'text-white'}`}>{song.title}</p>
                    <p className="text-sm text-neutral-400 truncate">{song.author}</p>
                  </div>

                  {/* ACTIONS */}
                  <div className="flex justify-center items-center gap-x-3">
                    <AddToQueueButton songId={song.id} />
                    <LikeButton songId={song.id} />
                  </div>

                  {/* DURATION */}
                  <span className="text-sm text-neutral-400 text-right font-medium">{formatTime(song.duration_seconds)}</span>
                </motion.li>
            </SongContextMenu>
          );
        })}
      </motion.ol>
    </div>
  );
};

export default AlbumContent;