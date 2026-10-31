// src/hooks/useSearch.ts
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import Fuse from "fuse.js";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@supabase/auth-helpers-react";
import { offlineDb } from "@/lib/offlineDb";
import useOfflineModeStore from "@/stores/useOfflineModeStore";
import { withTimeout } from "@/lib/helpers";

export interface SearchSong {
  id: string;
  title: string;
  song_path: string;
  album_id?: string;
  language?: string;
  tags?: string[];
  imageUrl?: string | null;
  albums?: {
    id: string;
    title: string;
    image_path?: string | null;
    image_url?: string | null;
    genre?: string | null;
    artists?: {
      id?: string;
      name: string;
    };
  };
}

export interface SearchAlbum {
  id: string;
  title: string;
  image_path?: string | null;
  image_url?: string | null;
  genre?: string | null;
  artists?: {
    id?: string;
    name: string;
  };
}

export interface SearchArtist {
  id: string;
  name: string;
  image_path?: string | null;
  image_url?: string | null;
}

export interface SearchPlaylist {
  id: string;
  title: string;
  description?: string;
  _unified_image?: string | null;
  image_path?: string | null;
  image_url?: string | null;
  _itemType: 'playlist' | 'mix';
  song_ids?: string[];
  user_id?: string;
}

export interface CatalogData {
  songs: SearchSong[];
  albums: SearchAlbum[];
  artists: SearchArtist[];
  playlists: SearchPlaylist[];
  timestamp: number;
  userId?: string;
  isOffline: boolean;
}

// Module-level in-memory cache to prevent redundant fetches across Header/Search instances & navigations
let memoryCatalog: CatalogData | null = null;
let activeFetchPromise: Promise<CatalogData | null> | null = null;
const CATALOG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Extracts searchable catalog from local IndexedDB (Offline mode)
 */
async function extractOfflineCatalog(userId?: string): Promise<CatalogData> {
  try {
    const offlineSongs = await offlineDb.songs.toArray();
    const offlineAlbums = await offlineDb.albums.toArray();

    // Ensure all songs from downloaded albums are in the searchable list
    const songIdSet = new Set(offlineSongs.map((s) => s.id));
    for (const alb of offlineAlbums) {
      for (const s of (alb.songs || [])) {
        if (s && !songIdSet.has(s.id)) {
          songIdSet.add(s.id);
          offlineSongs.push({
            ...s,
            album_id: alb.id,
            albums: {
              id: alb.id,
              title: alb.title,
              image_path: alb.image_path,
              image_url: alb.image_url,
              genre: alb.genre,
              artists: alb.artists ? { id: alb.artists.id, name: alb.artists.name } : undefined
            }
          } as any);
        }
      }
    }

    // Extract unique artists from downloaded albums and songs
    const artistMap = new Map<string, SearchArtist>();
    for (const alb of offlineAlbums) {
      if (alb.artists?.name) {
        const key = alb.artists.id || alb.artists.name;
        artistMap.set(key, {
          id: alb.artists.id || key,
          name: alb.artists.name,
          image_path: alb.artists.image_path || alb.image_path || '',
          image_url: alb.image_url
        });
      }
    }
    for (const s of offlineSongs) {
      const art = s.albums?.artists;
      if (art?.name) {
        const key = art.id || art.name;
        if (!artistMap.has(key)) {
          artistMap.set(key, {
            id: art.id || key,
            name: art.name,
            image_path: s.albums?.image_path || '',
            image_url: s.imageUrl || s.albums?.image_url
          });
        }
      }
    }

    let offlinePlaylists = await offlineDb.playlists.toArray();
    if (userId) {
      offlinePlaylists = offlinePlaylists.filter((p) => !p.user_id || p.user_id === userId);
    }

    const mappedPlaylists: SearchPlaylist[] = offlinePlaylists
      .filter((p) => p.id !== 'liked' && !p.id.startsWith('liked_'))
      .map((p) => ({
        id: p.id,
        title: p.title,
        image_path: p.image_path,
        image_url: p.image_url,
        _unified_image: p.image_url || p.image_path,
        _itemType: 'playlist',
        user_id: p.user_id
      }));

    // Check if Liked Songs has rows saved locally
    const likedCount = offlineDb.liked_songs ? await offlineDb.liked_songs.count() : 0;
    if (likedCount > 0) {
      mappedPlaylists.unshift({
        id: 'liked',
        title: 'Liked Songs',
        description: 'Your favorite tracks',
        _unified_image: '/images/liked.png',
        _itemType: 'playlist'
      });
    }

    const mappedSongs: SearchSong[] = offlineSongs.map((s: any) => ({
      id: s.id,
      title: s.title,
      song_path: s.song_path,
      album_id: s.album_id,
      language: s.language || '',
      tags: s.tags || [],
      imageUrl: s.imageUrl || s.albums?.image_url,
      albums: s.albums ? {
        id: s.albums.id || '',
        title: s.albums.title || '',
        image_path: s.albums.image_path || '',
        image_url: s.albums.image_url || s.imageUrl || '',
        genre: s.albums.genre || '',
        artists: s.albums.artists ? {
          id: s.albums.artists.id,
          name: s.albums.artists.name
        } : undefined
      } : undefined
    }));

    const mappedAlbums: SearchAlbum[] = offlineAlbums.map((alb) => ({
      id: alb.id,
      title: alb.title,
      image_path: alb.image_path,
      image_url: alb.image_url,
      genre: alb.genre,
      artists: alb.artists ? { id: alb.artists.id, name: alb.artists.name } : undefined
    }));

    return {
      songs: mappedSongs,
      albums: mappedAlbums,
      artists: Array.from(artistMap.values()),
      playlists: mappedPlaylists,
      timestamp: Date.now(),
      userId,
      isOffline: true
    };
  } catch (e) {
    console.warn("[useSearch] Offline read failed:", e);
    return {
      songs: [],
      albums: [],
      artists: [],
      playlists: [],
      timestamp: Date.now(),
      userId,
      isOffline: true
    };
  }
}

