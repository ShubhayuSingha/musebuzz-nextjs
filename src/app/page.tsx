'use client';

import { useEffect, useState, useRef, MouseEvent } from 'react';
import { supabase } from '@/lib/supabaseClient';
import AlbumItem from '@/components/AlbumItem';
import PlaylistItem from '@/components/PlaylistItem';
import Greeting from '@/components/Greeting';
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi2';

type SectionKey = 'albums' | 'playlists';

export default function Home() {
  const [albums, setAlbums] = useState<any[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);

  const albumScrollRef = useRef<HTMLDivElement>(null);
  const playlistScrollRef = useRef<HTMLDivElement>(null);

  // Drag visuals
  const [isDragging, setIsDragging] = useState(false);

  // Arrow visibility
  const [canScrollLeft, setCanScrollLeft] = useState<Record<SectionKey, boolean>>({
    albums: false,
    playlists: false,
  });

  const [canScrollRight, setCanScrollRight] = useState<Record<SectionKey, boolean>>({
    albums: true,
    playlists: true,
  });

  // Drag logic refs
  const isDown = useRef(false);
  const hasMoved = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  // Momentum refs (MOUSE ONLY)
  const lastX = useRef(0);
  const lastTime = useRef(0);
  const velocity = useRef(0);
  const momentumId = useRef<number | null>(null);

  useEffect(() => {
    const fetchAlbums = async () => {
      const { data } = await supabase
        .from('albums')
        .select('*, artists(*)')
        .order('created_at', { ascending: false });

      if (data) setAlbums(data);
    };

    const fetchPlaylists = async () => {
      const { data } = await supabase
        .from('playlists')
        .select('*')
        .order('created_at', { ascending: false });

      if (data) setPlaylists(data);
    };

    fetchAlbums();
    fetchPlaylists();
  }, []);

  // === ARROW VISIBILITY (SOURCE OF TRUTH) ===
  const updateScrollButtons = (
    ref: React.RefObject<HTMLDivElement>,
    key: SectionKey
  ) => {
    if (!ref.current) return;

    const { scrollLeft, scrollWidth, clientWidth } = ref.current;

    setCanScrollLeft((prev) => ({
      ...prev,
      [key]: scrollLeft > 0,
    }));

    setCanScrollRight((prev) => ({
      ...prev,
      [key]: scrollLeft + clientWidth < scrollWidth - 1,
    }));
  };

  // === ARROW CLICK SCROLL ===
  const scroll = (
    ref: React.RefObject<HTMLDivElement>,
    direction: 'left' | 'right'
  ) => {
    if (!ref.current) return;

    const scrollAmount = ref.current.clientWidth / 1.5;

    ref.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  // === MOUSE DOWN ===
  const handleMouseDown = (
    e: MouseEvent,
    ref: React.RefObject<HTMLDivElement>
  ) => {
    if (!ref.current) return;

    isDown.current = true;
    hasMoved.current = false;

    startX.current = e.pageX - ref.current.offsetLeft;
    scrollLeft.current = ref.current.scrollLeft;

    lastX.current = e.pageX;
    lastTime.current = performance.now();

    if (momentumId.current) {
      cancelAnimationFrame(momentumId.current);
      momentumId.current = null;
    }
  };

  // === MOUSE MOVE (DRAG + VELOCITY TRACKING) ===
  const handleMouseMove = (
    e: MouseEvent,
    ref: React.RefObject<HTMLDivElement>,
    key: SectionKey
  ) => {
    if (!isDown.current || !ref.current) return;

    const now = performance.now();
    const dx = e.pageX - lastX.current;
    const dt = now - lastTime.current;

    if (dt > 0) {
      velocity.current = dx / dt; // px per ms
    }

    lastX.current = e.pageX;
    lastTime.current = now;

    const x = e.pageX - ref.current.offsetLeft;
    const walk = x - startX.current;

    if (Math.abs(walk) > 5) {
      e.preventDefault();

      if (!hasMoved.current) {
        hasMoved.current = true;
        setIsDragging(true);
      }

      ref.current.scrollLeft = scrollLeft.current - walk * 2;
    }
  };

  // === MOMENTUM SCROLL (MOUSE ONLY) ===
  const startMomentum = (
    ref: React.RefObject<HTMLDivElement>,
    key: SectionKey
  ) => {
    if (!ref.current) return;

    const friction = 0.95;

    const step = () => {
      if (!ref.current) return;

      ref.current.scrollLeft -= velocity.current * 16;
      velocity.current *= friction;

      updateScrollButtons(ref, key);

      if (Math.abs(velocity.current) > 0.02) {
        momentumId.current = requestAnimationFrame(step);
      } else {
        velocity.current = 0;
        momentumId.current = null;
      }
    };

    momentumId.current = requestAnimationFrame(step);
  };

  // === MOUSE UP ===
  const handleMouseUp = (
    ref: React.RefObject<HTMLDivElement>,
    key: SectionKey
  ) => {
    isDown.current = false;
    hasMoved.current = false;
    setTimeout(() => setIsDragging(false), 0);

    if (Math.abs(velocity.current) > 0.1) {
      startMomentum(ref, key);
    }
  };

  // === MOUSE LEAVE ===
  const handleMouseLeave = (
    ref: React.RefObject<HTMLDivElement>,
    key: SectionKey
  ) => {
    if (isDown.current && Math.abs(velocity.current) > 0.1) {
      startMomentum(ref, key);
    }

    isDown.current = false;
    hasMoved.current = false;
    setIsDragging(false);
  };

  const renderScroller = (
    items: any[],
    ItemComponent: React.FC<any>,
    scrollRef: React.RefObject<HTMLDivElement>,
    key: SectionKey
  ) => (
    <div className="relative group">
      {canScrollLeft[key] && (
        <button
          onClick={() => scroll(scrollRef, 'left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 p-2 rounded-full hidden group-hover:block"
        >
          <HiChevronLeft size={30} />
        </button>
      )}

      <div
        ref={scrollRef}
        onScroll={() => updateScrollButtons(scrollRef, key)}
        onMouseDown={(e) => handleMouseDown(e, scrollRef)}
        onMouseMove={(e) => handleMouseMove(e, scrollRef, key)}
        onMouseUp={() => handleMouseUp(scrollRef, key)}
        onMouseLeave={() => handleMouseLeave(scrollRef, key)}
        className={`
          flex gap-4 overflow-x-auto scrollbar-hide pb-4 select-none
          ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}
        `}
      >
        {items.map((item) => (
          <div key={item.id} className="min-w-[180px] w-[180px]">
            <div className={isDragging ? 'pointer-events-none' : ''}>
              <ItemComponent
                {...{
                  [ItemComponent === AlbumItem ? 'album' : 'playlist']: item,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {canScrollRight[key] && (
        <button
          onClick={() => scroll(scrollRef, 'right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 p-2 rounded-full hidden group-hover:block"
        >
          <HiChevronRight size={30} />
        </button>
      )}
    </div>
  );

  useEffect(() => {
    setTimeout(() => {
      updateScrollButtons(albumScrollRef, 'albums');
      updateScrollButtons(playlistScrollRef, 'playlists');
    }, 0);
  }, [albums, playlists]);

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
