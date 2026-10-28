'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HiMusicalNote, HiSignalSlash } from 'react-icons/hi2';
import { offlineDb, type OfflinePlaylist } from '@/lib/offlineDb';
import useOfflineModeStore from '@/stores/useOfflineModeStore';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import PlaylistHeader from './PlaylistHeader';
import PlaylistContent from './PlaylistContent';

interface PlaylistViewProps {
  initialPlaylist: any | null;
  initialSongs: any[];
  initialImageUrl: string;
  playlistId: string;
}

export default function PlaylistView({
  initialPlaylist,
  initialSongs,
  initialImageUrl,
  playlistId,
}: PlaylistViewProps) {
  const router = useRouter();
  const supabase = useSupabaseClient();
  const user = useUser();
  const [playlist, setPlaylist] = useState<any>(initialPlaylist);
  const [songs, setSongs] = useState<any[]>(initialSongs);
  const [imageUrl, setImageUrl] = useState<string>(initialImageUrl);
  const [isOfflineLoaded, setIsOfflineLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(!initialPlaylist);

  const { isOnline, isOfflineMode } = useOfflineModeStore();

  useEffect(() => {
    if (playlistId === 'liked') {
      router.replace('/liked');
      return;
    }

    const isDeviceOffline = !isOnline || isOfflineMode || (typeof navigator !== 'undefined' && !navigator.onLine);

    // If we already have server data and we are online, nothing else to do
    if (initialPlaylist && !isDeviceOffline) {
      setPlaylist(initialPlaylist);
      setSongs(initialSongs);
      setImageUrl(initialImageUrl);
      setIsLoading(false);
      return;
    }

    // Check IndexedDB for offline data, with online client-side fallback
    const loadPlaylistData = async () => {
      try {
        const offlinePlaylist: OfflinePlaylist | undefined = await offlineDb.playlists.get(playlistId);

        // Verify that this playlist belongs to current user if user_id is set
        if (offlinePlaylist) {
          if (offlinePlaylist.user_id && user?.id && offlinePlaylist.user_id !== user.id) {
            setIsLoading(false);
            return;
          }
          const mappedSongs = (offlinePlaylist.playlist_songs || [])
            .sort((a, b) => a.song_order - b.song_order)
            .map((item) => {
              const song = item.songs;
              const albumData = song.albums;
              return {
                ...song,
                author: albumData?.artists?.name || "Unknown Artist",
                album_title: albumData?.title || "Unknown Album",
                album_id: albumData?.id,
                added_at: item.created_at,
                imageUrl: (song as any).imageUrl || (albumData as any)?.image_url || offlinePlaylist.image_url || '/images/album-placeholder.png',
                audio_url: song.audio_url
              };
            });

          const resolvedCover = (offlinePlaylist.image_path && offlinePlaylist.image_url) 
            ? offlinePlaylist.image_url 
            : '/images/playlist-placeholder.jpg';

          setPlaylist(offlinePlaylist);
          setSongs(mappedSongs);
          setImageUrl(resolvedCover);
          setIsOfflineLoaded(true);
          setIsLoading(false);
          return;
        }

        // If not in offline DB and device is online, fetch directly on client
        if (!isDeviceOffline) {
          setIsLoading(true);
          const { data, error } = await supabase
            .from('playlists')
            .select(`
              *, 
              playlist_songs(
                created_at, 
                song_order, 
                songs(
                  *, 
                  albums(
                    id, 
                    title, 
                    image_path,
                    genre,
                    release_type,
                    artists(id, name)
                  )
                )
              )
            `)
            .eq('id', playlistId)
            .single();

          if (!error && data) {
            const clientSongs = (data.playlist_songs || [])
              .sort((a: any, b: any) => a.song_order - b.song_order)
              .map((item: any) => {
                const imagePath = item.songs?.albums?.image_path;
                let songImg = '/images/album-placeholder.png';
                if (imagePath) {
                  const { data: imgData } = supabase.storage.from('images').getPublicUrl(imagePath);
                  songImg = imgData?.publicUrl || songImg;
                }
                return {
                  ...item.songs,
                  author: item.songs?.albums?.artists?.name || "Unknown Artist",
                  album_title: item.songs?.albums?.title || "Unknown Album",
                  album_id: item.songs?.albums?.id,
                  added_at: item.created_at,
                  imageUrl: songImg
                };
              })
              .filter((song: any) => song.id);

            let resolvedUrl = '/images/playlist-placeholder.jpg';
            if (data.image_path) {
              const { data: imageData } = supabase.storage.from('playlist_images').getPublicUrl(data.image_path);
              resolvedUrl = imageData?.publicUrl || resolvedUrl;
            }

            setPlaylist(data);
            setSongs(clientSongs);
            setImageUrl(resolvedUrl);
            setIsLoading(false);
            return;
          }
        }
      } catch (err) {
        console.error('[PlaylistView] Failed to load playlist:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadPlaylistData();
  }, [initialPlaylist, playlistId, isOnline, isOfflineMode, supabase]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-400 gap-y-3">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">Loading playlist...</p>
      </div>
    );
  }

  // Not found online AND not downloaded offline
  if (!playlist) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center mb-4">
          <HiSignalSlash className="w-8 h-8 text-zinc-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Playlist Not Available Offline</h2>
        <p className="text-zinc-400 max-w-sm text-sm mb-6">
          This playlist has not been downloaded to your device yet. Connect to the internet to listen or browse your offline library.
        </p>
        <Link
          href="/library"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition-transform active:scale-95"
        >
          <HiMusicalNote className="w-4 h-4" />
          Go to Library
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-black h-full w-full overflow-hidden overflow-y-auto">
      <PlaylistHeader 
        playlist={playlist} 
        imageUrl={imageUrl} 
        fallbackImageUrl="/images/playlist-placeholder.jpg"
        songsCount={songs.length} 
      />

      <div className="flex flex-col gap-y-2 p-6 w-full">
        <PlaylistContent 
          songs={songs} 
          playlistId={playlist.id} 
          playlistTitle={playlist.title}
        />
      </div>
    </div>
  );
}
