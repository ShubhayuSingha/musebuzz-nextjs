// src/components/Queue.tsx

'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import Image from 'next/image';
import { BsPlayFill, BsPauseFill, BsTrash, BsPlusLg, BsStars } from 'react-icons/bs'; 
import { IoClose } from 'react-icons/io5';
import { AiOutlineClose } from 'react-icons/ai';
import PlayingAnimation from '@/components/PlayingAnimation';
import usePlayerStore from '@/stores/usePlayerStore';
import useQueueStore from '@/stores/useQueueStore';
import { supabase } from '@/lib/supabaseClient';
import LikeButton from '@/components/LikeButton';
import { motion, AnimatePresence, Reorder, useDragControls, useMotionValue, useTransform, PanInfo, DragControls } from 'framer-motion';

/* =========================
   CONFIG
========================= */

const MIN_WIDTH = 300;
const MAX_WIDTH = 500;

/* =========================
   TYPES
========================= */

interface SongData {
  id: string;
  title: string;
  duration_seconds: number;
  albums: {
    title: string;
    image_path: string;
    artists: {
      name: string;
    } | null;
  } | null;
}

interface ContextItem {
  id: string;
  uid: string;
}

/* =========================
   ITEM CONTENT
========================= */

interface QueueItemContentProps {
    song: any;
    idx: number;
    source: 'priority' | 'context' | 'autoplay' | 'active';
    isPlaying: boolean;
    isActive: boolean;
    onPlay: () => void;
    onRemove?: () => void;
    reorderControls?: DragControls; 
}

const QueueItemContent = ({
  song,
  idx,
  source,
  isPlaying,
  isActive,
  onPlay,
  onRemove,
  reorderControls,
}: QueueItemContentProps) => {
  // @ts-ignore
  const imageUrl = song?.albums?.image_path
    ? supabase.storage.from('images').getPublicUrl(song.albums.image_path).data.publicUrl
    : '/images/music-placeholder.png'; 

  const artistName = song?.albums?.artists?.name || 'Unknown';

  return (
    <div
      onPointerDown={(e) => reorderControls?.start(e)}
      className={`
        group grid 
        grid-cols-[30px_40px_1fr_30px_30px]
        gap-x-2 items-center w-full px-2 py-2 rounded-md
        transition-colors cursor-pointer select-none relative z-10
        ${isActive ? 'bg-white/10' : 'hover:bg-white/5 bg-black'}
      `}
    >
      {/* PLAY BUTTON / INDEX */}
      <div 
        onClick={(e) => {
          e.stopPropagation(); 
          onPlay();
        }}
        onPointerDown={(e) => e.stopPropagation()} 
        className="flex justify-center items-center text-neutral-400 hover:text-white hover:scale-110 transition active:scale-95 p-1"
      >
        {isActive && isPlaying ? (
          <div className="group-hover:hidden">
             <PlayingAnimation />
          </div>
        ) : (
          <span className={`group-hover:hidden ${isActive ? 'text-green-500' : ''}`}>
             {source === 'autoplay' ? <BsStars size={12} className="text-emerald-500" /> : idx}
          </span>
        )}
        
        <BsPlayFill
          size={18}
          className={`hidden ${!isActive || !isPlaying ? 'group-hover:block' : ''} text-white`}
        />
        
        {isActive && isPlaying && (
          <BsPauseFill size={18} className="hidden group-hover:block text-white" />
        )}
      </div>

      {/* IMAGE */}
      <div className="relative h-[40px] w-[40px] overflow-hidden rounded-md bg-neutral-800 pointer-events-none"> 
        {song && <Image fill src={imageUrl} alt={song.title || ''} className="object-cover" />}
      </div>

      {/* TEXT */}
      <div className="flex flex-col min-w-0 overflow-hidden">
        <p className={`truncate text-sm font-medium ${isActive ? 'text-green-500' : source === 'autoplay' ? 'text-emerald-100' : 'text-white'}`}>
          {song?.title || 'Loading...'}
        </p>
        <p className="truncate text-xs text-neutral-400">{artistName}</p>
      </div>

      {/* LIKE BUTTON */}
      <div 
        className="flex justify-center" 
        onPointerDown={(e) => e.stopPropagation()} 
        onClick={(e) => e.stopPropagation()}
      >
        <LikeButton songId={song?.id} />
      </div>

      {/* REMOVE BUTTON */}
      <div className="flex justify-center items-center">
        {(source === 'priority' || source === 'context' || source === 'autoplay') && onRemove ? (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="hidden group-hover:block text-neutral-400 hover:text-white transition p-1"
          >
            <AiOutlineClose size={16} />
          </div>
        ) : (
           <div className="w-[16px]" />
        )}
      </div>
    </div>
  );
};

