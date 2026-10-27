// src/hooks/usePlaybackSync.ts
import { useEffect, useRef, useCallback } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import usePlayerStore from '@/stores/usePlayerStore';
import { offlineDb } from '@/lib/offlineDb';

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

      // 1. If offline, load from local IndexedDB
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        try {
          data = await offlineDb.playback_state.get(user.id);
        } catch (e) {
          console.warn('[usePlaybackSync] Local state read failed:', e);
        }
      } else {
        // 2. Online: Query Supabase
        try {
          const { data: remoteData, error } = await supabase
            .from('playback_state')
            .select('*')
            .eq('user_id', user.id)
            .single();

          if (error && error.code !== 'PGRST116') {
            console.error('Error loading playback state:', error);
          } else if (remoteData) {
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
          // Network failed: fallback to local IndexedDB
          data = await offlineDb.playback_state.get(user.id);
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

        if (data.progress_ms) {
          sessionStorage.setItem('restore_seek', (data.progress_ms / 1000).toString());
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

    // Only make network request if currently online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const { error } = await supabase.from('playback_state').upsert(payload);
        if (error) console.error('Failed to save playback state', error);
      } catch (e) {
        // Silently catch network drops
      }
    }
  }, [user, supabase]);

  return { savePlaybackState };
};

export default usePlaybackSync;