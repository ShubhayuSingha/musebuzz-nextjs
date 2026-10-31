'use client';

import { useEffect } from "react";
import { useSessionContext } from "@supabase/auth-helpers-react";
import useLikeStore from "@/stores/useLikeStore";
import { offlineDb } from "@/lib/offlineDb";
import useOfflineModeStore from "@/stores/useOfflineModeStore";

const LikeDataLoader = () => {
  const { supabaseClient } = useSessionContext();
  const { setLikedIds, addLikedId, removeLikedId, isLoaded } = useLikeStore();

  useEffect(() => {
    // Define the secure fetch function
    const fetchLikedSongs = async () => {
      const isOffline = !useOfflineModeStore.getState().isOnline || 
                        useOfflineModeStore.getState().isOfflineMode || 
                        (typeof navigator !== 'undefined' && !navigator.onLine);

      if (isOffline) {
        try {
          const { data } = await supabaseClient.auth.getUser();
          const user = data?.user;
          if (user) {
            if (offlineDb.liked_songs) {
              const likedRows = await offlineDb.liked_songs.where('user_id').equals(user.id).toArray();
              if (likedRows.length > 0) {
                setLikedIds(likedRows.map((r) => r.song_id));
                return;
              }
            }
            const offlineLiked = (await offlineDb.playlists.get(`liked_${user.id}`)) || (await offlineDb.playlists.get('liked'));
            if (offlineLiked && (!offlineLiked.user_id || offlineLiked.user_id === user.id) && offlineLiked?.playlist_songs) {
              setLikedIds(offlineLiked.playlist_songs.map((ps: any) => ps.song_id || ps.songs?.id).filter(Boolean));
              return;
            }
          }
          setLikedIds([]);
        } catch {}
        return;
      }

      try {
        // 1. Securely get the verified user from the server
        const { data, error: userError } = await supabaseClient.auth.getUser();
        const user = data?.user;
        
        if (userError || !user) return;

        // 2. Fetch Data using the verified User ID with exact Supabase created_at & order
        const { data: songsData, error } = await supabaseClient
          .from('liked_songs')
          .select('song_id, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .abortSignal(AbortSignal.timeout(10000));

        if (songsData) {
          const ids = songsData.map((item: any) => item.song_id);
          setLikedIds(ids);

          // Populate offline liked_songs table preserving the EXACT Supabase dates & order
          if (offlineDb.liked_songs && user?.id) {
            try {
              await offlineDb.liked_songs.bulkPut(
                songsData.map((item: any, idx: number) => ({
                  user_id: user.id,
                  song_id: item.song_id,
                  created_at: item.created_at,
                  song_order: idx
                }))
              );
            } catch {}
          }

          // Auto-migrate any legacy pseudo-playlist to the pure relational table
          if (user?.id) {
            try {
              const legacyLiked = (await offlineDb.playlists.get(`liked_${user.id}`)) || (await offlineDb.playlists.get('liked'));
              if (legacyLiked && legacyLiked.playlist_songs && legacyLiked.playlist_songs.length > 0) {
                const { saveLikedSongsToDb } = await import('@/lib/offlineManager');
                await saveLikedSongsToDb(user.id, legacyLiked.playlist_songs.map((ps: any, idx: number) => ({
                  created_at: ps.created_at,
                  song_order: ps.song_order ?? idx,
                  song: ps.songs
                })));
              } else if (legacyLiked) {
                await offlineDb.playlists.delete(`liked_${user.id}`);
                await offlineDb.playlists.delete('liked');
              }
            } catch {}
          }
        }
      } catch (err) {
        console.warn("Like fetch failed, falling back to offline db:", err);
        try {
          const { data } = await supabaseClient.auth.getUser();
          const user = data?.user;
          if (user) {
            if (offlineDb.liked_songs) {
              const likedRows = await offlineDb.liked_songs.where('user_id').equals(user.id).toArray();
              if (likedRows.length > 0) {
                setLikedIds(likedRows.map((r) => r.song_id));
                return;
              }
            }
            const offlineLiked = (await offlineDb.playlists.get(`liked_${user.id}`)) || (await offlineDb.playlists.get('liked'));
            if (offlineLiked && (!offlineLiked.user_id || offlineLiked.user_id === user.id) && offlineLiked?.playlist_songs) {
              setLikedIds(offlineLiked.playlist_songs.map((ps: any) => ps.song_id || ps.songs?.id).filter(Boolean));
            }
          }
        } catch {}
      }
    };

    // A. Run immediately on mount (if we haven't loaded yet)
    if (!isLoaded) {
        fetchLikedSongs();
    }

    // B. Set up Realtime Subscription & Auth Listener (online only)
    const isOffline = !useOfflineModeStore.getState().isOnline || 
                      useOfflineModeStore.getState().isOfflineMode || 
                      (typeof navigator !== 'undefined' && !navigator.onLine);

    let channel: any = null;
    if (!isOffline) {
      channel = supabaseClient
        .channel('realtime_liked_songs')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'liked_songs' },
          (payload) => {
             if (payload.eventType === 'INSERT') {
               addLikedId(payload.new.song_id);
               // Auto-sync new song into offline storage if Liked Songs is downloaded
               import('@/stores/useDownloadStore').then(({ default: useDownloadStore }) => {
                 if (useDownloadStore.getState().downloadedIds.has('liked') && payload.new.user_id) {
                   import('@/lib/downloadService').then(({ autoSyncLikedSong }) => {
                     autoSyncLikedSong(supabaseClient, payload.new.user_id, payload.new.song_id, 'add');
                   });
                 }
               });
             }
             if (payload.eventType === 'DELETE') {
               removeLikedId(payload.old.song_id);
               // Auto-remove unliked song from offline storage if Liked Songs is downloaded
               import('@/stores/useDownloadStore').then(({ default: useDownloadStore }) => {
                 if (useDownloadStore.getState().downloadedIds.has('liked') && payload.old.user_id) {
                   import('@/lib/downloadService').then(({ autoSyncLikedSong }) => {
                     autoSyncLikedSong(supabaseClient, payload.old.user_id, payload.old.song_id, 'remove');
                   });
                 }
               });
             }
          }
        )
        .subscribe((status, err) => {
          if (status === 'CHANNEL_ERROR') {
            console.warn('[LikeDataLoader] Supabase Realtime not enabled for liked_songs. Auto-reconnect stopped:', err?.message || status);
            if (channel) supabaseClient.removeChannel(channel);
          }
        });
    }

    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN') {
            fetchLikedSongs(); // Re-run secure fetch on login
        }
        if (event === 'SIGNED_OUT') {
            setLikedIds([]); // Clear store on logout
        }
    });

    return () => {
      if (channel) supabaseClient.removeChannel(channel);
      subscription.unsubscribe();
    };

  }, [supabaseClient, setLikedIds, addLikedId, removeLikedId, isLoaded]);

  return null;
};

export default LikeDataLoader;