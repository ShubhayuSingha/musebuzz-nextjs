'use client';

import React, { useEffect, useState } from 'react';
import DownloadButton from '@/components/DownloadButton';
import LikedContent from './LikedContent';
import { offlineDb } from '@/lib/offlineDb';
import useOfflineModeStore from '@/stores/useOfflineModeStore';
import useDownloadStore from '@/stores/useDownloadStore';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { RiWifiOffLine } from 'react-icons/ri';

interface LikedViewProps {
  initialSongs: any[];
}

export default function LikedView({ initialSongs }: LikedViewProps) {
  const [songs, setSongs] = useState<any[]>(initialSongs);
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { isOnline, isOfflineMode } = useOfflineModeStore();
  const { downloadedIds } = useDownloadStore();
  const supabase = useSupabaseClient();
  const user = useUser();

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDeviceOffline = mounted && (!isOnline || isOfflineMode || (typeof navigator !== 'undefined' && !navigator.onLine));

  useEffect(() => {
    if (!mounted) return;
    // If device is offline, load from offlineDb
    if (isDeviceOffline) {
      const loadOfflineLiked = async () => {
        try {
          let offlinePlaylist = user?.id ? await offlineDb.playlists.get(`liked_${user.id}`) : undefined;
          if (!offlinePlaylist) {
            const fallback = await offlineDb.playlists.get('liked');
            if (fallback && (!fallback.user_id || fallback.user_id === user?.id)) {
              offlinePlaylist = fallback;
            }
          }
          if (offlinePlaylist) {
            const mapped = (offlinePlaylist.playlist_songs || [])
              .sort((a, b) => a.song_order - b.song_order)
              .map((item) => {
                const song = item.songs;
                const albumData = song.albums;
                return {
                  ...song,
                  author: albumData?.artists?.name || "Unknown Artist",
                  album_title: albumData?.title || "Unknown Album",
                  liked_created_at: item.created_at,
                  imageUrl: (song as any).imageUrl || (albumData as any)?.image_url || '/images/album-placeholder.png',
                  audio_url: song.audio_url,
                  albums: albumData
                };
              });
            setSongs(mapped);
          } else {
            setSongs([]);
          }
        } catch (e) {
          console.warn('[LikedView] Failed to load offline liked songs:', e);
        }
      };
      loadOfflineLiked();
      return;
    }

    // Online mode: if initialSongs were provided, keep them
    if (initialSongs && initialSongs.length > 0) {
      setSongs(initialSongs);
      return;
    }

    // If online but initialSongs was empty, re-fetch on client if user exists
    if (user) {
      const fetchClientLiked = async () => {
        setIsLoading(true);
        try {
          const { data } = await supabase
            .from('liked_songs')
            .select(`
              *, 
              songs(
                *, 
                albums(
                  id, 
                  title, 
                  image_path, 
                  artists(id, name)
                )
              )
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

          if (data) {
            const mapped = data.map((item: any) => {
              const imagePath = item.songs?.albums?.image_path;
              let imageUrl = '/images/album-placeholder.png';
              if (imagePath) {
                const { data: imgData } = supabase.storage.from('images').getPublicUrl(imagePath);
                imageUrl = imgData?.publicUrl || imageUrl;
              }
              return {
                ...item.songs,
                author: item.songs?.albums?.artists?.name || "Unknown Artist",
                album_title: item.songs?.albums?.title || "Unknown Album",
                liked_created_at: item.created_at,
                imageUrl: imageUrl,
              };
            }).filter((s: any) => s.id);
            setSongs(mapped);
          }
        } catch (e) {
          console.warn('[LikedView] Client fetch failed:', e);
        } finally {
          setIsLoading(false);
        }
      };
      fetchClientLiked();
    }
  }, [isDeviceOffline, downloadedIds, initialSongs, user, mounted]);

  return (
    <div className="bg-black h-full w-full overflow-hidden overflow-y-auto">
      {/* HEADER */}
      <div className="bg-gradient-to-b from-purple-900 to-black w-full">
        <div className="p-6">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-x-5">
            {/* IMAGE */}
            <div className="
                relative h-32 w-32 lg:h-52 lg:w-52 rounded-md 
                overflow-hidden shadow-2xl flex-shrink-0 
                bg-gradient-to-br from-violet-600 to-blue-600 
                flex items-center justify-center
            ">
              <span className="text-white text-7xl lg:text-8xl select-none">❤️</span>
            </div>

            {/* TEXT CONTENT */}
            <div className="
                flex flex-col gap-y-2 mt-4 md:mt-0 mb-2 w-full flex-1 min-w-0 
                justify-end lg:h-52
            ">
              <div className="flex items-center gap-2">
                <p className="hidden md:block font-semibold text-sm text-neutral-200 uppercase tracking-wider">
                  Playlist
                </p>
                {isDeviceOffline && (
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-semibold flex items-center gap-1">
                    <RiWifiOffLine className="w-3 h-3" /> Offline
                  </span>
                )}
              </div>
              
              <h1 className="text-white font-bold drop-shadow-lg line-clamp-2 break-words leading-none pb-1 text-center md:text-left text-4xl sm:text-5xl lg:text-6xl">
                 Liked Songs
              </h1>

              <div className="flex items-center justify-center md:justify-start gap-x-2 mt-2">
                  <div className="relative h-6 w-6 rounded-full bg-neutral-500 flex items-center justify-center overflow-hidden">
                      <span className="text-[10px] text-black font-bold">U</span>
                  </div>
                  
                  <p className="text-neutral-300 text-sm font-bold hover:underline cursor-pointer">
                      You
                  </p>
                  
                  <span className="text-neutral-400 text-sm">•</span>
                  
                  <p className="text-neutral-400 text-sm font-medium">
                      {songs.length} {songs.length === 1 ? "song" : "songs"}
                  </p>
              </div>
            </div>

          </div>

          {/* ACTION CONTROLS ROW (Bottom part of header, on the left side) */}
          <div className="flex items-center justify-center md:justify-start gap-x-4 mt-6">
            <DownloadButton id="liked" type="playlist" title="Liked Songs" />
          </div>
        </div>
      </div>

      {/* SONG LIST */}
      <div className="flex flex-col gap-y-2 p-6 w-full">
        {isDeviceOffline && songs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-neutral-400 text-center px-4">
            <RiWifiOffLine className="w-12 h-12 text-neutral-600 mb-3" />
            <p className="text-white font-semibold text-lg mb-1">Liked Songs Not Downloaded</p>
            <p className="text-sm text-neutral-400 max-w-sm">
              You are currently offline. Switch back to online mode to download your Liked Songs for offline listening.
            </p>
          </div>
        ) : (
          <LikedContent songs={songs} />
        )}
      </div>
    </div>
  );
}
