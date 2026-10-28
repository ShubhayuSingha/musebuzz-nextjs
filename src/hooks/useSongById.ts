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
        const offlineSong = await offlineDb.songs.get(id);
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