'use client';

import { useEffect, useState, useMemo, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation"; 
import { BsPlayFill, BsPauseFill } from "react-icons/bs"; 
import { AiOutlineClose } from "react-icons/ai"; 

import PlayingAnimation from "@/components/PlayingAnimation"; 
import usePlayerStore from "@/stores/usePlayerStore";
import useQueueStore from "@/stores/useQueueStore"; // UI Store
import { supabase } from "@/lib/supabaseClient";
import { Song } from "@/types"; 
import LikeButton from "@/components/LikeButton";
import { v4 as uuidv4 } from 'uuid'; 

import { motion, AnimatePresence, Reorder } from "framer-motion";

export default function Queue() {
  const router = useRouter();
  const { isOpen, onClose } = useQueueStore(); // UI Visibility

  const { 
    activeId, bucketA, bucketB, shuffledOrder, isShuffled, activeContext, setId, isPlaying, setIsPlaying,
    lastActiveContextId, isPlayingPriority, playQueueItem, updateQueueFromUnified,
    removeFromContext, removeFromPriority
  } = usePlayerStore();

  const [songs, setSongs] = useState<Record<string, Song>>({});
  const [unifiedList, setUnifiedList] = useState<any[]>([]);
  
  // Stable Key Logic
  const contextUidMap = useRef<Map<string, string[]>>(new Map());
  const getStableUid = (id: string, indexOccurrence: number) => {
    let uids = contextUidMap.current.get(id);
    if (!uids) { uids = []; contextUidMap.current.set(id, uids); }
    if (!uids[indexOccurrence]) uids[indexOccurrence] = `ctx-${id}-${uuidv4()}`;
    return uids[indexOccurrence];
  };

  // 1. Build List
  useEffect(() => {
    const priorityItems = bucketB.map(item => ({ ...item, type: 'priority' }));
    const mainQueueIds = isShuffled ? shuffledOrder : bucketA;
    const referenceId = isPlayingPriority ? lastActiveContextId : activeId;
    const currentIndex = mainQueueIds.findIndex((id) => id === referenceId);

    let upcomingContextIds: string[] = [];
    if (currentIndex !== -1) {
      upcomingContextIds = mainQueueIds.slice(currentIndex + 1);
    } else {
        const lastIndex = lastActiveContextId ? mainQueueIds.findIndex(id => id === lastActiveContextId) : -1;
        upcomingContextIds = lastIndex !== -1 ? mainQueueIds.slice(lastIndex + 1) : mainQueueIds;
    }

    const showDivider = upcomingContextIds.length > 0;
    const dividerItem = showDivider ? [{
      id: 'QUEUE-DIVIDER', isDivider: true,
      label: !activeContext ? (isShuffled ? "Next from shuffled" : "Next from ordered") : `NEXT FROM: ${activeContext.title}`
    }] : [];

    const idCounts: Record<string, number> = {};
    const contextItems = upcomingContextIds.map((id) => {
      const occurrence = idCounts[id] || 0;
      idCounts[id] = occurrence + 1;
      return { id, uid: getStableUid(id, occurrence), type: 'context' };
    });

    setUnifiedList([...priorityItems, ...dividerItem, ...contextItems]);
  }, [bucketA, bucketB, shuffledOrder, isShuffled, activeId, activeContext, isPlayingPriority, lastActiveContextId]);

  // 2. Fetch Songs
  const allIds = useMemo(() => {
    const ids = new Set([activeId, ...bucketA, ...bucketB.map(b => b.id)].filter(Boolean));
    return Array.from(ids) as string[];
  }, [bucketA, bucketB, activeId]);

  useEffect(() => {
    const fetchSongs = async () => {
      if (allIds.length === 0) return;
      const { data } = await supabase.from('songs').select('*, albums(*, artists(*))').in('id', allIds);
      if (data) {
        const songMap: Record<string, Song> = {};
        data.forEach((song: any) => songMap[song.id] = song);
        setSongs(songMap);
      }
    };
    fetchSongs();
  }, [allIds]);

  const handleReorder = (newOrder: any[]) => {
    setUnifiedList(newOrder); 
    updateQueueFromUnified(newOrder); 
  };

  // --- SUB-COMPONENT: ROW ---
  const QueueItemRow = ({ id, idx, source, uid }: { id: string, idx: number, source: string, uid?: string }) => {
     const song = songs[id];
     if (!song) return null;
     // @ts-ignore
     const imageUrl = song.albums?.image_path ? supabase.storage.from('images').getPublicUrl(song.albums?.image_path).data.publicUrl : '/images/music-placeholder.png';
     // @ts-ignore
     const artistName = song.albums?.artists?.name || "Unknown";
     const isActive = activeId === id && source === 'active';

     const handlePlay = () => {
       if (isActive) setIsPlaying(!isPlaying);
       else if (source.startsWith('queue-')) {
          const realIdx = bucketB.findIndex(b => b.uid === uid);
          if (realIdx !== -1) playQueueItem(realIdx);
       } else setId(id);
     };

     const handleRemove = (e: React.MouseEvent) => {
        e.stopPropagation(); 
        if (source.startsWith('queue-') && uid) removeFromPriority(uid);
        else if (source === 'context') removeFromContext(id);
     };

     return (
       <div className={`group grid grid-cols-[30px_40px_1fr_30px_30px] gap-x-3 items-center w-full px-2 py-2 rounded-md transition-colors cursor-pointer ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`} onClick={handlePlay}>
         <div className="flex justify-center items-center text-neutral-400">
            {isActive && isPlaying ? <PlayingAnimation /> : <span className={`group-hover:hidden ${isActive ? 'text-green-500' : ''}`}>{idx + 1}</span>}
            <BsPlayFill size={18} className={`hidden ${!isActive || !isPlaying ? 'group-hover:block' : ''} text-white`}/>
            {isActive && isPlaying && <BsPauseFill size={18} className="hidden group-hover:block text-white" />}
         </div>
         <div className="relative h-[40px] w-[40px] overflow-hidden rounded-md"><Image fill src={imageUrl} alt={song.title} className="object-cover" /></div>
         <div className="flex flex-col min-w-0 overflow-hidden"><p className={`truncate text-sm font-medium ${isActive ? 'text-green-500' : 'text-white'}`}>{song.title}</p><p className="truncate text-xs text-neutral-400">{artistName}</p></div>
         <div className="flex justify-center"><LikeButton songId={song.id} /></div>
         <div className="flex justify-end items-center">
            {!isActive && (<div onClick={handleRemove} className="hidden group-hover:block text-neutral-400 hover:text-white"><AiOutlineClose size={16} /></div>)}
            {/* 👆 Dots removed here */}
         </div>
       </div>
     );
  };

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div 
            // ANIMATION: Side panel expansion
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 400, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            // LAYOUT: Side panel style (not fixed)
            className="h-full bg-black border-l border-neutral-800 flex flex-col z-40 overflow-hidden flex-shrink-0"
        >
            <div className="w-[400px] flex flex-col h-full">
                {/* HEADER */}
                <div className="p-4 border-b border-neutral-800 flex items-center justify-between bg-black/95 backdrop-blur-sm sticky top-0 z-10">
                    <h2 className="text-xl font-bold text-white">Queue</h2>
                    <button onClick={onClose} className="text-neutral-400 hover:text-white transition"><AiOutlineClose size={20}/></button>
                </div>

                {/* SCROLLABLE LIST */}
                <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
                    {/* Now Playing */}
                    <div className="mb-4">
                        <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2 px-2">Now Playing</h3>
                        {activeId ? <QueueItemRow id={activeId} idx={0} source="active" /> : <p className="text-neutral-400 text-sm px-2">Nothing playing</p>}
                    </div>

                    {/* Draggable List */}
                    {unifiedList.length > 0 && (
                        <Reorder.Group axis="y" values={unifiedList} onReorder={handleReorder} className="flex flex-col gap-y-1">
                            <AnimatePresence mode="popLayout">
                            {unifiedList.map((item, index) => {
                                if (item.isDivider) {
                                    return (
                                        <Reorder.Item key={item.id} value={item} dragListener={false}>
                                            <div className="py-2 mt-4 mb-1 flex items-center justify-between px-2 cursor-default select-none">
                                                <span className="text-xs font-bold text-neutral-500 tracking-wider truncate max-w-[250px]">{item.label}</span>
                                                {unifiedList.some(x => x.type === 'priority') && <span className="text-[10px] bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded">Queue</span>}
                                            </div>
                                        </Reorder.Item>
                                    )
                                }
                                const dividerIdx = unifiedList.findIndex(x => x.isDivider);
                                const visualIdx = dividerIdx !== -1 ? (index < dividerIdx ? index : index - dividerIdx - 1) : index;

                                return (
                                    <Reorder.Item key={item.uid} value={item} layout initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0, height:0}}>
                                        <QueueItemRow id={item.id} idx={visualIdx} source={item.type === 'priority' ? `queue-${item.uid}` : 'context'} uid={item.uid} />
                                    </Reorder.Item>
                                )
                            })}
                            </AnimatePresence>
                        </Reorder.Group>
                    )}
                    {unifiedList.length === 0 && !activeId && <div className="text-center text-neutral-500 py-10 text-sm">Queue is empty</div>}
                </div>
            </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}