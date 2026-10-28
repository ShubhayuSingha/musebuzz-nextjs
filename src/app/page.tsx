// src/app/page.tsx
'use client';

import { useEffect, useRef, useState, useCallback, MouseEvent } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useUser } from '@supabase/auth-helpers-react'; 
import { withTimeout } from '@/lib/helpers';
import AlbumItem from '@/components/AlbumItem';
import PlaylistItem from '@/components/PlaylistItem';
import MixPlaylistItem from '@/components/MixPlaylistItem'; 
import ArtistItem from '@/components/ArtistItem'; 
import Greeting from '@/components/Greeting';
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi2';
import { motion } from 'framer-motion';
import { RiWifiOffLine } from 'react-icons/ri';
import { HiArrowDownTray } from 'react-icons/hi2';

import usePlaylistStore from '@/stores/usePlaylistStore';
import useOfflineModeStore from '@/stores/useOfflineModeStore';
import useDownloadStore from '@/stores/useDownloadStore';
import useAuthModalStore from '@/stores/useAuthModalStore';
import { offlineDb } from '@/lib/offlineDb';
import MediaContextMenu from "@/components/MediaContextMenu"; 

type SectionKey = 'jumpBackIn' | 'madeForYou' | 'suggestedAlbums' | 'yourPlaylists' | 'newestAlbums' | 'offlinePlaylists' | 'offlineAlbums';

const STAGGER = 0.08;
const INITIAL_DELAY = 0.25;
const DRAG_THRESHOLD = 5;

