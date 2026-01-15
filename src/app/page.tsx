// src/app/page.tsx
'use client';

import { useEffect, useRef, useState, MouseEvent } from 'react';
import { supabase } from '@/lib/supabaseClient';
import AlbumItem from '@/components/AlbumItem';
import PlaylistItem from '@/components/PlaylistItem';
import Greeting from '@/components/Greeting';
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi2';
import { motion } from 'framer-motion';

type SectionKey = 'albums' | 'playlists';

const STAGGER = 0.08;
const INITIAL_DELAY = 0.25;
const DRAG_THRESHOLD = 5; // 👈 key fix

export default function Home() {
  const [albums, setAlbums] = useState<any[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const albumScrollRef = useRef<HTMLDivElement>(null);
  const playlistScrollRef = useRef<HTMLDivElement>(null);

  // native drag state
  const isDown = useRef(false);
  const hasMoved = useRef(false);
  const startX = useRef(0);
  const scrollStart = useRef(0);
  const lastX = useRef(0);
  const lastTime = useRef(0);

  const velocityX = useRef(0);
  const momentumId = useRef<number | null>(null);

  const [canScrollLeft, setCanScrollLeft] = useState<Record<SectionKey, boolean>>({
    albums: false,
    playlists: false,
  });

  const [canScrollRight, setCanScrollRight] = useState<Record<SectionKey, boolean>>({
    albums: true,
    playlists: true,
  });

  /* =======================
     DATA FETCH
     ======================= */

  useEffect(() => {
    supabase
      .from('albums')
      .select('*, artists(*)')
      .order('created_at', { ascending: false })
      .then(({ data }) => data && setAlbums(data));

    supabase
      .from('playlists')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => data && setPlaylists(data));
  }, []);

  /* =======================
     SCROLL HELPERS
     ======================= */

  const updateScrollButtons = (
    ref: React.RefObject<HTMLDivElement | null>,
    key: SectionKey
  ) => {
    if (!ref.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = ref.current;

    setCanScrollLeft((prev) => ({ ...prev, [key]: scrollLeft > 0 }));
    setCanScrollRight((prev) => ({
      ...prev,
      [key]: scrollLeft + clientWidth < scrollWidth - 1,
    }));
  };

  const scrollByAmount = (
    ref: React.RefObject<HTMLDivElement | null>,
    amount: number,
    key: SectionKey
  ) => {
    if (!ref.current) return;
    ref.current.scrollBy({ left: amount, behavior: 'smooth' });
    updateScrollButtons(ref, key);
  };

  /* =======================
     MOMENTUM
     ======================= */

  const startMomentum = (
    ref: React.RefObject<HTMLDivElement | null>,
    key: SectionKey
  ) => {
    if (!ref.current) return;

    const friction = 0.95;

    const step = () => {
      if (!ref.current) return;

      ref.current.scrollLeft -= velocityX.current;
      velocityX.current *= friction;

      updateScrollButtons(ref, key);

      if (Math.abs(velocityX.current) > 0.5) {
        momentumId.current = requestAnimationFrame(step);
      } else {
        velocityX.current = 0;
        momentumId.current = null;
      }
    };

    momentumId.current = requestAnimationFrame(step);
  };

  /* =======================
     NATIVE DRAG HANDLERS
     ======================= */

  const onMouseDown = (
    e: MouseEvent,
    ref: React.RefObject<HTMLDivElement | null>
  ) => {
    if (!ref.current) return;

    isDown.current = true;
    hasMoved.current = false;

    startX.current = e.pageX - ref.current.offsetLeft;
    scrollStart.current = ref.current.scrollLeft;

    lastX.current = e.pageX;
    lastTime.current = performance.now();

    if (momentumId.current) {
      cancelAnimationFrame(momentumId.current);
      momentumId.current = null;
    }
  };

  const onMouseMove = (
    e: MouseEvent,
    ref: React.RefObject<HTMLDivElement | null>,
    key: SectionKey
  ) => {
    if (!isDown.current || !ref.current) return;

    const x = e.pageX - ref.current.offsetLeft;
    const walk = x - startX.current;

    // 👇 threshold check
    if (!hasMoved.current && Math.abs(walk) < DRAG_THRESHOLD) {
      return;
    }

    if (!hasMoved.current) {
      hasMoved.current = true;
      setIsDragging(true);
    }

    e.preventDefault();

    const now = performance.now();
    const dx = e.pageX - lastX.current;
    const dt = now - lastTime.current;

    if (dt > 0) velocityX.current = dx / 2;

    lastX.current = e.pageX;
    lastTime.current = now;

    ref.current.scrollLeft = scrollStart.current - walk;
    updateScrollButtons(ref, key);
  };

  const onMouseUp = (
    ref: React.RefObject<HTMLDivElement | null>,
    key: SectionKey
  ) => {
    isDown.current = false;

    if (hasMoved.current) {
      setIsDragging(false);
      startMomentum(ref, key);
    }

    hasMoved.current = false;
  };

  const onMouseLeave = (
    ref: React.RefObject<HTMLDivElement | null>,
    key: SectionKey
  ) => {
    if (!isDown.current) return;

    isDown.current = false;

    if (hasMoved.current) {
      setIsDragging(false);
      startMomentum(ref, key);
    }

    hasMoved.current = false;
  };

  /* =======================
     SCROLLER
     ======================= */

  const renderScroller = (
    items: any[],
    ItemComponent: React.FC<any>,
    scrollRef: React.RefObject<HTMLDivElement | null>,
    key: SectionKey
  ) => (
    <div className="relative group">
      {canScrollLeft[key] && (
        <button
          onClick={() =>
            scrollByAmount(scrollRef, -scrollRef.current!.clientWidth / 1.5, key)
          }
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10
                     bg-black/50 hover:bg-black/70 p-2 rounded-full
                     hidden group-hover:block"
        >
          <HiChevronLeft size={30} />
        </button>
      )}

      <div
        ref={scrollRef}
        onScroll={() => updateScrollButtons(scrollRef, key)}
        onMouseDown={(e) => onMouseDown(e, scrollRef)}
        onMouseMove={(e) => onMouseMove(e, scrollRef, key)}
        onMouseUp={() => onMouseUp(scrollRef, key)}
        onMouseLeave={() => onMouseLeave(scrollRef, key)}
        className={`
          flex gap-4 overflow-x-auto scrollbar-hide pb-4 select-none
          min-h-[260px]
          ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}
        `}
      >
        {items.map((item, index) => (
          <motion.div
            key={item.id}
            className="min-w-[180px] w-[180px]"
            initial={{ opacity: 0, y: 60, scale: 0.85 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              transition: {
                type: 'spring',
                stiffness: 180,
                damping: 18,
                mass: 0.8,
                delay: INITIAL_DELAY + index * STAGGER,
              },
            }}
          >
            <div className={isDragging ? 'pointer-events-none' : ''}>
              <ItemComponent
                {...{
                  [ItemComponent === AlbumItem ? 'album' : 'playlist']: item,
                }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      {canScrollRight[key] && (
        <button
          onClick={() =>
            scrollByAmount(scrollRef, scrollRef.current!.clientWidth / 1.5, key)
          }
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10
                     bg-black/50 hover:bg-black/70 p-2 rounded-full
                     hidden group-hover:block"
        >
          <HiChevronRight size={30} />
        </button>
      )}
    </div>
  );

  /* =======================
     INIT
     ======================= */

  useEffect(() => {
    updateScrollButtons(albumScrollRef, 'albums');
    updateScrollButtons(playlistScrollRef, 'playlists');
  }, [albums, playlists]);

  /* =======================
     RENDER
     ======================= */

  return (
    <div className="p-8 select-none">
      <Greeting />
      <p className="mt-4 text-zinc-400">Music buzzing every day.</p>

      <div className="mt-8">
        <h2 className="text-2xl font-semibold mb-4">Newest Albums</h2>
        {renderScroller(albums, AlbumItem, albumScrollRef, 'albums')}
      </div>

      <div className="mt-12">
        <h2 className="text-2xl font-semibold mb-4">For You</h2>
        {renderScroller(playlists, PlaylistItem, playlistScrollRef, 'playlists')}
      </div>
    </div>
  );
}
