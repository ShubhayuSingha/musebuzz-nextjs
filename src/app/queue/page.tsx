// src/app/queue/page.tsx
'use client';

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
// 1. UPDATE IMPORTS: Use the same icons as Album/Liked pages
import { BsPlayFill, BsPauseFill } from "react-icons/bs"; 
import PlayingAnimation from "@/components/PlayingAnimation"; // Import Visualizer

import usePlayerStore from "@/stores/usePlayerStore";
import { supabase } from "@/lib/supabaseClient";
import { Song } from "@/types"; 
import LikeButton from "@/components/LikeButton";

export default function QueuePage() {
  const { 
    activeId, 
    bucketA, 
    bucketB, 
    shuffledOrder, 
    isShuffled,
    activeContext, 
    setId, 
    isPlaying,
    setIsPlaying // Need this for the toggle logic
  } = usePlayerStore();

  const [songs, setSongs] = useState<Record<string, Song>>({});
  const [loading, setLoading] = useState(true);

  const mainQueueIds = isShuffled ? shuffledOrder : bucketA;

  const currentIndex = mainQueueIds.findIndex((id) => id === activeId);
  const upcomingContextIds = (currentIndex !== -1) 
    ? mainQueueIds.slice(currentIndex + 1) 
    : mainQueueIds;

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

  // 2. UPDATED ROW RENDERER with Visualizer & Toggle Logic
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
    
    // Check Status
    const isActive = activeId === id;
    
    // SMART TOGGLE HANDLER
    const handlePlay = () => {
      if (isActive) {
        // Toggle Play/Pause if it's the current song
        setIsPlaying(!isPlaying);
      } else {
        // Otherwise, set it as the new active song
        setId(id);
      }
    };

    return (
      <div 
        key={`${source}-${id}-${idx}`} 
        className={`
          group flex items-center gap-x-4 w-full p-2 rounded-md hover:bg-neutral-400/10 transition cursor-pointer
          ${isActive ? 'bg-neutral-700/50' : ''}
        `}
        onClick={handlePlay}
      >
        {/* Left Side: Icon / Visualizer / Number */}
        <div className="flex items-center justify-center w-[40px] h-[40px] text-neutral-400 relative">
           
           {/* CASE 1: Active & Playing -> Visualizer (Hover: Pause) */}
           {isActive && isPlaying ? (
             <>
               <div className="group-hover:hidden">
                 <PlayingAnimation />
               </div>
               <BsPauseFill size={25} className="text-white hidden group-hover:block" />
             </>
           ) : (
             /* CASE 2: Not Playing -> Number (Hover: Play) */
             <>
                <span className={`
                  group-hover:hidden 
                  ${isActive ? 'text-green-500 font-medium' : ''}
                `}>
                  {idx + 1}
                </span>
                <BsPlayFill size={25} className="hidden group-hover:block text-white"/>
             </>
           )}
        </div>

        {/* Album Art */}
        <div className="relative min-h-[48px] min-w-[48px] overflow-hidden rounded-md">
          <Image fill src={imageUrl} alt={song.title} className="object-cover" />
        </div>

        {/* Title & Artist */}
        <div className="flex flex-col gap-y-1 overflow-hidden">
          <p className={`text-base truncate ${isActive ? 'text-green-500 font-medium' : 'text-white'}`}>
            {song.title}
          </p>
          <p className="text-sm text-neutral-400 truncate">
            {artistName}
          </p>
        </div>

        {/* Right Side */}
        <div className="ml-auto flex items-center gap-x-4">
           <LikeButton songId={song.id} />
           <p className="text-sm text-neutral-400 hidden md:block">
             {Math.floor(song.duration_seconds / 60)}:{(song.duration_seconds % 60).toString().padStart(2, '0')}
           </p>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-black rounded-lg h-full w-full overflow-hidden overflow-y-auto">
      <div className="px-6 py-4 flex flex-col gap-y-8 pb-24">
        
        <div className="mt-4 mb-2">
          <h1 className="text-white text-3xl font-semibold">Queue</h1>
        </div>

        {/* NOW PLAYING */}
        <div>
           <h2 className="text-white text-xl font-bold mb-4">Now Playing</h2>
           {activeId ? renderRow(activeId, 0, 'active') : <p className="text-neutral-400">Nothing playing.</p>}
        </div>

        {/* PRIORITY QUEUE */}
        {bucketB.length > 0 && (
          <div>
            <div className="flex items-center gap-x-2 mb-4">
                <h2 className="text-white text-xl font-bold">Next in Queue</h2>
                <span className="text-xs bg-neutral-700 text-neutral-300 px-2 py-1 rounded-full">Priority</span>
            </div>
            <div className="flex flex-col gap-y-2">
              {bucketB.map((item, idx) => renderRow(item.id, idx, `queue-${item.uid}`))}
            </div>
          </div>
        )}

        {/* CONTEXT QUEUE */}
        {upcomingContextIds.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-white text-xl font-bold">{getContextLabel()}</h2>
            </div>
            <div 
              key={`${isShuffled}-${activeId}`}
              className="flex flex-col gap-y-2 animate-fade-in"
            >
              {upcomingContextIds.map((id, idx) => renderRow(id, idx, 'context'))}
            </div>
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