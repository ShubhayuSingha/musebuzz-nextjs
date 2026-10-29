import { useEffect, useState, useMemo, useCallback } from "react";
import Fuse from "fuse.js";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@supabase/auth-helpers-react";
import { offlineDb } from "@/lib/offlineDb";
import useOfflineModeStore from "@/stores/useOfflineModeStore";
import { withTimeout } from "@/lib/helpers";

export const useSearch = () => {
  const user = useUser();
  const [songs, setSongs] = useState<any[]>([]);
  const [albums, setAlbums] = useState<any[]>([]);
  const [artists, setArtists] = useState<any[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { isOnline, isOfflineMode } = useOfflineModeStore();

  const userId = user?.id;

  const loadOfflineData = useCallback(async () => {
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
      const artistMap = new Map<string, any>();
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

      const mappedPlaylists = offlinePlaylists
        .filter((p) => p.id !== 'liked' && !p.id.startsWith('liked_'))
        .map((p) => ({
          ...p,
          _unified_image: p.image_path || p.image_url,
          _itemType: 'playlist'
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
        } as any);
      }

      const processed = offlineSongs.map((s) => ({
        ...s,
        _searchableLyrics: s.lyrics_snippet ? String(s.lyrics_snippet) : ''
      }));

      setSongs(processed);
      setAlbums(offlineAlbums);
      setArtists(Array.from(artistMap.values()));
      setPlaylists(mappedPlaylists);
    } catch (e) {
      console.warn("[useSearch] Offline read failed:", e);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    let isCancelled = false;

    const fetchData = async () => {
      setIsLoading(true);

      const effectivelyOffline = !isOnline || 
                                 isOfflineMode || 
                                 (typeof navigator !== 'undefined' && !navigator.onLine);

      if (effectivelyOffline) {
        if (!isCancelled) await loadOfflineData();
        return;
      }
      
      const queries: any[] = [
        supabase.from('songs').select('*, albums(title, image_path, genre, artists(name))').order('created_at', { ascending: false }),
        supabase.from('albums').select('*, artists(name)').order('created_at', { ascending: false }),
        supabase.from('artists').select('*').order('created_at', { ascending: false })
      ];

      if (userId) {
        queries.push(
            supabase.from('playlists').select('*').eq('user_id', userId).order('created_at', { ascending: false })
        );
        queries.push(
            supabase.from('generated_playlists').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(5)
        );
      }

      try {
        const results = await withTimeout(Promise.all(queries), 2500);
        if (isCancelled) return;

        if (results[0]?.data) {
          const processedSongs = results[0].data.map((song: any) => {
            let cleanLyrics = "";
            if (song.lyrics_snippet) {
              try {
                const parsedLyrics = typeof song.lyrics_snippet === 'string' ? JSON.parse(song.lyrics_snippet) : song.lyrics_snippet;
                if (Array.isArray(parsedLyrics)) {
                  cleanLyrics = parsedLyrics.map((line: any) => 
                    `${line.text || ''} ${line.text_romanized || ''} ${line.text_native || ''}`
                  ).join(" ");
                } else {
                   cleanLyrics = String(song.lyrics_snippet);
                }
              } catch (e) {
                cleanLyrics = String(song.lyrics_snippet);
              }
            }
            return { ...song, _searchableLyrics: cleanLyrics };
          });

          setSongs(processedSongs);
        }

        if (results[1]?.data) setAlbums(results[1].data);
        if (results[2]?.data) setArtists(results[2].data);
        
        if (userId) {
           const standardPlaylists = results[3]?.data || [];
           const genPlaylists = results[4]?.data || [];
           const combinedPlaylists = [
              ...standardPlaylists.map((p: any) => ({ ...p, _unified_image: p.image_path, _itemType: 'playlist' })),
              ...genPlaylists.map((p: any) => ({ ...p, _unified_image: p.image_url, _itemType: 'mix' })) 
           ];
           setPlaylists(combinedPlaylists);
        }
      } catch (err) {
        console.warn("[useSearch] Online fetch failed, falling back to offline database:", err);
        if (!isCancelled) await loadOfflineData();
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    fetchData();

    const handleNetworkChange = () => {
      fetchData();
    };

    window.addEventListener('online', handleNetworkChange);
    window.addEventListener('offline', handleNetworkChange);

    return () => {
      isCancelled = true;
      window.removeEventListener('online', handleNetworkChange);
      window.removeEventListener('offline', handleNetworkChange);
    };
  }, [userId, isOnline, isOfflineMode, loadOfflineData]); 

  const fuseSongs = useMemo(() => new Fuse(songs, {
    keys: [
        { name: 'title', weight: 1.0 }, { name: 'albums.artists.name', weight: 0.8 }, { name: 'albums.title', weight: 0.6 },
        { name: 'language', weight: 0.5 }, { name: 'albums.genre', weight: 0.4 }, { name: 'tags', weight: 0.4 }, { name: '_searchableLyrics', weight: 0.3 }
    ],
    threshold: 0.3, ignoreLocation: true, 
  }), [songs]);

  const fuseAlbums = useMemo(() => new Fuse(albums, {
    keys: [{ name: 'title', weight: 1.0 }, { name: 'artists.name', weight: 0.7 }, { name: 'genre', weight: 0.5 }],
    threshold: 0.3, ignoreLocation: true,
  }), [albums]);

  const fuseArtists = useMemo(() => new Fuse(artists, {
    keys: ['name'], threshold: 0.3, ignoreLocation: true,
  }), [artists]);

  const fusePlaylists = useMemo(() => new Fuse(playlists, {
    keys: [{ name: 'title', weight: 1.0 }, { name: 'description', weight: 0.5 }],
    threshold: 0.3, ignoreLocation: true,
  }), [playlists]);

  const searchAll = (query: string) => {
    if (!query) return { songs: [], albums: [], artists: [], playlists: [] };

    return {
      songs: fuseSongs.search(query).map(r => r.item).slice(0, 50),
      albums: fuseAlbums.search(query).map(r => r.item).slice(0, 3),
      artists: fuseArtists.search(query).map(r => r.item).slice(0, 1),
      playlists: fusePlaylists.search(query).map(r => r.item).slice(0, 2)
    };
  };

  return { searchAll, isLoading, songs, playlists };
};