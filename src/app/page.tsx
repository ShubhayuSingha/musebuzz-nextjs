'use client';

import { useEffect, useRef, useState, MouseEvent } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useUser } from '@supabase/auth-helpers-react'; 
import AlbumItem from '@/components/AlbumItem';
import PlaylistItem from '@/components/PlaylistItem';
import MixPlaylistItem from '@/components/MixPlaylistItem'; 
import ArtistItem from '@/components/ArtistItem'; // 🟢 Import
import Greeting from '@/components/Greeting';
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi2';
import { motion } from 'framer-motion';

import usePlaylistStore from '@/stores/usePlaylistStore';
import MediaContextMenu from "@/components/MediaContextMenu"; 

type SectionKey = 'jumpBackIn' | 'madeForYou' | 'suggestedAlbums' | 'yourPlaylists' | 'newestAlbums';

const STAGGER = 0.08;
const INITIAL_DELAY = 0.25;
const DRAG_THRESHOLD = 5;

export default function Home() {
  const { version } = usePlaylistStore();
  const user = useUser();

  // Data States
  const [jumpBackIn, setJumpBackIn] = useState<any[]>([]);
  const [madeForYou, setMadeForYou] = useState<any[]>([]); 
  const [suggestedAlbums, setSuggestedAlbums] = useState<any[]>([]);
  const [aiTitle, setAiTitle] = useState("Suggested Albums");
  const [yourPlaylists, setYourPlaylists] = useState<any[]>([]);
  const [newestAlbums, setNewestAlbums] = useState<any[]>([]);

  const [isDragging, setIsDragging] = useState(false);

  // Refs
  const jumpBackInRef = useRef<HTMLDivElement>(null);
  const madeForYouRef = useRef<HTMLDivElement>(null); 
  const suggestedRef = useRef<HTMLDivElement>(null);
  const yourPlaylistsRef = useRef<HTMLDivElement>(null);
  const newestRef = useRef<HTMLDivElement>(null);

  // native drag state
  const isDown = useRef(false);
  const hasMoved = useRef(false);
  const startX = useRef(0);
  const scrollStart = useRef(0);
  const lastX = useRef(0);
  const lastTime = useRef(0);

  const velocityX = useRef(0);
  const momentumId = useRef<number | null>(null);

  // Scroll States
  const [canScrollLeft, setCanScrollLeft] = useState<Record<SectionKey, boolean>>({
    jumpBackIn: false,
    madeForYou: false,
    suggestedAlbums: false,
    yourPlaylists: false,
    newestAlbums: false,
  });

  const [canScrollRight, setCanScrollRight] = useState<Record<SectionKey, boolean>>({
    jumpBackIn: false,
    madeForYou: false,
    suggestedAlbums: false,
    yourPlaylists: false,
    newestAlbums: false,
  });

  /* =======================
        DATA FETCH
     ======================= */

  useEffect(() => {
    const fetchDashboard = async () => {
        // 1. PUBLIC DATA (Fetch this for EVERYONE)
        const { data: newAlbums } = await supabase
            .from('albums')
            .select('*, artists(*)')
            .order('created_at', { ascending: false })
            .limit(10);
        if (newAlbums) setNewestAlbums(newAlbums);

        // 2. USER-ONLY DATA (Only fetch if logged in)
        if (user) {
            // A. JUMP BACK IN (Albums + Playlists + Artists)
            const { data: recentAlbums } = await supabase
                .from('saved_albums')
                .select('last_accessed_at, albums(*, artists(*))')
                .eq('user_id', user.id)
                .order('last_accessed_at', { ascending: false })
                .limit(6);
            
            const { data: recentPlaylists } = await supabase
                .from('playlists')
                .select('*')
                .eq('user_id', user.id)
                .order('last_accessed_at', { ascending: false })
                .limit(6);

            // 🟢 FETCH RECENT ARTISTS
            const { data: recentArtists } = await supabase
                .from('saved_artists')
                .select('last_accessed_at, artists(*)')
                .eq('user_id', user.id)
                .order('last_accessed_at', { ascending: false })
                .limit(6);

            // 🟢 COMBINE ALL 3 TYPES
            const combined = [
                ...(recentAlbums?.map((a: any) => ({ ...a.albums, type: 'album', sortTime: a.last_accessed_at })) || []),
                ...(recentPlaylists?.map((p: any) => ({ ...p, type: 'playlist', sortTime: p.last_accessed_at })) || []),
                ...(recentArtists?.map((ar: any) => ({ ...ar.artists, type: 'artist', sortTime: ar.last_accessed_at })) || [])
            ].sort((a, b) => new Date(b.sortTime).getTime() - new Date(a.sortTime).getTime());

            // Add Liked Songs card at the start
            const likedCard = { id: 'liked', title: 'Liked Songs', image_path: null, type: 'playlist', user_id: user.id };
            setJumpBackIn([likedCard, ...combined]);

            // B. MADE FOR YOU
            const { data: generated } = await supabase
                .from('generated_playlists')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(5);
            if (generated) setMadeForYou(generated);

            // C. YOUR PLAYLISTS
            const { data: allPlaylists } = await supabase
                .from('playlists')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });
            if (allPlaylists) setYourPlaylists(allPlaylists);

            // D. AI SUGGESTIONS
            const { data: history } = await supabase
                .from('listening_history')
                .select('song_id, played_at, songs(*, albums(*, artists(*)))')
                .eq('user_id', user.id)
                .order('played_at', { ascending: false })
                .limit(20);

            if (history && history.length > 0) {
                const artistCounts: Record<string, number> = {};
                let topArtistName = '';
                let seedVector: any = null;

                history.forEach((h: any) => {
                    const artist = h.songs?.albums?.artists?.name;
                    const vector = h.songs?.embedding;
                    if (artist) {
                        artistCounts[artist] = (artistCounts[artist] || 0) + 1;
                        if (!topArtistName || artistCounts[artist] > artistCounts[topArtistName]) {
                            topArtistName = artist;
                            if (vector) seedVector = vector; 
                        }
                    }
                });

                if (topArtistName && seedVector) {
                    setAiTitle(`More like ${topArtistName}`);
                    let parsedVector: any = seedVector;
                    if (typeof seedVector === 'string') {
                        try { parsedVector = JSON.parse(seedVector); } catch {}
                    }

                    const { data: aiSongs } = await supabase.rpc("match_songs", {
                          query_embedding: parsedVector,
                          match_threshold: 0.6,
                          match_count: 20,
                          exclude_ids: []
                    });
                    
                    if (aiSongs && aiSongs.length > 0) {
                        const uniqueAlbumIds = new Set<string>();
                        aiSongs.forEach((s: any) => { if (s.album_id) uniqueAlbumIds.add(s.album_id); });
                        if (uniqueAlbumIds.size > 0) {
                            const { data: albumDetails } = await supabase
                                .from('albums')
                                .select('*, artists(*)')
                                .in('id', Array.from(uniqueAlbumIds))
                                .limit(10);
                            if (albumDetails) setSuggestedAlbums(albumDetails);
                        }
                    }
                }
            }
        }
    };

    fetchDashboard();
  }, [version, user]);

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
    scrollRef: React.RefObject<HTMLDivElement | null>,
    key: SectionKey,
    customRenderer?: (item: any) => React.ReactNode 
  ) => {
    const DefaultRenderer = (item: any) => {
       // 🟢 ADDED: Handle Artists
       if (item.type === 'artist') return <ArtistItem artist={item} />;
       if (key === 'yourPlaylists') return <PlaylistItem playlist={item} />;
       return <AlbumItem album={item} />;
    };

    return (
    <div className="relative group">
      {canScrollLeft[key] && (
        <button
          onClick={() =>
            scrollByAmount(scrollRef, -scrollRef.current!.clientWidth / 1.5, key)
          }
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10
                      bg-purple-300 text-black hover:bg-neutral-200 p-2 rounded-full
                      hidden group-hover:block shadow-md transition"
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
               {customRenderer ? customRenderer(item) : DefaultRenderer(item)}
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
                      bg-purple-300 text-black hover:bg-neutral-200 p-2 rounded-full
                      hidden group-hover:block shadow-md transition"
        >
          <HiChevronRight size={30} />
        </button>
      )}
    </div>
  )};

  /* =======================
        INIT
     ======================= */

  useEffect(() => {
    updateScrollButtons(jumpBackInRef, 'jumpBackIn');
    updateScrollButtons(madeForYouRef, 'madeForYou'); 
    updateScrollButtons(suggestedRef, 'suggestedAlbums');
    updateScrollButtons(yourPlaylistsRef, 'yourPlaylists');
    updateScrollButtons(newestRef, 'newestAlbums');
  }, [jumpBackIn, madeForYou, suggestedAlbums, yourPlaylists, newestAlbums]);

  /* =======================
        RENDER
     ======================= */

  return (
    <div className="p-8 select-none">
      <Greeting />
      <p className="mt-4 text-zinc-400">Music buzzing every day.</p>

      {/* 1. JUMP BACK IN */}
      {user && jumpBackIn.length > 0 && (
          <div className="mt-8">
            <h2 className="text-2xl font-semibold mb-4">Jump Back In</h2>
            {renderScroller(jumpBackIn, jumpBackInRef, 'jumpBackIn', (item) => {
                 // Liked Songs Card
                 if (item.id === 'liked') {
                    return (
                        <MediaContextMenu 
                            data={{ 
                                id: 'liked', 
                                title: 'Liked Songs', 
                                type: 'liked'
                            }}
                        >
                            <div className="w-full h-full">
                                <PlaylistItem playlist={item} />
                            </div>
                        </MediaContextMenu>
                    );
                 }
                 
                 // 🟢 Artist
                 if (item.type === 'artist') return <ArtistItem artist={item} />;

                 // Album
                 if (item.type === 'album') return <AlbumItem album={item} />;
                 
                 // Playlist
                 return <PlaylistItem playlist={item} />;
            })}
          </div>
      )}

      {/* 2. MADE FOR YOU */}
      {user && madeForYou.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-semibold mb-4">Made For You</h2>
            <p className="text-sm text-neutral-400 -mt-3 mb-4">
              Generated mixes based on your preferences
            </p>
            {renderScroller(madeForYou, madeForYouRef, 'madeForYou', (item) => (
                <MixPlaylistItem data={item} />
            ))}
          </div>
      )}

      {/* 3. AI SUGGESTIONS */}
      {user && suggestedAlbums.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-semibold mb-4">{aiTitle}</h2>
            {renderScroller(suggestedAlbums, suggestedRef, 'suggestedAlbums', (item) => (
                <AlbumItem album={item} />
            ))}
          </div>
      )}

      {/* 4. YOUR PLAYLISTS */}
      {user && yourPlaylists.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-semibold mb-4">Your Playlists</h2>
            {renderScroller(yourPlaylists, yourPlaylistsRef, 'yourPlaylists', (item) => (
                <PlaylistItem playlist={item} />
            ))}
          </div>
      )}

      {/* 5. NEWEST ALBUMS */}
      {newestAlbums.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-semibold mb-4">Newest Albums</h2>
            {renderScroller(newestAlbums, newestRef, 'newestAlbums', (item) => (
                <AlbumItem album={item} />
            ))}
          </div>
      )}
      
      {!user && newestAlbums.length === 0 && (
        <div className="mt-20 text-center">
            <h2 className="text-2xl font-bold mb-2">Welcome to MuseBuzz</h2>
            <p className="text-neutral-400">Log in to see your personalized content.</p>
        </div>
      )}
    </div>
  );
}