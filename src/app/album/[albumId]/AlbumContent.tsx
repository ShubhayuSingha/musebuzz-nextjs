// src/app/album/[albumId]/AlbumContent.tsx

'use client';

import usePlayerStore from '@/stores/usePlayerStore';
import { useUser } from '@supabase/auth-helpers-react';
import { formatTime } from '@/lib/helpers';
import { BsPlayFill, BsPauseFill } from 'react-icons/bs';
import LikeButton from '@/components/LikeButton';
import AddToQueueButton from '@/components/AddToQueueButton';
import PlayingAnimation from '@/components/PlayingAnimation';
import { motion, Variants } from 'framer-motion';

interface AlbumContentProps {
  songs: any[];
  albumName: string;
  albumId: string;
}

const listVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.15 } },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 220, damping: 22, mass: 0.7 } },
};

const AlbumContent: React.FC<AlbumContentProps> = ({ songs, albumName, albumId }) => {
  const player = usePlayerStore();
  const user = useUser();

  const onPlay = (id: string) => {
    // 1. Identify the Context
    const context = { type: 'album' as const, title: albumName, id: albumId };

    const isCurrentContextActive = 
      player.activeContext?.type === 'album' && 
      player.activeContext?.id === albumId;

    if (isCurrentContextActive) {
      // 🟢 Logic: If already playing this album, use the smart logic
      if (player.activeId === id && !player.isPlayingPriority) {
          player.setIsPlaying(!player.isPlaying);
          return;
      }
      
      // 🟢 CALL NEW ACTION: Plucks song and inserts it (if shuffle ON)
      player.playFromContext(id, context);

    } else {
      // 🟢 New Context: Load and Hydrate
      player.setIds(
        songs.map((song) => song.id),
        context,
        user?.id 
      );
      // Play specific song
      player.setId(id, context);
    }
  };

  if (songs.length === 0) {
    return <div className="mt-4 text-neutral-400">No songs in this album.</div>;
  }

  return (
    <motion.ol
      variants={listVariants}
      initial="hidden"
      animate="show"
      className="mt-4 flex flex-col gap-y-1"
    >
      {songs.map((song, index) => {
        // Only highlight if actively playing from THIS context (not priority)
        const isActive = 
          player.activeId === song.id && 
          !player.isPlayingPriority && 
          player.activeContext?.type === 'album' && 
          player.activeContext?.id === albumId;
          
        const isPlaying = player.isPlaying;

        return (
          <motion.li
            key={song.id}
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
        );
      })}
    </motion.ol>
  );
};

export default AlbumContent;