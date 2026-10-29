'use client';

import React, { useEffect, useState, useRef } from 'react';
import DownloadButton from '@/components/DownloadButton';
import LikedContent from './LikedContent';
import { offlineDb } from '@/lib/offlineDb';
import useOfflineModeStore from '@/stores/useOfflineModeStore';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { RiWifiOffLine } from 'react-icons/ri';

interface LikedViewProps {
  initialSongs: any[];
}

export default function LikedView({ initialSongs }: LikedViewProps) {
  const [songs, setSongs] = useState<any[]>(initialSongs);
  const [mounted, setMounted] = useState(false);
  const { isOnline, isOfflineMode } = useOfflineModeStore();
  const supabase = useSupabaseClient();
  const user = useUser();
  const userId = user?.id;
  const lastFetchedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDeviceOffline = mounted && (!isOnline || isOfflineMode || (typeof navigator !== 'undefined' && !navigator.onLine));

  // Sync state if initialSongs prop updates with server data
  useEffect(() => {
    if (initialSongs && initialSongs.length > 0) {
      setSongs(initialSongs);
      lastFetchedUserIdRef.current = userId || 'server';
    }
  }, [initialSongs, userId]);

  useEffect(() => {
    if (!mounted) return;

    // Offline mode: load directly from IndexedDB
    if (isDeviceOffline) {
      const loadOfflineLiked = async () => {
        try {
          let targetUserId = userId;
          if (!targetUserId && offlineDb.liked_songs) {
            const firstRow = await offlineDb.liked_songs.toCollection().first();
            targetUserId = firstRow?.user_id;
          }

          if (offlineDb.liked_songs) {
            const likedRows = targetUserId 
              ? await offlineDb.liked_songs.where('user_id').equals(targetUserId).toArray()
              : await offlineDb.liked_songs.toArray();

            if (likedRows.length > 0) {
              likedRows.sort((a, b) => {
                if (a.song_order !== undefined && b.song_order !== undefined && a.song_order !== b.song_order) {
                  return a.song_order - b.song_order;
                }
                return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
              });

              const resolvedSongs = await Promise.all(
                likedRows.map(async (row) => {
                  const song = await offlineDb.songs.get(row.song_id);
                  if (!song) return null;
                  const albumData = song.albums;
                  return {
                    ...song,
                    author: albumData?.artists?.name || "Unknown Artist",
                    album_title: albumData?.title || "Unknown Album",
                    liked_created_at: row.created_at,
                    imageUrl: (song as any).imageUrl || (albumData as any)?.image_url || '/images/album-placeholder.png',
                    audio_url: song.audio_url,
                    albums: albumData
                  };
                })
              );

              const validSongs = resolvedSongs.filter(Boolean);
              if (validSongs.length > 0) {
                setSongs(validSongs);
                return;
              }
            }
          }

          // Fallback: check legacy offlineDb.playlists in case user hasn't synced yet
          let offlinePlaylist = userId ? await offlineDb.playlists.get(`liked_${userId}`) : undefined;
          if (!offlinePlaylist) {
            const fallback = await offlineDb.playlists.get('liked');
            if (fallback && (!fallback.user_id || fallback.user_id === userId)) {
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

    // Online mode: if initialSongs were already provided, don't re-fetch
    if (initialSongs && initialSongs.length > 0) {
      return;
    }

    // If online but initialSongs was empty, re-fetch exactly once for this authenticated user
    if (userId && lastFetchedUserIdRef.current !== userId) {
      lastFetchedUserIdRef.current = userId;
      const fetchClientLiked = async () => {
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
            .eq('user_id', userId)
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
        }
      };
      fetchClientLiked();
    }
  }, [isDeviceOffline, userId, mounted, initialSongs?.length, supabase]);

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
