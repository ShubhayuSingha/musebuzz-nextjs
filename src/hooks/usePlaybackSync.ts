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
    if (!user || isLoaded.current) return;

    const loadState = async () => {
      let data: any = null;

      // 1. FAST-PATH: Load local IndexedDB state immediately (<5ms, zero network latency)
      try {
        data = await offlineDb.playback_state.get(user.id);
      } catch (e) {
        console.warn('[usePlaybackSync] Local state read failed:', e);
      }

      const isOffline = !useOfflineModeStore.getState().isOnline || 
                        useOfflineModeStore.getState().isOfflineMode || 
                        (typeof navigator !== 'undefined' && !navigator.onLine);

      // 2. If online, sync with Supabase in the background (with 2s timeout)
      if (!isOffline) {
        try {
          const { data: remoteData, error } = await withTimeout(
            supabase
              .from('playback_state')
              .select('*')
              .eq('user_id', user.id)
              .single(),
            2000
          );

          if (!error && remoteData) {
            data = remoteData;
            // Mirror to local IndexedDB
            offlineDb.playback_state.put({
              user_id: user.id,
              active_song_id: remoteData.active_song_id,
              is_playing: remoteData.is_playing,
              volume: remoteData.volume,
              progress_ms: remoteData.progress_ms,
              queue_state: remoteData.queue_state,
              repeat_mode: remoteData.repeat_mode,
              shuffle_mode: remoteData.shuffle_mode,
              updated_at: Date.now()
            }).catch(() => {});
          }
        } catch {
          // Cloud sync failed: local state is already safely loaded
        }
      }

      if (data && data.queue_state && data.active_song_id) {
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
          savedLastActiveId
        );

        if (data.progress_ms && data.active_song_id) {
          sessionStorage.setItem('restore_seek', JSON.stringify({
            songId: data.active_song_id,
            seek: data.progress_ms / 1000
          }));
        }
      }

      isLoaded.current = true;
    };

    loadState();

    // Listen for reconnection and push offline progress to cloud
    const handleOnline = async () => {
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
    if (!user) return;
    const state = usePlayerStore.getState(); 
    
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

    const payload = {
      user_id: user.id,
      active_song_id: state.activeId,
      progress_ms: Math.floor(currentProgressSec * 1000),
      is_playing: state.isPlaying,
      queue_state: queueData,
      updated_at: new Date().toISOString(),
    };

    // Always mirror to local IndexedDB (zero latency, offline safe)
    offlineDb.playback_state.put({
      user_id: user.id,
      active_song_id: state.activeId || undefined,
      is_playing: state.isPlaying,
      progress_ms: Math.floor(currentProgressSec * 1000),
      queue_state: queueData,
      updated_at: Date.now()
    }).catch(() => {});

    // Only make network request if truly online
    const isOffline = !useOfflineModeStore.getState().isOnline || 
                      useOfflineModeStore.getState().isOfflineMode || 
                      (typeof navigator !== 'undefined' && !navigator.onLine);

    if (!isOffline) {
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