/* =========================
   DRAGGABLE ITEM
========================= */

const DraggableQueueItem = ({ item, song, idx, source, onPlay, onRemove, onAddToPriority }: any) => {
  const reorderControls = useDragControls();
  const x = useMotionValue(0);
  
  const deleteOpacity = useTransform(x, [-100, -50], [1, 0]); 
  const addOpacity = useTransform(x, [50, 100], [0, 1]);       

  if (!song) {
    return (
      <div className="h-[56px] w-full bg-neutral-800/10 rounded-md animate-pulse my-1" />
    );
  }

  const handleDragEnd = (event: any, info: PanInfo) => {
      if (info.offset.x < -80 && onRemove) {
          onRemove();
      } 
      else if (info.offset.x > 80 && onAddToPriority) {
          onAddToPriority();
      }
  };

  return (
    <Reorder.Item
      value={item}
      id={item.uid}
      dragListener={false} 
      dragControls={reorderControls}
      className="relative mb-1 overflow-visible rounded-md bg-black" 
    >
        {/* Swipe Left Background (Trash) */}
        <motion.div style={{ opacity: deleteOpacity }} className="absolute right-4 top-0 bottom-0 flex items-center justify-center text-red-500 z-0">
            <BsTrash size={20} />
        </motion.div>
        
        {/* Swipe Right Background (Add to Priority) */}
        <motion.div style={{ opacity: addOpacity }} className="absolute left-4 top-0 bottom-0 flex items-center justify-center text-green-500 z-0">
            <BsPlusLg size={20} />
        </motion.div>

        <motion.div
            style={{ x }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.1}
            onDragEnd={handleDragEnd}
            className="relative bg-black z-10" 
        >
            <QueueItemContent
                song={song}
                idx={idx}
                source={source}
                isActive={false}
                isPlaying={false}
                onPlay={onPlay}
                onRemove={onRemove}
                reorderControls={reorderControls}
            />
        </motion.div>
    </Reorder.Item>
  );
};

/* =========================
   MAIN COMPONENT
========================= */

