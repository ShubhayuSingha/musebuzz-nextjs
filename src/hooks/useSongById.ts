// src/hooks/useSongById.ts

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { offlineDb } from "@/lib/offlineDb";
import useOfflineModeStore from "@/stores/useOfflineModeStore";

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
      const isOffline = !useOfflineModeStore.getState().isOnline || 
                        useOfflineModeStore.getState().isOfflineMode || 
                        (typeof navigator !== 'undefined' && !navigator.onLine);

      // 1. If device is offline, check local IndexedDB
      if (isOffline) {
        try {
          const offlineSong = await offlineDb.songs.get(id);
          if (offlineSong) {
            setSong(offlineSong);
          }
        } catch (e) {
          console.warn("[useSongById] IndexedDB read failed:", e);
        } finally {
          setIsLoading(false);
        }
        return;
      }

      // 2. Online: Fetch from Supabase
      try {
        const { data, error } = await supabase
          .from('songs')
          .select('*, albums(*, artists(*))')
          .eq('id', id)
          .single();

        if (error || !data) {
          // If online query fails, fallback to local IndexedDB
          const offlineSong = await offlineDb.songs.get(id);
          if (offlineSong) {
            setSong(offlineSong);
          } else {
            console.error(error);
          }
        } else {
          setSong(data);
        }
      } catch (err) {
        // Network catch: fallback to local IndexedDB
        const offlineSong = await offlineDb.songs.get(id);
        if (offlineSong) {
          setSong(offlineSong);
        } else {
          console.error(err);
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