/**
 * Fetches compact search catalog from Supabase (Online mode).
 * Selects only lightweight metadata columns (no 1536-dim vector embeddings or huge lyrics dumps)
 * Dropping payload from ~1.7 MB down to ~60 KB for fast <100ms loading.
 */
async function fetchOnlineCatalog(userId?: string): Promise<CatalogData> {
  const queries: any[] = [
    supabase
      .from('songs')
      .select('id, title, album_id, song_path, language, tags, albums(id, title, image_path, genre, artists(id, name))')
      .order('created_at', { ascending: false }),
    supabase
      .from('albums')
      .select('id, title, image_path, genre, artists(id, name)')
      .order('created_at', { ascending: false }),
    supabase
      .from('artists')
      .select('id, name, image_path')
      .order('created_at', { ascending: false })
  ];

  if (userId) {
    queries.push(
      supabase
        .from('playlists')
        .select('id, title, description, image_path, user_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
    );
    queries.push(
      supabase
        .from('generated_playlists')
        .select('id, title, description, image_url, user_id, song_ids')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5)
    );
  }

  // 5000ms safety timeout for the compact ~60KB payload
  const results = await withTimeout(Promise.all(queries), 5000);

  const songsData: SearchSong[] = results[0]?.data || [];
  const albumsData: SearchAlbum[] = results[1]?.data || [];
  const artistsData: SearchArtist[] = results[2]?.data || [];

  const mappedPlaylists: SearchPlaylist[] = [];
  if (userId) {
    // Liked Songs shortcut
    mappedPlaylists.push({
      id: 'liked',
      title: 'Liked Songs',
      description: 'Your favorite tracks',
      _unified_image: '/images/liked.png',
      _itemType: 'playlist',
      user_id: userId
    });

    const standardPlaylists = results[3]?.data || [];
    const genPlaylists = results[4]?.data || [];

    standardPlaylists.forEach((p: any) => {
      mappedPlaylists.push({
        ...p,
        _unified_image: p.image_path,
        _itemType: 'playlist'
      });
    });

    genPlaylists.forEach((p: any) => {
      mappedPlaylists.push({
        ...p,
        _unified_image: p.image_url,
        _itemType: 'mix'
      });
    });
  }

  return {
    songs: songsData,
    albums: albumsData,
    artists: artistsData,
    playlists: mappedPlaylists,
    timestamp: Date.now(),
    userId,
    isOffline: false
  };
}

/**
 * Loads catalog data with module caching & in-flight promise deduplication
 */
async function loadCatalogData(
  isOnline: boolean,
  isOfflineMode: boolean,
  userId?: string,
  forceRefresh = false
): Promise<CatalogData> {
  const effectivelyOffline =
    !isOnline ||
    isOfflineMode ||
    (typeof navigator !== 'undefined' && !navigator.onLine);

  // Return existing cache if fresh and matching mode/user
  if (
    !forceRefresh &&
    memoryCatalog &&
    Date.now() - memoryCatalog.timestamp < CATALOG_CACHE_TTL &&
    memoryCatalog.isOffline === effectivelyOffline &&
    memoryCatalog.userId === userId
  ) {
    return memoryCatalog;
  }

  // If a fetch is already in flight for the same mode, await it!
  if (activeFetchPromise) {
    const data = await activeFetchPromise;
    if (data && data.isOffline === effectivelyOffline) {
      return data;
    }
  }

  activeFetchPromise = (async () => {
    try {
      if (effectivelyOffline) {
        const offlineData = await extractOfflineCatalog(userId);
        memoryCatalog = offlineData;
        return offlineData;
      }

      try {
        const onlineData = await fetchOnlineCatalog(userId);
        memoryCatalog = onlineData;
        return onlineData;
      } catch (onlineErr) {
        console.warn("[useSearch] Online fetch failed, falling back to offline database:", onlineErr);
        const fallbackData = await extractOfflineCatalog(userId);
        memoryCatalog = fallbackData;
        return fallbackData;
      }
    } finally {
      activeFetchPromise = null;
    }
  })();

  const result = await activeFetchPromise;
  return (
    result || {
      songs: [],
      albums: [],
      artists: [],
      playlists: [],
      timestamp: Date.now(),
      isOffline: effectivelyOffline
    }
  );
}

