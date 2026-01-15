// src/app/album/[albumId]/AlbumContent.tsx
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
    if (player.activeId === id) {
      player.setIsPlaying(!player.isPlaying);
    } else {
      player.setId(id);
      player.setIds(songs.map((song) => song.id), {
        type: 'album',
        title: albumName,
      });
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
      className="mt-4 flex flex-col gap-y-2"
    >
      {songs.map((song, index) => {
        const isActive = player.activeId === song.id;
        const isPlaying = player.isPlaying;

        return (
          <motion.li
            key={song.id}
            variants={rowVariants}
            whileTap={{ scale: 0.996 }}
            className={`
              group
              flex
              items-center
              justify-between
              p-3
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
            onClick={() => onPlay(song.id)}
          >
            {/* LEFT SIDE */}
            <div className="flex items-center gap-x-4 min-w-0">
              <div className="flex items-center justify-center w-6 h-6 relative">
                {isActive && isPlaying ? (
                  <>
                    <div className="group-hover:hidden">
                      <PlayingAnimation />
                    </div>
                    <BsPauseFill
                      size={25}
                      className="text-white hidden group-hover:block"
                    />
                  </>
                ) : (
                  <>
                    <span
                      className={`
                        font-medium
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
                      size={25}
                      className="text-white hidden group-hover:block"
                    />
                  </>
                )}
              </div>

              {/* TITLE + AUTHOR */}
              <div className="flex flex-col min-w-0">
                <p
                  className={`
                    truncate
                    font-medium
                    ${
                      isActive ? 'text-green-500' : 'text-white'
                    }
                  `}
                >
                  {song.title}
                </p>
                <p className="text-neutral-400 text-sm truncate">
                  {song.author}
                </p>
              </div>
            </div>

            {/* RIGHT SIDE */}
            <div className="flex items-center gap-x-4">
              <LikeButton songId={song.id} />
              <span className="text-neutral-400 text-sm font-medium">
                {formatTime(song.duration_seconds)}
              </span>
            </div>
          </motion.li>
        );
      })}
    </motion.ol>
  );
};

export default AlbumContent;
