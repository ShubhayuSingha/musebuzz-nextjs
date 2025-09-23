// src/hooks/useSongById.ts

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const useSongById = (id?: string) => {
  const [isLoading, setIsLoading] = useState(false);
  const [song, setSong] = useState<any>(undefined);

  useEffect(() => {
    if (!id) {
      return;
    }

    setIsLoading(true);

    const fetchSong = async () => {
      const { data, error } = await supabase
        .from('songs')
        // THIS IS THE CORRECTED LINE
        .select('*, albums(*, artists(*))')
        .eq('id', id)
        .single();

      if (error) {
        setIsLoading(false);
        return console.error(error);
      }

      setSong(data);
      setIsLoading(false);
    };

    fetchSong();
  }, [id]);

  const songPath = useMemo(() => {
    if (!song || !song.song_path) {
      return undefined;
    }
    
    const { data: songData } = supabase.storage
      .from('songs')
      .getPublicUrl(song.song_path);
      
    return songData.publicUrl;
  }, [song]);

  return { isLoading, song, songPath };
};

export default useSongById;