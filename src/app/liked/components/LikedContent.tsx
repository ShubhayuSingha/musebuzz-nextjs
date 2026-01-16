'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useUser } from '@supabase/auth-helpers-react';
import usePlayerStore from '@/stores/usePlayerStore';
import { BsPlayFill, BsPauseFill } from 'react-icons/bs';
import LikeButton from '@/components/LikeButton';
import PlayingAnimation from '@/components/PlayingAnimation';
import { motion, Variants, AnimatePresence } from 'framer-motion'; // Added AnimatePresence

/* =======================
    HELPERS
   ======================= */

const formatTime = (seconds: number) => {
  if (!seconds) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
};

const formatAddedDate = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();

  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffSeconds < 10) {
    return 'just now';
  }

  if (diffSeconds < 60) {
    return `${diffSeconds} second${diffSeconds !== 1 ? 's' : ''} ago`;
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
  }

  if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  }

  if (diffDays < 14) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  }

  if (diffWeeks < 8) {
    return `${diffWeeks} week${diffWeeks !== 1 ? 's' : ''} ago`;
  }

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

/* =======================
    FRAMER VARIANTS
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
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 220,
      damping: 22,
    },
  },
};

interface LikedContentProps {
  songs: any[];
}

const LikedContent: React.FC<LikedContentProps> = ({ songs }) => {
  const router = useRouter();
  const user = useUser();
  const player = usePlayerStore();

  useEffect(() => {
    if (!user) router.replace('/');
  }, [user, router]);

  const onPlay = (id: string) => {
    // Check if song is active specifically in the Liked Songs context
    const isCurrentContextActive = 
      player.activeId === id && 
      player.activeContext?.type === 'playlist' && 
      player.activeContext?.title === 'Liked Songs';

    if (isCurrentContextActive) {
      player.setIsPlaying(!player.isPlaying);
    } else {
      // Pass the context to setId
      player.setId(id, { type: 'playlist', title: 'Liked Songs' });
      player.setIds(
        songs.map((song) => song.id),
        { type: 'playlist', title: 'Liked Songs' }
      );
    }
  };

  return (
    <motion.ol
      variants={listVariants}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-y-1 w-full"
    >
      <AnimatePresence initial={false}>
        {songs.map((song, index) => {
          // Highlight green ONLY if playing from this context
          const isActive = 
            player.activeId === song.id && 
            player.activeContext?.type === 'playlist' && 
            player.activeContext?.title === 'Liked Songs';

          const isPlaying = player.isPlaying;

          return (
            <motion.li
              key={song.id}
              layout // Handles the smooth re-ordering when new songs enter
              variants={rowVariants}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, x: -20 }} // Smooth slide-out when unliked
              whileTap={{ scale: 0.996 }}
              onClick={() => onPlay(song.id)}
              className={`
                group
                grid
                grid-cols-[40px_4fr_3fr_2fr_40px_50px]
                items-center
                px-3
                py-2
                rounded-md
                cursor-pointer
                transition-colors
                ${isActive ? 'bg-neutral-800/50' : 'hover:bg-purple-950/50'}
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
                    <span className={`group-hover:hidden ${isActive ? 'text-green-500' : 'text-neutral-400'}`}>
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
                <p className={`truncate font-medium ${isActive ? 'text-green-500' : 'text-white'}`}>
                  {song.title}
                </p>
                <p className="text-sm text-neutral-400 truncate">
                  {song.author}
                </p>
              </div>

              {/* ALBUM (MIDDLE COLUMN) */}
              <p className="text-sm text-neutral-400 truncate pr-4">
                {song.album_title}
              </p>

              {/* DATE ADDED */}
              <p className="text-sm text-neutral-400">
                {formatAddedDate(song.liked_created_at)}
              </p>

              {/* LIKE */}
              <div className="flex justify-center">
                <LikeButton songId={song.id} />
              </div>

              {/* DURATION */}
              <p className="text-sm text-neutral-400 text-right">
                {formatTime(song.duration_seconds)}
              </p>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </motion.ol>
  );
};

export default LikedContent;