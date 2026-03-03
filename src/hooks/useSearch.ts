// src/hooks/useSearch.ts
import { useEffect, useState, useMemo } from "react";
import Fuse from "fuse.js";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@supabase/auth-helpers-react";

export const useSearch = () => {
  const user = useUser();
  const [songs, setSongs] = useState<any[]>([]);
  const [albums, setAlbums] = useState<any[]>([]);
  const [artists, setArtists] = useState<any[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      
      const queries: any[] = [
        supabase.from('songs').select('*, albums(title, image_path, genre, artists(name))').order('created_at', { ascending: false }),
        supabase.from('albums').select('*, artists(name)').order('created_at', { ascending: false }),
        supabase.from('artists').select('*').order('created_at', { ascending: false })
      ];

      if (user?.id) {
        queries.push(
            supabase.from('playlists').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
        );
        // 🟢 FIX 1: Added .limit(5) so it only ever fetches the 5 most recent active mixes
        queries.push(
            supabase.from('generated_playlists').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5)
        );
      }

      const results = await Promise.all(queries);

      if (results[0].data) {
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

      if (results[1].data) setAlbums(results[1].data);
      if (results[2].data) setArtists(results[2].data);
      
      if (user?.id) {
         const standardPlaylists = results[3]?.data || [];
         const genPlaylists = results[4]?.data || [];
         const combinedPlaylists = [
            // 🟢 FIX 2: Tagged each item with its correct type so the UI knows how to route them
            ...standardPlaylists.map((p: any) => ({ ...p, _unified_image: p.image_path, _itemType: 'playlist' })),
            ...genPlaylists.map((p: any) => ({ ...p, _unified_image: p.image_url, _itemType: 'mix' })) 
         ];
         setPlaylists(combinedPlaylists);
      }
      
      setIsLoading(false);
    };

    fetchData();
  }, [user?.id]); 

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

  return { searchAll, isLoading };
};