'use client';

import usePlayerStore from '@/stores/usePlayerStore';
import { formatTime } from '@/lib/helpers';
import { BsPlayFill, BsPauseFill } from 'react-icons/bs';
import LikeButton from '@/components/LikeButton';
import PlayingAnimation from '@/components/PlayingAnimation';
import { motion, Variants } from 'framer-motion';

interface AlbumContentProps {
  songs: any[];
  albumName: string;
}

/* =======================
    FRAMER MOTION VARIANTS
   ======================= */

const listVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.15,
    },
  },
};

const rowVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 24,
    scale: 0.96,
  },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 220,
      damping: 22,
      mass: 0.7,
    },
  },
};

const AlbumContent: React.FC<AlbumContentProps> = ({ songs, albumName }) => {
  const player = usePlayerStore();

  const onPlay = (id: string) => {
    // Check if this specific song in THIS specific album is already active
    const isCurrentContextActive = 
      player.activeId === id && 
      player.activeContext?.type === 'album' && 
      player.activeContext?.title === albumName;

    if (isCurrentContextActive) {
      player.setIsPlaying(!player.isPlaying);
    } else {
      // Pass the context to setId so the store knows where the song started
      player.setId(id, { type: 'album', title: albumName });
      player.setIds(
        songs.map((song) => song.id),
        {
          type: 'album',
          title: albumName,
        }
      );
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
        // Updated isActive logic to include context check
        const isActive = 
          player.activeId === song.id && 
          player.activeContext?.type === 'album' && 
          player.activeContext?.title === albumName;
          
        const isPlaying = player.isPlaying;

        return (
          <motion.li
            key={song.id}
            variants={rowVariants}
            whileTap={{ scale: 0.996 }}
            onClick={() => onPlay(song.id)}
            className={`
              group
              grid
              grid-cols-[40px_1fr_40px_60px]
              items-center
              px-3
              py-2
              rounded-md
              cursor-pointer
              transition-colors
              isolate
              ${
                isActive
                  ? 'bg-neutral-800/50'
                  : 'hover:bg-neutral-800/50'
              }
            `}
          >
            {/* INDEX / PLAY */}
            <div className="flex justify-center">
              {isActive && isPlaying ? (
                <>
                  <div className="group-hover:hidden">
                    <PlayingAnimation />
                  </div>
                  <BsPauseFill
                    size={22}
                    className="hidden group-hover:block text-white"
                  />
                </>
              ) : (
                <>
                  <span
                    className={`
                      group-hover:hidden
                      ${
                        isActive
                          ? 'text-green-500'
                          : 'text-neutral-400'
                      }
                    `}
                  >
                    {index + 1}
                  </span>
                  <BsPlayFill
                    size={22}
                    className="hidden group-hover:block text-white"
                  />
                </>
              )}
            </div>

            {/* TITLE + ARTIST */}
            <div className="min-w-0">
              <p
                className={`
                  truncate
                  font-medium
                  ${isActive ? 'text-green-500' : 'text-white'}
                `}
              >
                {song.title}
              </p>
              <p className="text-sm text-neutral-400 truncate">
                {song.author}
              </p>
            </div>

            {/* LIKE */}
            <div className="flex justify-center">
              <LikeButton songId={song.id} />
            </div>

            {/* DURATION */}
            <span className="text-sm text-neutral-400 text-right font-medium">
              {formatTime(song.duration_seconds)}
            </span>
          </motion.li>
        );
      })}
    </motion.ol>
  );
};

export default AlbumContent;