export default function Home() {
  const { version } = usePlaylistStore();
  const user = useUser();
  const authModal = useAuthModalStore();
  const { isOnline, isOfflineMode, toggleOfflineMode } = useOfflineModeStore();
  const { downloadedIds } = useDownloadStore();

  const isEffectivelyOffline = !isOnline || isOfflineMode || (typeof navigator !== 'undefined' && !navigator.onLine);

  // Global Loading State
  const [isLoading, setIsLoading] = useState(true);

  // Online Data States
  const [jumpBackIn, setJumpBackIn] = useState<any[]>([]);
  const [madeForYou, setMadeForYou] = useState<any[]>([]); 
  const [suggestedAlbums, setSuggestedAlbums] = useState<any[]>([]);
  const [aiTitle, setAiTitle] = useState("Suggested Albums");
  const [yourPlaylists, setYourPlaylists] = useState<any[]>([]);
  const [newestAlbums, setNewestAlbums] = useState<any[]>([]);

  // Offline Data States
  const [offlinePlaylists, setOfflinePlaylists] = useState<any[]>([]);
  const [offlineAlbums, setOfflineAlbums] = useState<any[]>([]);

  const [isDragging, setIsDragging] = useState(false);

  // Refs
  const jumpBackInRef = useRef<HTMLDivElement>(null);
  const madeForYouRef = useRef<HTMLDivElement>(null); 
  const suggestedRef = useRef<HTMLDivElement>(null);
  const yourPlaylistsRef = useRef<HTMLDivElement>(null);
  const newestRef = useRef<HTMLDivElement>(null);
  const offlinePlaylistsRef = useRef<HTMLDivElement>(null);
  const offlineAlbumsRef = useRef<HTMLDivElement>(null);

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
    offlinePlaylists: false,
    offlineAlbums: false,
  });

  const [canScrollRight, setCanScrollRight] = useState<Record<SectionKey, boolean>>({
    jumpBackIn: false,
    madeForYou: false,
    suggestedAlbums: false,
    yourPlaylists: false,
    newestAlbums: false,
    offlinePlaylists: false,
    offlineAlbums: false,
  });

  /* =======================
        OFFLINE DATA FETCH
     ======================= */

  const loadOfflineHomeData = useCallback(async () => {
    setIsLoading(true);
    if (!user) {
      setOfflinePlaylists([]);
      setOfflineAlbums([]);
      setIsLoading(false);
      return;
    }

    try {
      // 1. Only load playlists belonging strictly to THIS user
      const userPlaylists = await offlineDb.playlists
        .where('user_id')
        .equals(user.id)
        .toArray();

      // Check for user-scoped or matching liked playlist
      const userLiked = (await offlineDb.playlists.get(`liked_${user.id}`)) || (await offlineDb.playlists.get('liked'));
      if (userLiked && (!userLiked.user_id || userLiked.user_id === user.id)) {
        if (!userPlaylists.some(p => p.id === userLiked.id)) {
          userPlaylists.push(userLiked);
        }
      }

      // 2. Only load albums saved by THIS user in saved_albums
      let userAlbums: any[] = [];
      if (offlineDb.saved_albums) {
        const userSaved = await offlineDb.saved_albums
          .where('user_id')
          .equals(user.id)
          .toArray();
        let savedAlbumIds = userSaved.map(s => s.album_id);
        if (savedAlbumIds.length === 0) {
          const totalSaved = await offlineDb.saved_albums.count();
          if (totalSaved === 0) {
            const legacyAlbums = await offlineDb.albums.toArray();
            savedAlbumIds = legacyAlbums.map(a => a.id);
          }
        }
        if (savedAlbumIds.length > 0) {
          userAlbums = await offlineDb.albums.where('id').anyOf(savedAlbumIds).toArray();
        }
      } else {
        userAlbums = await offlineDb.albums.toArray();
      }

      // Format playlists. If 'liked' exists, sort it to the top!
      const formattedPlaylists = userPlaylists
        .map((p) => {
          const isLiked = p.id === 'liked' || p.id === `liked_${user.id}`;
          return {
            id: isLiked ? 'liked' : p.id,
            title: isLiked ? 'Liked Songs' : (p.title || 'Playlist'),
            image_path: p.image_path || null,
            image_url: p.image_path ? (p.image_url || null) : '/images/playlist-placeholder.jpg',
            user_id: p.user_id,
            type: 'playlist',
            downloaded_at: p.downloaded_at,
            songsCount: p.playlist_songs?.length || 0
          };
        })
        .sort((a, b) => {
          if (a.id === 'liked') return -1;
          if (b.id === 'liked') return 1;
          return (b.downloaded_at || 0) - (a.downloaded_at || 0);
        });

      // Format albums
      const formattedAlbums = userAlbums
        .map((a) => ({
          id: a.id,
          title: a.title,
          image_path: a.image_path || null,
          image_url: a.image_url || a.songs?.[0]?.imageUrl || null,
          genre: a.genre,
          artists: a.artists,
          type: 'album',
          downloaded_at: a.downloaded_at,
          songsCount: a.songs?.length || 0
        }))
        .sort((a, b) => (b.downloaded_at || 0) - (a.downloaded_at || 0));

      setOfflinePlaylists(formattedPlaylists);
      setOfflineAlbums(formattedAlbums);
    } catch (err) {
      console.warn("[Home] Failed to load offline items:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isEffectivelyOffline) {
      loadOfflineHomeData();
    }
  }, [isEffectivelyOffline, downloadedIds, loadOfflineHomeData, user]);

  /* =======================
        ONLINE DATA FETCH
     ======================= */

  useEffect(() => {
    if (isEffectivelyOffline) return;

    const fetchDashboard = async () => {
      setIsLoading(true);
      try {
        // 1. PUBLIC DATA (Fetch this for EVERYONE) with timeout protection
        const { data: newAlbums, error: newAlbumsErr } = await withTimeout(
          supabase
            .from('albums')
            .select('*, artists(*)')
            .order('created_at', { ascending: false })
            .limit(10),
          2500
        );
        if (newAlbumsErr) throw newAlbumsErr;
        if (newAlbums) setNewestAlbums(newAlbums);

        // 2. USER-ONLY DATA (Only fetch if logged in)
        if (user) {
            // A. JUMP BACK IN
            const { data: recentAlbums } = await withTimeout(
              supabase
                .from('saved_albums')
                .select('last_accessed_at, albums(*, artists(*))')
                .eq('user_id', user.id)
                .order('last_accessed_at', { ascending: false })
                .limit(6),
              2500
            ).catch(() => ({ data: [] }));
            
            const { data: recentPlaylists } = await withTimeout(
              supabase
                .from('playlists')
                .select('*')
                .eq('user_id', user.id)
                .order('last_accessed_at', { ascending: false })
                .limit(6),
              2500
            ).catch(() => ({ data: [] }));

            const { data: recentArtists } = await withTimeout(
              supabase
                .from('saved_artists')
                .select('last_accessed_at, artists(*)')
                .eq('user_id', user.id)
                .order('last_accessed_at', { ascending: false })
                .limit(6),
              2500
            ).catch(() => ({ data: [] }));

            const combined = [
                ...(recentAlbums?.map((a: any) => ({ ...a.albums, type: 'album', sortTime: a.last_accessed_at })) || []),
                ...(recentPlaylists?.map((p: any) => ({ ...p, type: 'playlist', sortTime: p.last_accessed_at })) || []),
                ...(recentArtists?.map((ar: any) => ({ ...ar.artists, type: 'artist', sortTime: ar.last_accessed_at })) || [])
            ].sort((a, b) => new Date(b.sortTime).getTime() - new Date(a.sortTime).getTime());

            const likedCard = { id: 'liked', title: 'Liked Songs', image_path: null, type: 'playlist', user_id: user.id };
            setJumpBackIn([likedCard, ...combined]);

            // B. MADE FOR YOU
            const { data: generated } = await withTimeout(
              supabase
                .from('generated_playlists')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(5),
              2500
            ).catch(() => ({ data: [] }));
            if (generated) setMadeForYou(generated);

            // C. YOUR PLAYLISTS
            const { data: allPlaylists } = await withTimeout(
              supabase
                .from('playlists')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false }),
              2500
            ).catch(() => ({ data: [] }));
            if (allPlaylists) setYourPlaylists(allPlaylists);

            // D. AI SUGGESTIONS
            const { data: history } = await withTimeout(
              supabase
                .from('listening_history')
                .select('song_id, played_at, songs(*, albums(*, artists(*)))')
                .eq('user_id', user.id)
                .order('played_at', { ascending: false })
                .limit(20),
              2500
            ).catch(() => ({ data: [] }));

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

                    const { data: aiSongs } = await withTimeout(
                      supabase.rpc("match_songs", {
                          query_embedding: parsedVector,
                          match_threshold: 0.6,
                          match_count: 20,
                          exclude_ids: []
                      }),
                      2500
                    ).catch(() => ({ data: [] }));
                    
                    if (aiSongs && aiSongs.length > 0) {
                        const uniqueAlbumIds = new Set<string>();
                        aiSongs.forEach((s: any) => { if (s.album_id) uniqueAlbumIds.add(s.album_id); });
                        if (uniqueAlbumIds.size > 0) {
                            const { data: albumDetails } = await withTimeout(
                              supabase
                                .from('albums')
                                .select('*, artists(*)')
                                .in('id', Array.from(uniqueAlbumIds))
                                .limit(10),
                              2500
                            ).catch(() => ({ data: [] }));
                            if (albumDetails) setSuggestedAlbums(albumDetails);
                        }
                    }
                }
            }
        }
      } catch (error) {
        console.warn("Failed to load dashboard data online, switching to offline fallback:", error);
        useOfflineModeStore.getState().setIsOnline(false);
        await loadOfflineHomeData();
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboard();
  }, [version, user, isEffectivelyOffline, loadOfflineHomeData]);

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
       if (item.type === 'artist') return <ArtistItem artist={item} />;
       if (key === 'yourPlaylists' || key === 'offlinePlaylists') return <PlaylistItem playlist={item} />;
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
        INIT & RESIZE OBSERVER
     ======================= */

  useEffect(() => {
    const checkAllScrolls = () => {
      if (isEffectivelyOffline) {
        updateScrollButtons(offlinePlaylistsRef, 'offlinePlaylists');
        updateScrollButtons(offlineAlbumsRef, 'offlineAlbums');
      } else {
        updateScrollButtons(jumpBackInRef, 'jumpBackIn');
        updateScrollButtons(madeForYouRef, 'madeForYou'); 
        updateScrollButtons(suggestedRef, 'suggestedAlbums');
        updateScrollButtons(yourPlaylistsRef, 'yourPlaylists');
        updateScrollButtons(newestRef, 'newestAlbums');
      }
    };

    // 1. Initial check when data loads
    checkAllScrolls();

    // 2. Watch for physical container resizing (e.g. Sidebar or Queue toggling)
    const observer = new ResizeObserver(() => {
      checkAllScrolls();
    });

    if (jumpBackInRef.current) observer.observe(jumpBackInRef.current);
    if (madeForYouRef.current) observer.observe(madeForYouRef.current);
    if (suggestedRef.current) observer.observe(suggestedRef.current);
    if (yourPlaylistsRef.current) observer.observe(yourPlaylistsRef.current);
    if (newestRef.current) observer.observe(newestRef.current);
    if (offlinePlaylistsRef.current) observer.observe(offlinePlaylistsRef.current);
    if (offlineAlbumsRef.current) observer.observe(offlineAlbumsRef.current);

    // 3. Fallback for entire window resizing
    window.addEventListener('resize', checkAllScrolls);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', checkAllScrolls);
    };
  }, [jumpBackIn, madeForYou, suggestedAlbums, yourPlaylists, newestAlbums, offlinePlaylists, offlineAlbums, isEffectivelyOffline]);

  /* =======================
        RENDER
     ======================= */

  // The Loading Screen Interceptor
  if (isLoading) {
    return (
      <div className="h-[calc(100vh-100px)] w-full flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
          <p className="text-neutral-400 text-sm font-medium animate-pulse">Loading MuseBuzz...</p>
        </div>
      </div>
    );
  }

  /* =======================
        OFFLINE VIEW
     ======================= */
  if (isEffectivelyOffline) {
    const hasOfflineContent = offlinePlaylists.length > 0 || offlineAlbums.length > 0;

    return (
      <div className="p-8 select-none">
        {/* Offline Banner / Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Offline Music
              </h1>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-semibold select-none">
                <RiWifiOffLine className="w-3.5 h-3.5" />
                Offline Mode
              </span>
            </div>
            <p className="mt-2 text-zinc-400 text-sm sm:text-base">
              Showing playlists and albums downloaded directly to this device.
            </p>
          </div>

          <button
            onClick={toggleOfflineMode}
            type="button"
            className="self-start md:self-auto px-4 py-2 rounded-full text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 transition active:scale-95 flex items-center gap-2 cursor-pointer"
          >
            <span>Switch to Online Mode</span>
          </button>
        </div>

        {/* Logged Out Offline State */}
        {!user && (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-16 h-16 rounded-full bg-neutral-800/80 border border-neutral-700 flex items-center justify-center text-neutral-300 mb-5 shadow-lg">
              <RiWifiOffLine size={32} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Login Required Offline</h2>
            <p className="text-zinc-400 text-sm max-w-md mb-6 leading-relaxed">
              Downloaded music and library items are tied to your personal account. Reconnect to the internet and log in to listen to your downloaded music.
            </p>
            <button
              onClick={() => authModal.onOpen('sign_in')}
              type="button"
              className="px-6 py-2.5 rounded-full font-semibold text-sm bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/50 transition active:scale-95 cursor-pointer"
            >
              Log in to MuseBuzz
            </button>
          </div>
        )}

        {/* Empty State (Logged in but no downloads) */}
        {user && !hasOfflineContent && (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-16 h-16 rounded-full bg-purple-900/30 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-5 shadow-lg shadow-purple-900/20">
              <HiArrowDownTray size={30} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">No Downloaded Music Found</h2>
            <p className="text-zinc-400 text-sm max-w-md mb-6 leading-relaxed">
              You haven&apos;t downloaded any playlists or albums for offline playback yet. Switch back online to download your favourite music.
            </p>
            <button
              onClick={toggleOfflineMode}
              type="button"
              className="px-6 py-2.5 rounded-full font-semibold text-sm bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/50 transition active:scale-95 cursor-pointer"
            >
              Switch to Online Mode
            </button>
          </div>
        )}

        {/* Row 1: Downloaded Playlists */}
        {offlinePlaylists.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-2xl font-semibold text-white">Downloaded Playlists</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-neutral-800 text-zinc-400 font-mono font-medium">
                {offlinePlaylists.length}
              </span>
            </div>
            {renderScroller(offlinePlaylists, offlinePlaylistsRef, 'offlinePlaylists', (item) => (
              <PlaylistItem playlist={item} />
            ))}
          </div>
        )}

        {/* Row 2: Downloaded Albums */}
        {offlineAlbums.length > 0 && (
          <div className="mt-12">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-2xl font-semibold text-white">Downloaded Albums</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-neutral-800 text-zinc-400 font-mono font-medium">
                {offlineAlbums.length}
              </span>
            </div>
            {renderScroller(offlineAlbums, offlineAlbumsRef, 'offlineAlbums', (item) => (
              <AlbumItem album={item} />
            ))}
          </div>
        )}
      </div>
    );
  }

  /* =======================
        ONLINE VIEW
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
                 
                 // Artist
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