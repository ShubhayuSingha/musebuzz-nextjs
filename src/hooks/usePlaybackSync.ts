// src/hooks/usePlaybackSync.ts
import { useEffect, useRef, useCallback } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import usePlayerStore from '@/stores/usePlayerStore';
import { offlineDb } from '@/lib/offlineDb';
import useOfflineModeStore from '@/stores/useOfflineModeStore';
import { withTimeout } from '@/lib/helpers';

const usePlaybackSync = () => {
  const supabase = useSupabaseClient();
  const user = useUser();
  
  const { restoreState } = usePlayerStore();
  const isLoaded = useRef(false);

  // 1. LOAD STATE ON MOUNT
  useEffect(() => {
    if (isLoaded.current) return;

    const isOffline = !useOfflineModeStore.getState().isOnline || 
                      useOfflineModeStore.getState().isOfflineMode || 
                      (typeof navigator !== 'undefined' && !navigator.onLine);

    if (!user && !isOffline) return;

    const loadState = async () => {
      let data: any = null;

      // 1. FAST-PATH: Load local IndexedDB state immediately (<5ms, zero network latency)
      try {
        if (user?.id) {
          data = await offlineDb.playback_state.get(user.id);
        }
        if (!data) {
          data = await offlineDb.playback_state.toCollection().first();
        }
      } catch (e) {
        console.warn('[usePlaybackSync] Local state read failed:', e);
      }

      // 2. If online, sync with Supabase in the background (with 2s timeout)
      if (!isOffline && user?.id) {
        try {
          const { data: remoteData, error } = await withTimeout(
            supabase
              .from('playback_state')
              .select('*')
              .eq('user_id', user.id)
              .maybeSingle(),
            4000
          ).catch((e) => {
            // Silently absorb abort/timeout errors to prevent uncaught network abort in dev Fast Refresh
            return { data: null, error: e };
          });

          if (!error && remoteData) {
            const existingLocal = data;
            const remoteTime = remoteData.updated_at ? new Date(remoteData.updated_at).getTime() : 0;
            const localTime = existingLocal?.updated_at 
              ? (typeof existingLocal.updated_at === 'number' ? existingLocal.updated_at : new Date(existingLocal.updated_at).getTime()) 
              : 0;

            if (localTime > remoteTime && existingLocal?.active_song_id) {
              // Local state on this device is NEWER than Supabase (e.g. track changed right before exit)
              // Local wins to avoid reverting to stale song! Push local state to cloud.
              data = existingLocal;
              supabase.from('playback_state').upsert({
                user_id: user.id,
                active_song_id: existingLocal.active_song_id,
                progress_ms: existingLocal.progress_ms || 0,
                is_playing: false,
                queue_state: existingLocal.queue_state,
                updated_at: new Date(localTime).toISOString()
              }).then(() => {}, () => {});
            } else {
              // Cloud is newer or equal: remote state wins
              data = remoteData;
              // Mirror to local IndexedDB, preserving active_song snapshot if present locally
              offlineDb.playback_state.put({
                user_id: user.id,
                active_song_id: remoteData.active_song_id,
                active_song: existingLocal?.active_song || undefined,
                is_playing: remoteData.is_playing,
                volume: remoteData.volume,
                progress_ms: remoteData.progress_ms,
                queue_state: remoteData.queue_state,
                repeat_mode: remoteData.repeat_mode,
                shuffle_mode: remoteData.shuffle_mode,
                updated_at: remoteTime || Date.now()
              }).catch(() => {});
            }
          }
        } catch {
          // Cloud sync failed: local state is already safely loaded
        }
      }

      if (data && data.queue_state && data.active_song_id) {
        // If active_song snapshot is present, ensure it's in offlineDb.songs for instant lookup
        if (data.active_song && data.active_song.id === data.active_song_id) {
          offlineDb.songs.get(data.active_song_id).then((existing) => {
            if (!existing) {
              offlineDb.songs.put(data.active_song).catch(() => {});
            }
          }).catch(() => {});
        }

        const state = data.queue_state as any;
        
        const savedIds = state.ids || [];               
        const savedPriority = state.priority || [];     
        const savedAutoplay = state.autoplay || [];     
        
        const savedShuffledOrder = state.shuffledOrder || [];
        const savedIsShuffled = state.isShuffled || false;
        
        const savedIsPriority = state.isPlayingPriority || false;
        const savedIsAutoplay = state.isPlayingAutoplay || false; 
        
        const savedContext = state.context || undefined;
        const savedLastActiveId = state.lastActiveId || undefined;

        restoreState(
          savedIds, 
          savedPriority, 
          savedShuffledOrder,
          data.active_song_id,
          savedContext,
          savedIsShuffled,
          savedIsPriority,
          savedIsAutoplay, 
          savedAutoplay,   
          savedLastActiveId,
          typeof data.is_playing === 'boolean' ? data.is_playing : undefined
        );

        if (data.progress_ms && data.active_song_id) {
          usePlayerStore.getState().setProgressMs(data.progress_ms);
          try {
            localStorage.setItem('musebuzz_last_seek', JSON.stringify({
              songId: data.active_song_id,
              seek: data.progress_ms / 1000,
              updatedAt: Date.now()
            }));
            sessionStorage.setItem('restore_seek', JSON.stringify({
              songId: data.active_song_id,
              seek: data.progress_ms / 1000
            }));
          } catch {}
        }
      }

      isLoaded.current = true;
    };

    loadState();

    // Listen for reconnection and push offline progress to cloud
    const handleOnline = async () => {
      if (!user?.id) return;
      try {
        const localState = await offlineDb.playback_state.get(user.id);
        if (localState && localState.active_song_id) {
          await supabase.from('playback_state').upsert({
            user_id: user.id,
            active_song_id: localState.active_song_id,
            progress_ms: localState.progress_ms || 0,
            is_playing: localState.is_playing || false,
            queue_state: localState.queue_state,
            updated_at: new Date().toISOString()
          });
          console.log('[usePlaybackSync] Reconnected: Pushed offline playback state to Supabase.');
        }
      } catch (e) {
        console.warn('[usePlaybackSync] Could not sync on reconnect:', e);
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [user, supabase, restoreState]);

  // 2. SAVE STATE
  const savePlaybackState = useCallback(async (currentProgressSec: number) => {
    const state = usePlayerStore.getState();
    const targetUserId = user?.id || 'local_user';
    if (!user && !state.activeId) return;
    
    const queueData = {
      ids: state.bucketA,
      priority: state.bucketB,
      autoplay: state.autoplay,
      shuffledOrder: state.shuffledOrder,
      isShuffled: state.isShuffled,
      isPlayingPriority: state.isPlayingPriority,
      isPlayingAutoplay: state.isPlayingAutoplay,
      lastActiveId: state.lastActiveContextId,
      context: state.activeContext
    };

    const payload = user ? {
      user_id: user.id,
      active_song_id: state.activeId,
      progress_ms: Math.floor(currentProgressSec * 1000),
      is_playing: state.isPlaying,
      queue_state: queueData,
      updated_at: new Date().toISOString(),
    } : null;

    // Retrieve local song snapshot if available
    let currentSongSnapshot: any = undefined;
    if (state.activeId) {
      try {
        currentSongSnapshot = await offlineDb.songs.get(state.activeId);
      } catch {}
    }

    // Always mirror to local IndexedDB (zero latency, offline safe)
    offlineDb.playback_state.put({
      user_id: targetUserId,
      active_song_id: state.activeId || undefined,
      active_song: currentSongSnapshot,
      is_playing: state.isPlaying,
      progress_ms: Math.floor(currentProgressSec * 1000),
      queue_state: queueData,
      updated_at: Date.now()
    }).catch(() => {});

    // Only make network request if truly online
    const isOffline = !useOfflineModeStore.getState().isOnline || 
                      useOfflineModeStore.getState().isOfflineMode || 
                      (typeof navigator !== 'undefined' && !navigator.onLine);

    if (!isOffline && payload) {
      try {
        const { error } = await withTimeout(supabase.from('playback_state').upsert(payload), 3000);
        if (error) console.warn('Failed to save playback state online:', error.message);
      } catch (e) {
        // Silently catch network drops
      }
    }
  }, [user, supabase]);

  return { savePlaybackState };
};

export default usePlaybackSync;