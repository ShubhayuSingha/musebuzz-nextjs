// src/hooks/useSongById.ts

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { offlineDb } from "@/lib/offlineDb";
import useOfflineModeStore from "@/stores/useOfflineModeStore";
import { withTimeout } from "@/lib/helpers";

const useSongById = (id?: string) => {
  const [isLoading, setIsLoading] = useState(false);
  const [song, setSong] = useState<any>(undefined);

  useEffect(() => {
    if (!id) {
      setSong(undefined);
      return;
    }

    setIsLoading(true);

    const fetchSong = async () => {
      // 1. FAST-PATH: Check local IndexedDB first for instant playback & zero flicker
      let hasLocal = false;
      try {
        let offlineSong = await offlineDb.songs.get(id);

        // If not directly in offlineDb.songs, check if it was cached in playback_state
        if (!offlineSong && offlineDb.playback_state) {
          const ps = await offlineDb.playback_state.toCollection().first();
          if (ps && (ps as any).active_song && (ps as any).active_song.id === id) {
            offlineSong = (ps as any).active_song;
          }
        }

        if (offlineSong) {
          setSong(offlineSong);
          setIsLoading(false);
          hasLocal = true;
        }
      } catch (e) {
        console.warn("[useSongById] IndexedDB read failed:", e);
      }

      const isOffline = !useOfflineModeStore.getState().isOnline || 
                        useOfflineModeStore.getState().isOfflineMode || 
                        (typeof navigator !== 'undefined' && !navigator.onLine);

      // If device is offline, we're completely done
      if (isOffline) {
        setIsLoading(false);
        return;
      }

      // 2. Online: Fetch fresh metadata from Supabase with timeout protection
      try {
        const { data, error } = await withTimeout(
          supabase
            .from('songs')
            .select('*, albums(*, artists(*))')
            .eq('id', id)
            .single(),
          2500
        );

        if (!error && data) {
          setSong(data);

          // 🟢 AUTO-CACHE METADATA TO INDEXEDDB:
          // Cache song metadata so if the user restarts the app offline,
          // title, artist, album, and artwork are known and immediately visible.
          try {
            const existing = await offlineDb.songs.get(id);
            const imagePath = data.albums?.image_path;
            let resolvedImage = existing?.imageUrl || data.imageUrl || data.albums?.image_url;
            if (!resolvedImage && imagePath) {
              const { data: imgData } = supabase.storage.from('images').getPublicUrl(imagePath);
              resolvedImage = imgData?.publicUrl;
            }

            await offlineDb.songs.put({
              ...data,
              id: data.id,
              title: data.title,
              author: data.albums?.artists?.name || data.author || undefined,
              song_path: data.song_path,
              duration_seconds: data.duration_seconds,
              audio_url: existing?.audio_url || data.audio_url || undefined,
              imageUrl: resolvedImage || undefined,
              lyrics_snippet: data.lyrics_snippet,
              downloaded_at: existing?.downloaded_at || undefined,
              albums: data.albums ? {
                id: data.albums.id,
                title: data.albums.title,
                image_path: data.albums.image_path,
                image_url: resolvedImage || undefined,
                genre: data.albums.genre,
                release_type: data.albums.release_type,
                artists: data.albums.artists ? {
                  id: data.albums.artists.id,
                  name: data.albums.artists.name
                } : undefined
              } : undefined
            });
          } catch (e) {
            console.warn('[useSongById] Failed to cache metadata:', e);
          }
        } else if (!hasLocal) {
          const offlineSong = await offlineDb.songs.get(id);
          if (offlineSong) setSong(offlineSong);
        }
      } catch (err) {
        // Network timeout / failure: fallback to local IndexedDB
        if (!hasLocal) {
          try {
            const offlineSong = await offlineDb.songs.get(id);
            if (offlineSong) setSong(offlineSong);
          } catch {}
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchSong();
  }, [id]);

  const songPath = useMemo(() => {
    if (!song) {
      return undefined;
    }

    // 1. If song already has cached audio_url, return it directly
    if (song.audio_url) {
      return song.audio_url;
    }

    if (!song.song_path) {
      return undefined;
    }
    
    // 2. Generate Supabase public URL
    const { data: songData } = supabase.storage
      .from('songs')
      .getPublicUrl(song.song_path);
      
    return songData.publicUrl;
  }, [song]);

  return { isLoading, song, songPath };
};

export default useSongById;