// src/hooks/useSearch.ts
import { useEffect, useState, useMemo } from "react";
import Fuse from "fuse.js";
import { supabase } from "@/lib/supabaseClient";

export const useSearch = () => {
  const [songs, setSongs] = useState<any[]>([]);
  const [albums, setAlbums] = useState<any[]>([]);
  const [artists, setArtists] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      
      const [songsRes, albumsRes, artistsRes] = await Promise.all([
        supabase
          .from('songs')
          // FIX IS HERE: Added 'image_path' to the nested albums select
          .select('*, albums(title, image_path, artists(name))') 
          .order('created_at', { ascending: false }),
        
        supabase
          .from('albums')
          .select('*, artists(name)')
          .order('created_at', { ascending: false }),

        supabase
          .from('artists')
          .select('*')
          .order('created_at', { ascending: false })
      ]);

      if (songsRes.data) setSongs(songsRes.data);
      if (albumsRes.data) setAlbums(albumsRes.data);
      if (artistsRes.data) setArtists(artistsRes.data);
      
      setIsLoading(false);
    };

    fetchData();
  }, []);

  const fuseSongs = useMemo(() => new Fuse(songs, {
    keys: [{ name: 'title', weight: 1 }, { name: 'albums.artists.name', weight: 0.5 }],
    threshold: 0.3,
  }), [songs]);

  const fuseAlbums = useMemo(() => new Fuse(albums, {
    keys: [{ name: 'title', weight: 1 }, { name: 'artists.name', weight: 0.5 }],
    threshold: 0.3,
  }), [albums]);

  const fuseArtists = useMemo(() => new Fuse(artists, {
    keys: ['name'],
    threshold: 0.3,
  }), [artists]);

  const searchAll = (query: string) => {
    if (!query) return { songs: [], albums: [], artists: [] };

    return {
      songs: fuseSongs.search(query).map(r => r.item).slice(0, 5),
      albums: fuseAlbums.search(query).map(r => r.item).slice(0, 3),
      artists: fuseArtists.search(query).map(r => r.item).slice(0, 1)
    };
  };

  return { searchAll, isLoading };
};