export const useSearch = () => {
  const user = useUser();
  const userId = user?.id;
  const { isOnline, isOfflineMode } = useOfflineModeStore();

  const [catalog, setCatalog] = useState<CatalogData>(() => {
    return (
      memoryCatalog || {
        songs: [],
        albums: [],
        artists: [],
        playlists: [],
        timestamp: 0,
        isOffline: false
      }
    );
  });
  const [isLoading, setIsLoading] = useState(!memoryCatalog);
  const catalogLoadedRef = useRef(Boolean(memoryCatalog && memoryCatalog.songs.length > 0));

  const syncCatalog = useCallback(
    async (forceRefresh = false) => {
      try {
        const data = await loadCatalogData(isOnline, isOfflineMode, userId, forceRefresh);
        setCatalog(data);
        catalogLoadedRef.current = true;
      } catch (e) {
        console.warn("[useSearch] syncCatalog error:", e);
      } finally {
        setIsLoading(false);
      }
    },
    [isOnline, isOfflineMode, userId]
  );

  // Lazy pre-warm: runs on idle or after delay so it never blocks page hydration or route compilation
  useEffect(() => {
    let cancelled = false;

    // If cache is fresh, sync immediate state
    if (memoryCatalog && Date.now() - memoryCatalog.timestamp < CATALOG_CACHE_TTL) {
      setCatalog(memoryCatalog);
      setIsLoading(false);
      catalogLoadedRef.current = true;
      return;
    }

    let timeoutId: any;
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const idleId = (window as any).requestIdleCallback(
        () => {
          if (!cancelled) syncCatalog();
        },
        { timeout: 2500 }
      );
      return () => {
        cancelled = true;
        (window as any).cancelIdleCallback(idleId);
      };
    } else {
      timeoutId = setTimeout(() => {
        if (!cancelled) syncCatalog();
      }, 1200);
      return () => {
        cancelled = true;
        clearTimeout(timeoutId);
      };
    }
  }, [syncCatalog]);

  // When network status changes, revalidate catalog
  useEffect(() => {
    const handleNetworkChange = () => {
      syncCatalog(true);
    };

    window.addEventListener('online', handleNetworkChange);
    window.addEventListener('offline', handleNetworkChange);

    return () => {
      window.removeEventListener('online', handleNetworkChange);
      window.removeEventListener('offline', handleNetworkChange);
    };
  }, [syncCatalog]);

  const songs = catalog.songs;
  const albums = catalog.albums;
  const artists = catalog.artists;
  const playlists = catalog.playlists;

  // Fuzzy search instances with typo tolerance (threshold: 0.35)
  const fuseSongs = useMemo(
    () =>
      new Fuse(songs, {
        keys: [
          { name: 'title', weight: 1.0 },
          { name: 'albums.artists.name', weight: 0.8 },
          { name: 'albums.title', weight: 0.6 },
          { name: 'language', weight: 0.5 },
          { name: 'albums.genre', weight: 0.4 },
          { name: 'tags', weight: 0.4 }
        ],
        threshold: 0.35,
        ignoreLocation: true,
        minMatchCharLength: 1
      }),
    [songs]
  );

  const fuseAlbums = useMemo(
    () =>
      new Fuse(albums, {
        keys: [
          { name: 'title', weight: 1.0 },
          { name: 'artists.name', weight: 0.8 },
          { name: 'genre', weight: 0.4 }
        ],
        threshold: 0.35,
        ignoreLocation: true,
        minMatchCharLength: 1
      }),
    [albums]
  );

  const fuseArtists = useMemo(
    () =>
      new Fuse(artists, {
        keys: [{ name: 'name', weight: 1.0 }],
        threshold: 0.35,
        ignoreLocation: true,
        minMatchCharLength: 1
      }),
    [artists]
  );

  const fusePlaylists = useMemo(
    () =>
      new Fuse(playlists, {
        keys: [
          { name: 'title', weight: 1.0 },
          { name: 'description', weight: 0.5 }
        ],
        threshold: 0.35,
        ignoreLocation: true,
        minMatchCharLength: 1
      }),
    [playlists]
  );

  const searchAll = useCallback(
    (query: string) => {
      const trimmed = query?.trim();
      if (!trimmed) {
        return { songs: [], albums: [], artists: [], playlists: [] };
      }

      // If catalog was not yet loaded when typing began, trigger it immediately
      if (!catalogLoadedRef.current) {
        syncCatalog();
      }

      return {
        songs: fuseSongs.search(trimmed).map((r) => r.item).slice(0, 50),
        albums: fuseAlbums.search(trimmed).map((r) => r.item).slice(0, 3),
        artists: fuseArtists.search(trimmed).map((r) => r.item).slice(0, 1),
        playlists: fusePlaylists.search(trimmed).map((r) => r.item).slice(0, 2)
      };
    },
    [fuseSongs, fuseAlbums, fuseArtists, fusePlaylists, syncCatalog]
  );

  return {
    searchAll,
    isLoading,
    songs,
    albums,
    artists,
    playlists,
    ensureLoaded: syncCatalog
  };
};
