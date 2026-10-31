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
import MusicLoader from '@/components/MusicLoader';
import { toast } from 'react-hot-toast';
import { checkConnectivity } from '@/hooks/useNetworkProbe';

type SectionKey = 'jumpBackIn' | 'madeForYou' | 'suggestedAlbums' | 'yourPlaylists' | 'newestAlbums' | 'offlinePlaylists' | 'offlineAlbums';

const STAGGER = 0.08;
const INITIAL_DELAY = 0.25;
const DRAG_THRESHOLD = 5;

export default function Home() {
  const { version } = usePlaylistStore();
  const user = useUser();
  const authModal = useAuthModalStore();
  const { isOnline, isOfflineMode, setOfflineMode, setIsOnline, toggleOfflineMode } = useOfflineModeStore();
  const { downloadedIds } = useDownloadStore();

  const isNetworkOffline = !isOnline || (typeof navigator !== 'undefined' && !navigator.onLine);

  // Global Loading State
  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedOnceRef = useRef(false);
  const lastFetchedTimeRef = useRef<number>(0);
  const userId = user?.id;

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

  const [hasOverflow, setHasOverflow] = useState<Record<SectionKey, boolean>>({
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
    if (!hasLoadedOnceRef.current) {
      setIsLoading(true);
    }
    if (!userId) {
      setOfflinePlaylists([]);
      setOfflineAlbums([]);
      setIsLoading(false);
      hasLoadedOnceRef.current = true;
      return;
    }

    try {
      // 1. Only load playlists belonging strictly to THIS user
      const rawPlaylists = await offlineDb.playlists
        .where('user_id')
        .equals(userId)
        .toArray();
      const userPlaylists = rawPlaylists.filter(p => p.id !== 'liked' && !p.id.startsWith('liked_'));

      // Check for relational liked songs
      let offlineLikedCount = 0;
      if (offlineDb.liked_songs) {
        offlineLikedCount = await offlineDb.liked_songs.where('user_id').equals(userId).count();
      }
      if (offlineLikedCount === 0) {
        const legacyLiked = (await offlineDb.playlists.get(`liked_${userId}`)) || (await offlineDb.playlists.get('liked'));
        offlineLikedCount = legacyLiked?.playlist_songs?.length || 0;
      }

      // 2. Only load albums saved by THIS user in saved_albums
      let userAlbums: any[] = [];
      if (offlineDb.saved_albums) {
        const userSaved = await offlineDb.saved_albums
          .where('user_id')
          .equals(userId)
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

      // Format playlists. If offline liked songs exist, prepend Liked Songs card to the top!
      const formattedPlaylists = userPlaylists
        .map((p) => ({
          id: p.id,
          title: p.title || 'Playlist',
          image_path: p.image_path || null,
          image_url: p.image_path ? (p.image_url || null) : '/images/playlist-placeholder.jpg',
          user_id: p.user_id,
          type: 'playlist',
          downloaded_at: p.downloaded_at,
          songsCount: p.playlist_songs?.length || 0
        }))
        .sort((a, b) => (b.downloaded_at || 0) - (a.downloaded_at || 0));

      if (offlineLikedCount > 0) {
        formattedPlaylists.unshift({
          id: 'liked',
          title: 'Liked Songs',
          image_path: null,
          image_url: '/images/liked.png',
          user_id: userId,
          type: 'playlist',
          downloaded_at: Date.now(),
          songsCount: offlineLikedCount
        });
      }

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
      hasLoadedOnceRef.current = true;
      setIsLoading(false);
    }
  }, [userId]);

  // Whether to show the dedicated, full-page Offline Music view:
  // 1. User deliberately enabled manual Offline Mode (isOfflineMode === true)
  // 2. OR device is offline AND no online music was ever loaded into memory
  const hasLoadedOnlineContent = newestAlbums.length > 0 || jumpBackIn.length > 0 || yourPlaylists.length > 0;
  const showFullOfflineScreen = isOfflineMode || (isNetworkOffline && !hasLoadedOnlineContent);

  useEffect(() => {
    if (showFullOfflineScreen || isNetworkOffline) {
      loadOfflineHomeData();
    }
  }, [showFullOfflineScreen, isNetworkOffline, loadOfflineHomeData]);

  /* =======================
        ONLINE DATA FETCH
     ======================= */

  const fetchDashboard = useCallback(async () => {
      // Only show full-page spinner on initial load; background updates keep existing UI visible
      if (!hasLoadedOnceRef.current) {
        setIsLoading(true);
      }
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
        hasLoadedOnceRef.current = true;
        lastFetchedTimeRef.current = Date.now();
        setIsLoading(false);
      }
    }, [user, loadOfflineHomeData]);

  useEffect(() => {
    if (isOfflineMode) return;
    const isHardwareOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (!isOnline && !isHardwareOnline) return;

    const now = Date.now();
    // Prevent refetching when switching back and forth between browser tabs (< 60s)
    if (hasLoadedOnceRef.current && now - lastFetchedTimeRef.current < 60000) {
      return;
    }

    fetchDashboard();
  }, [version, userId, isOfflineMode, isOnline, fetchDashboard]);

  // Real-time network reconnection listener: auto-refreshes online data without page reload
  useEffect(() => {
    const handleOnline = () => {
      useOfflineModeStore.getState().setIsOnline(true);
      lastFetchedTimeRef.current = 0;
      fetchDashboard();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [fetchDashboard]);

  const handleSwitchToOnline = async () => {
    toast.loading("Testing connection...", { id: "switch-online", duration: 1500 });
    const isActuallyOnline = await checkConnectivity(3000);
    if (!isActuallyOnline) {
      toast.error("No internet connection detected. Please reconnect to Wi-Fi to go online.", {
        id: "switch-online",
        icon: "📶"
      });
      return;
    }
    setOfflineMode(false);
    setIsOnline(true);
    lastFetchedTimeRef.current = 0;
    await fetchDashboard();
    toast.success("Switched to Online Mode", { id: "switch-online" });
  };

  const handleRetryConnection = async () => {
    toast.loading("Reconnecting...", { id: "retry-online", duration: 1500 });
    const isActuallyOnline = await checkConnectivity(3000);
    if (!isActuallyOnline) {
      toast.error("Still offline. Please check your network connection.", { id: "retry-online", icon: "📶" });
      return;
    }
    setIsOnline(true);
    lastFetchedTimeRef.current = 0;
    await fetchDashboard();
    toast.success("Connected to MuseBuzz online", { id: "retry-online" });
  };

  /* =======================
        SCROLL HELPERS
     ======================= */

  const updateScrollButtons = (
    ref: React.RefObject<HTMLDivElement | null>,
    key: SectionKey
  ) => {
    if (!ref.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = ref.current;
    const isOverflowing = scrollWidth > clientWidth + 2;

    setHasOverflow((prev) => (prev[key] === isOverflowing ? prev : { ...prev, [key]: isOverflowing }));
    setCanScrollLeft((prev) => (prev[key] === (scrollLeft > 2) ? prev : { ...prev, [key]: scrollLeft > 2 }));
    setCanScrollRight((prev) => {
      const canRight = isOverflowing && scrollLeft + clientWidth < scrollWidth - 2;
      return prev[key] === canRight ? prev : { ...prev, [key]: canRight };
    });
  };

  const scrollByAmount = (
    ref: React.RefObject<HTMLDivElement | null>,
    amount: number,
    key: SectionKey
  ) => {
    if (!ref.current) return;
    ref.current.scrollBy({ left: amount, behavior: 'smooth' });
    updateScrollButtons(ref, key);
    setTimeout(() => updateScrollButtons(ref, key), 150);
    setTimeout(() => updateScrollButtons(ref, key), 350);
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
        SECTION HEADER
     ======================= */

  const renderSectionHeader = (
    title: string,
    key: SectionKey,
    scrollRef: React.RefObject<HTMLDivElement | null>,
    options?: { subtitle?: string; count?: number }
  ) => {
    const isOverflowing = hasOverflow[key];

    return (
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold text-white tracking-tight">{title}</h2>
            {options?.count !== undefined && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-neutral-800 text-zinc-400 font-mono font-medium">
                {options.count}
              </span>
            )}
          </div>
          {options?.subtitle && (
            <p className="text-sm text-neutral-400 mt-1">{options.subtitle}</p>
          )}
        </div>

        {/* Navigation arrows beside the heading (visible only if there is overflow) */}
        {isOverflowing && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => scrollByAmount(scrollRef, -scrollRef.current!.clientWidth * 0.75, key)}
              disabled={!canScrollLeft[key]}
              className="w-8 h-8 rounded-full bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 flex items-center justify-center text-neutral-300 hover:text-white transition active:scale-95 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer shadow-sm"
              title="Scroll left"
              aria-label="Scroll left"
            >
              <HiChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => scrollByAmount(scrollRef, scrollRef.current!.clientWidth * 0.75, key)}
              disabled={!canScrollRight[key]}
              className="w-8 h-8 rounded-full bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 flex items-center justify-center text-neutral-300 hover:text-white transition active:scale-95 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer shadow-sm"
              title="Scroll right"
              aria-label="Scroll right"
            >
              <HiChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
    );
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
      <div className="relative -mx-4 px-4 md:mx-0 md:px-0">
        <div
          ref={scrollRef}
          onScroll={() => updateScrollButtons(scrollRef, key)}
          onMouseDown={(e) => onMouseDown(e, scrollRef)}
          onMouseMove={(e) => onMouseMove(e, scrollRef, key)}
          onMouseUp={() => onMouseUp(scrollRef, key)}
          onMouseLeave={() => onMouseLeave(scrollRef, key)}
          className={`
            flex gap-4 overflow-x-auto scrollbar-hide pb-4 select-none
            min-h-[260px] after:content-[''] after:w-2 after:flex-shrink-0 md:after:hidden
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
      </div>
    );
  };

  /* =======================
        INIT & RESIZE OBSERVER
     ======================= */

  useEffect(() => {
    const checkAllScrolls = () => {
      if (showFullOfflineScreen) {
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
    const t1 = setTimeout(checkAllScrolls, 100);
    const t2 = setTimeout(checkAllScrolls, 400);

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
      clearTimeout(t1);
      clearTimeout(t2);
      observer.disconnect();
      window.removeEventListener('resize', checkAllScrolls);
    };
  }, [jumpBackIn, madeForYou, suggestedAlbums, yourPlaylists, newestAlbums, offlinePlaylists, offlineAlbums, showFullOfflineScreen]);

  /* =======================
        RENDER
     ======================= */

  // The Loading Screen Interceptor
  if (isLoading) {
    return (
      <div className="h-[calc(100vh-100px)] w-full flex items-center justify-center bg-black p-4">
        <MusicLoader label="Loading MuseBuzz..." size="lg" />
      </div>
    );
  }

  /* =======================
        OFFLINE VIEW
     ======================= */
  if (showFullOfflineScreen) {
    const hasOfflineContent = offlinePlaylists.length > 0 || offlineAlbums.length > 0;

    return (
      <div className="px-4 py-6 md:p-8 select-none">
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
            onClick={handleSwitchToOnline}
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
              onClick={handleSwitchToOnline}
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
            {renderSectionHeader("Downloaded Playlists", "offlinePlaylists", offlinePlaylistsRef, {
              count: offlinePlaylists.length
            })}
            {renderScroller(offlinePlaylists, offlinePlaylistsRef, 'offlinePlaylists', (item) => (
              <PlaylistItem playlist={item} />
            ))}
          </div>
        )}

        {/* Row 2: Downloaded Albums */}
        {offlineAlbums.length > 0 && (
          <div className="mt-12">
            {renderSectionHeader("Downloaded Albums", "offlineAlbums", offlineAlbumsRef, {
              count: offlineAlbums.length
            })}
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
    <div className="px-4 py-6 md:p-8 select-none">
      <Greeting />
      <p className="mt-4 text-zinc-400">Music buzzing every day.</p>

      {/* Non-destructive offline banner when network drops while browsing */}
      {isNetworkOffline && (
        <div className="mt-4 mb-2 p-4 rounded-xl bg-purple-950/40 border border-purple-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20 text-purple-300">
              <RiWifiOffLine size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Network Disconnected</p>
              <p className="text-xs text-neutral-400">
                You are offline. Showing cached content. Only downloaded songs can be played offline.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOfflineMode(true)}
              type="button"
              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition active:scale-95 cursor-pointer"
            >
              View Downloaded Music
            </button>
            <button
              onClick={handleRetryConnection}
              type="button"
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-md transition active:scale-95 cursor-pointer"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* 1. JUMP BACK IN */}
      {user && jumpBackIn.length > 0 && (
          <div className="mt-8">
            {renderSectionHeader("Jump Back In", "jumpBackIn", jumpBackInRef)}
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
            {renderSectionHeader("Made For You", "madeForYou", madeForYouRef, {
              subtitle: "Generated mixes based on your preferences"
            })}
            {renderScroller(madeForYou, madeForYouRef, 'madeForYou', (item) => (
                <MixPlaylistItem data={item} />
            ))}
          </div>
      )}

      {/* 3. AI SUGGESTIONS */}
      {user && suggestedAlbums.length > 0 && (
          <div className="mt-12">
            {renderSectionHeader(aiTitle, "suggestedAlbums", suggestedRef)}
            {renderScroller(suggestedAlbums, suggestedRef, 'suggestedAlbums', (item) => (
                <AlbumItem album={item} />
            ))}
          </div>
      )}

      {/* 4. YOUR PLAYLISTS */}
      {user && yourPlaylists.length > 0 && (
          <div className="mt-12">
            {renderSectionHeader("Your Playlists", "yourPlaylists", yourPlaylistsRef)}
            {renderScroller(yourPlaylists, yourPlaylistsRef, 'yourPlaylists', (item) => (
                <PlaylistItem playlist={item} />
            ))}
          </div>
      )}

      {/* 5. NEWEST ALBUMS */}
      {newestAlbums.length > 0 && (
          <div className="mt-12">
            {renderSectionHeader("Newest Albums", "newestAlbums", newestRef)}
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