export default function Queue() {
  const { isOpen, onClose, width, setWidth } = useQueueStore();
  const player = usePlayerStore();

  const [songsCache, setSongsCache] = useState<Record<string, SongData>>({});
  const fetchedIds = useRef<Set<string>>(new Set());

  // BUCKET B: Priority
  const priorityList = player.bucketB;

  // BUCKET A: Context
  const fullContextList = useMemo(() => {
      return player.isShuffled ? player.shuffledOrder : player.bucketA;
  }, [player.isShuffled, player.shuffledOrder, player.bucketA]);

  const currentIndex = useMemo(() => {
      const refId = player.isPlayingPriority ? player.lastActiveContextId : player.activeId;
      if (!refId) return -1;
      return fullContextList.indexOf(refId);
  }, [fullContextList, player.isPlayingPriority, player.lastActiveContextId, player.activeId]);

  const contextItems = useMemo<ContextItem[]>(() => {
    // If playing AI, we hide context
    if (player.isPlayingAutoplay) return [];
    if (currentIndex === -1 && fullContextList.length > 0) return [];
    
    const slice = fullContextList.slice(currentIndex + 1);

    const counts: Record<string, number> = {};
    return slice.map((id) => {
      const n = counts[id] || 0;
      counts[id] = n + 1;
      return { id, uid: `${id}-${n}` };
    });
  }, [fullContextList, currentIndex, player.isPlayingAutoplay]);

  // BUCKET C: Autoplay
  const autoplayItems = useMemo<ContextItem[]>(() => {
      let listToDisplay = player.autoplay;
      
      if (player.isPlayingAutoplay && player.activeId) {
          const currentIdx = player.autoplay.indexOf(player.activeId);
          if (currentIdx !== -1) {
              listToDisplay = player.autoplay.slice(currentIdx + 1);
          }
      }

      return listToDisplay.map((id) => ({ id, uid: `auto-${id}` }));
  }, [player.autoplay, player.isPlayingAutoplay, player.activeId]);


  /* -------- song fetch -------- */

  useEffect(() => {
    if (!isOpen) return;

    const ids = new Set<string>();
    if (player.activeId) ids.add(player.activeId);
    
    priorityList.forEach((i) => ids.add(i.id));
    contextItems.slice(0, 30).forEach((i) => ids.add(i.id));
    autoplayItems.slice(0, 20).forEach((i) => ids.add(i.id)); 

    const toFetch = Array.from(ids).filter(
      (id) => !fetchedIds.current.has(id)
    );
    if (!toFetch.length) return;

    const fetchBatch = async () => {
        const { data } = await supabase
        .from('songs')
        .select('id, title, duration_seconds, albums(title, image_path, artists(name))')
        .in('id', toFetch);

        if (data) {
            setSongsCache((prev) => {
                const copy = { ...prev };
                data.forEach((s: any) => (copy[s.id] = s));
                return copy;
            });
            data.forEach((s: any) => fetchedIds.current.add(s.id));
        }
    };
    fetchBatch();
  }, [isOpen, player.activeId, priorityList, contextItems, autoplayItems]);

  /* -------- reorder handlers -------- */

  const handlePriorityReorder = useCallback((items: typeof priorityList) => {
      player.setBucketB(items);
  }, [player]);

  const handleContextReorder = useCallback((newNextUpItems: ContextItem[]) => {
      const history = fullContextList.slice(0, currentIndex + 1);
      const newNextUpIds = newNextUpItems.map(i => i.id);
      const newFullList = [...history, ...newNextUpIds];
      
      player.setContextList(newFullList);
  }, [player, fullContextList, currentIndex]);

  const handleAutoplayReorder = useCallback((newItems: ContextItem[]) => {
      const newIds = newItems.map(i => i.id);
      if (player.isPlayingAutoplay && player.activeId) {
          const currentIdx = player.autoplay.indexOf(player.activeId);
          if (currentIdx !== -1) {
              const history = player.autoplay.slice(0, currentIdx + 1);
              player.setAutoplay([...history, ...newIds]);
              return;
          }
      }
      player.setAutoplay(newIds);
  }, [player]);

  const handleRemoveFromAutoplay = useCallback((uid: string) => {
      const idToRemove = uid.replace('auto-', '');
      
      if (player.isPlayingAutoplay && player.activeId) {
          const currentIdx = player.autoplay.indexOf(player.activeId);
          const history = player.autoplay.slice(0, currentIdx + 1);
          const future = player.autoplay.slice(currentIdx + 1).filter(id => id !== idToRemove);
          player.setAutoplay([...history, ...future]);
      } else {
          const newList = player.autoplay.filter(id => id !== idToRemove);
          player.setAutoplay(newList);
      }
  }, [player]);


  /* -------- resize logic -------- */
  const resizing = useRef(false);
  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizing.current = true;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  }, []);
  const stopResizing = useCallback(() => {
    resizing.current = false;
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }, []);
  const resize = useCallback((e: MouseEvent) => {
    if (!resizing.current) return;
    const w = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, window.innerWidth - e.clientX));
    setWidth(w);
  }, [setWidth]);

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

  /* =========================
        RENDER
  ========================= */

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ width: 0 }}
          animate={{ width }}
          exit={{ width: 0 }}
          transition={{ duration: 0.25 }}
          className="h-full bg-black border-l border-neutral-800 flex flex-col z-40 overflow-hidden relative"
        >
          {/* Resize Handle */}
          <div
            onMouseDown={startResizing}
            className={`
              absolute left-0 top-0 bottom-0 w-1 z-50
              cursor-col-resize transition-colors bg-transparent
              hover:bg-purple-500/50
              ${resizing.current ? 'bg-purple-500' : ''}
            `}
          />

          {/* Header */}
          <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Queue</h2>
            <button onClick={onClose} className="text-neutral-400 hover:text-white transition">
              <IoClose size={24} />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-neutral-800">
            
            {/* 1. NOW PLAYING */}
            <div className="mb-6 mt-2">
              <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2 px-2">
                Now Playing
              </h3>
              {player.activeId && songsCache[player.activeId] ? (
                <QueueItemContent
                  song={songsCache[player.activeId]}
                  idx={1}
                  source="active"
                  isPlaying={player.isPlaying}
                  isActive
                  onPlay={() => player.setIsPlaying(!player.isPlaying)}
                />
              ) : (
                <p className="text-neutral-400 text-sm px-2">Nothing playing</p>
              )}
            </div>

            {/* 2. PRIORITY QUEUE (Bucket B) */}
            {priorityList.length > 0 && (
              <div className="mb-6">
                {/* 🟢 UPDATED: Flex container with Title on left, Clear button on right */}
                <div className="flex items-center justify-between mb-2 px-2">
                  <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-2">
                    Next In Queue
                    <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">
                      {priorityList.length}
                    </span>
                  </h3>
                  
                  <button 
                    onClick={() => player.clearPriorityQueue()}
                    className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 hover:text-white transition-colors border border-neutral-700 hover:border-neutral-500 rounded px-2 py-0.5"
                  >
                    Clear
                  </button>
                </div>

                <Reorder.Group
                  axis="y"
                  values={priorityList}
                  onReorder={handlePriorityReorder}
                  className="flex flex-col gap-1"
                >
                  {priorityList.map((item, i) => (
                    <DraggableQueueItem
                      key={item.uid}
                      item={item}
                      song={songsCache[item.id]}
                      idx={i + 1}
                      source="priority"
                      onPlay={() => {
                        const realIdx = priorityList.findIndex((b) => b.uid === item.uid);
                        if (realIdx !== -1) player.playQueueItem(realIdx);
                      }}
                      onRemove={() => player.removeFromPriority(item.uid)}
                      onAddToPriority={undefined} 
                    />
                  ))}
                </Reorder.Group>
              </div>
            )}

            {/* 3. CONTEXT QUEUE (Bucket A) */}
            {(contextItems.length > 0 || !player.isPlayingAutoplay) && (
              <div className="mb-2">
                <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2 px-2">
                  Next from:{' '}
                  <span className="text-neutral-300">
                    {player.activeContext?.title || 'Context'}
                  </span>
                </h3>

                {contextItems.length === 0 ? (
                  <p className="text-neutral-500 text-sm px-2 italic mb-4">
                    End of list
                  </p>
                ) : (
                  <Reorder.Group
                    axis="y"
                    values={contextItems}
                    onReorder={handleContextReorder}
                    className="flex flex-col gap-1"
                  >
                    {contextItems.map((item, i) => (
                      <DraggableQueueItem
                        key={item.uid}
                        item={item}
                        song={songsCache[item.id]}
                        idx={i + 1}
                        source="context"
                        onPlay={() => player.setId(item.id)}
                        onRemove={() => player.removeFromContext(item.id)}
                        onAddToPriority={() => player.addToQueue(item.id)} 
                      />
                    ))}
                  </Reorder.Group>
                )}
              </div>
            )}

            {/* 4. AUTOPLAY / AI QUEUE (Bucket C) */}
            {autoplayItems.length > 0 && (
                <div className="mt-8 mb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center gap-2 mb-3 px-2 border-t border-neutral-800 pt-6">
                        <BsStars className="text-emerald-500" size={14} />
                        <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-wider">
                            Recommended for you
                        </h3>
                    </div>

                    <Reorder.Group
                        axis="y"
                        values={autoplayItems}
                        onReorder={handleAutoplayReorder}
                        className="flex flex-col gap-1"
                    >
                        {autoplayItems.map((item, i) => (
                            <DraggableQueueItem
                                key={item.uid}
                                item={item}
                                song={songsCache[item.id]}
                                idx={i + 1}
                                source="autoplay"
                                onPlay={() => player.playAutoplayItem(item.id)}
                                onRemove={() => handleRemoveFromAutoplay(item.uid)}
                                onAddToPriority={() => player.addToQueue(item.id)}
                            />
                        ))}
                    </Reorder.Group>
                </div>
            )}

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}