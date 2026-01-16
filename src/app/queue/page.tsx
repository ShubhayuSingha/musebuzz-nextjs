'use client';

import { useEffect, useState, useMemo, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation"; 
import { BsPlayFill, BsPauseFill } from "react-icons/bs"; 
import PlayingAnimation from "@/components/PlayingAnimation"; 

import usePlayerStore from "@/stores/usePlayerStore";
import { supabase } from "@/lib/supabaseClient";
import { Song } from "@/types"; 
import LikeButton from "@/components/LikeButton";

// 1. Import Framer Motion
import { motion, AnimatePresence, Variants } from "framer-motion";

// 2. Define Animation Variants (Similar to LikedContent)
const rowVariants: Variants = {
  hidden: { 
    opacity: 0, 
    y: 10, 
    scale: 0.98 
  },
  show: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { 
      type: "spring", 
      stiffness: 300, 
      damping: 30,
      mass: 0.8
    } 
  },
  exit: { 
    opacity: 0, 
    scale: 0.95, 
    transition: { duration: 0.2 } 
  }
};

export default function QueuePage() {
  const router = useRouter();

  const { 
    activeId, 
    bucketA, 
    bucketB, 
    shuffledOrder, 
    isShuffled,
    activeContext, 
    setId, 
    isPlaying,
    setIsPlaying,
    lastActiveContextId,
    playQueueItem 
  } = usePlayerStore();

  const [songs, setSongs] = useState<Record<string, Song>>({});
  const [loading, setLoading] = useState(true);

  const [upcomingContextIds, setUpcomingContextIds] = useState<string[]>([]);
  
  const lastKnownIdRef = useRef<string | undefined>(undefined);

  const mainQueueIds = isShuffled ? shuffledOrder : bucketA;

  useEffect(() => {
    const currentIndex = mainQueueIds.findIndex((id) => id === activeId);

    if (currentIndex !== -1) {
      lastKnownIdRef.current = activeId;
      setUpcomingContextIds(mainQueueIds.slice(currentIndex + 1));
    } else {
      if (lastKnownIdRef.current) {
        const lastIndex = mainQueueIds.findIndex(id => id === lastKnownIdRef.current);
        if (lastIndex !== -1) {
           setUpcomingContextIds(mainQueueIds.slice(lastIndex + 1));
           return;
        }
      }
      if (upcomingContextIds.length === 0 && mainQueueIds.length > 0) {
          setUpcomingContextIds(mainQueueIds); 
      }
    }
  }, [activeId, mainQueueIds, lastActiveContextId]);

  const allIds = useMemo(() => {
    const ids = new Set([
      ...bucketA, 
      ...bucketB.map(b => b.id), 
      activeId
    ].filter(Boolean));
    return Array.from(ids) as string[];
  }, [bucketA, bucketB, activeId]);

  useEffect(() => {
    const fetchSongs = async () => {
      if (allIds.length === 0) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('songs')
        .select('*, albums( *, artists(*) )') 
        .in('id', allIds);

      if (!error && data) {
        const songMap: Record<string, Song> = {};
        data.forEach((song: any) => {
          songMap[song.id] = song;
        });
        setSongs(songMap);
      }
      setLoading(false);
    };

    fetchSongs();
  }, [allIds]);

  const getContextLabel = () => {
    if (!activeContext) return isShuffled ? "Next from shuffled playlist:" : "Next from ordered playlist:";
    const { type, title } = activeContext;
    const state = isShuffled ? 'shuffled' : 'ordered';
    return `Next from ${state} ${type}: ${title}`;
  };

  const formatTime = (seconds: number) => {
    if (!seconds) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  const renderRow = (id: string, idx: number, source: string) => {
    const song = songs[id];
    if (!song) return null;

    // @ts-ignore
    const imagePath = song.albums?.image_path;
    const imageUrl = imagePath 
      ? supabase.storage.from('images').getPublicUrl(imagePath).data.publicUrl 
      : '/images/music-placeholder.png';
      
    // @ts-ignore
    const artistName = song.albums?.artists?.name || song.author || "Unknown Artist";
    // @ts-ignore
    const albumName = song.albums?.title || "Unknown Album";
    
    const isActive = activeId === id && source === 'active';
    
    const handlePlay = () => {
      if (isActive) {
        setIsPlaying(!isPlaying);
      } else {
        if (source.startsWith('queue-')) {
           playQueueItem(idx);
        } else {
           setId(id);
        }
      }
    };

    return (
      // 3. Convert div to motion.div
      <motion.div 
        layout="position" // This enables smooth reordering/shuffling
        key={`${source}-${id}-${idx}`} 
        variants={rowVariants}
        initial="hidden"
        animate="show"
        exit="exit"
        className={`
          group 
          grid 
          grid-cols-[40px_50px_4fr_3fr_40px_50px] 
          gap-x-4 
          items-center 
          w-full 
          px-3 
          py-2 
          rounded-md 
          hover:bg-neutral-800/50 
          transition-colors 
          cursor-pointer
          ${isActive ? 'bg-neutral-800/50' : ''}
        `}
        onClick={handlePlay}
      >
        {/* 1. INDEX / PLAY */}
        <div className="flex justify-center items-center text-neutral-400">
           {isActive && isPlaying ? (
             <>
               <div className="group-hover:hidden">
                 <PlayingAnimation />
               </div>
               <BsPauseFill size={22} className="text-white hidden group-hover:block" />
             </>
           ) : (
             <>
               <span className={`
                 group-hover:hidden 
                 ${isActive ? 'text-green-500 font-medium' : ''}
               `}>
                 {idx + 1}
               </span>
               <BsPlayFill size={22} className="hidden group-hover:block text-white"/>
             </>
           )}
        </div>

        {/* 2. ALBUM ART */}
        <div className="relative h-[48px] w-[48px] overflow-hidden rounded-md shadow-sm">
          <Image fill src={imageUrl} alt={song.title} className="object-cover" />
        </div>

        {/* 3. TITLE & ARTIST */}
        <div className="flex flex-col gap-y-1 min-w-0 overflow-hidden">
          <p className={`truncate font-medium text-base ${isActive ? 'text-green-500' : 'text-white'}`}>
            {song.title}
          </p>
          <p className="text-sm text-neutral-400 truncate">
            {artistName}
          </p>
        </div>

        {/* 4. ALBUM NAME */}
        <div className="flex items-center">
            <p 
              className="text-sm text-neutral-400 truncate hover:text-white hover:underline cursor-pointer transition"
              onClick={(e) => {
                e.stopPropagation(); 
                router.push(`/album/${song.album_id}`);
              }}
            >
                {albumName}
            </p>
        </div>

        {/* 5. LIKE BUTTON */}
        <div className="flex justify-center">
           <LikeButton songId={song.id} />
        </div>

        {/* 6. DURATION */}
        <div className="flex justify-end">
           <p className="text-sm text-neutral-400 font-medium tabular-nums">
             {formatTime(song.duration_seconds)}
           </p>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="bg-black rounded-lg h-full w-full overflow-hidden overflow-y-auto">
      <div className="px-6 py-4 flex flex-col gap-y-8 pb-24">
        
        <div className="mt-4 mb-2">
          <h1 className="text-white text-3xl font-bold">Queue</h1>
        </div>

        {/* NOW PLAYING */}
        <div>
           <h2 className="text-white text-xl font-bold mb-4">Now Playing</h2>
           {/* Wrap in AnimatePresence to animate the swap if active song changes */}
           <AnimatePresence mode="popLayout">
             {activeId && renderRow(activeId, 0, 'active')}
           </AnimatePresence>
           {!activeId && <p className="text-neutral-400">Nothing playing.</p>}
        </div>

        {/* PRIORITY QUEUE */}
        {bucketB.length > 0 && (
          <div>
            <div className="flex items-center gap-x-2 mb-4">
                <h2 className="text-white text-xl font-bold">Next in Queue</h2>
                <span className="text-xs bg-neutral-800 text-neutral-300 px-2 py-1 rounded-full border border-neutral-700">Priority</span>
            </div>
            {/* 4. AnimatePresence for Priority Queue */}
            <motion.div className="flex flex-col gap-y-1">
              <AnimatePresence mode="popLayout">
                {bucketB.map((item, idx) => renderRow(item.id, idx, `queue-${item.uid}`))}
              </AnimatePresence>
            </motion.div>
          </div>
        )}

        {/* CONTEXT QUEUE */}
        {upcomingContextIds.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-white text-xl font-bold">{getContextLabel()}</h2>
            </div>
            {/* 5. Standard motion div for list container */}
            <motion.div 
              // Using a key here forces a re-render/animation when shuffle toggles
              key={`${isShuffled}-${activeId}`} 
              className="flex flex-col gap-y-1"
            >
              <AnimatePresence mode="popLayout" initial={false}>
                {upcomingContextIds.map((id, idx) => renderRow(id, idx, 'context'))}
              </AnimatePresence>
            </motion.div>
          </div>
        )}

        {upcomingContextIds.length === 0 && bucketB.length === 0 && !activeId && (
            <div className="text-neutral-400 text-center py-10">
                Your queue is empty. Go play some music!
            </div>
        )}
      </div>
    </div>
  );
}