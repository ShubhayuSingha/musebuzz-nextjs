// src/hooks/usePlaybackSync.ts

import { useEffect, useRef, useCallback } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import usePlayerStore from '@/stores/usePlayerStore';

const usePlaybackSync = () => {
  const supabase = useSupabaseClient();
  const user = useUser();
  
  const { 
    restoreState // 🟢 The new action
  } = usePlayerStore();

  const isLoaded = useRef(false);

  // 1. LOAD STATE ON MOUNT
  useEffect(() => {
    if (!user || isLoaded.current) return;

    const loadState = async () => {
      const { data, error } = await supabase
        .from('playback_state')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { 
        console.error('Error loading playback state:', error);
        return;
      }

      if (data) {
        // A. Restore Entire State Atomicly
        if (data.queue_state && data.active_song_id) {
            const state = data.queue_state as any;
            
            // Extract all saved fields (with fallbacks)
            const savedIds = state.ids || [];
            const savedPriority = state.priority || [];
            const savedShuffleOrder = state.shuffledOrder || [];
            const savedIsShuffled = state.isShuffled || false;
            const savedIsPriority = state.isPlayingPriority || false;
            const savedContext = state.context || undefined;
            const savedLastActiveId = state.lastActiveId || undefined; // 🟢 GET THE BOOKMARK

            // ONE CALL TO RESTORE EVERYTHING CORRECTLY
            restoreState(
                savedIds, 
                savedPriority, 
                savedShuffleOrder,
                data.active_song_id,
                savedContext,
                savedIsShuffled,
                savedIsPriority,
                savedLastActiveId // 🟢 PASS THE BOOKMARK
            );
        }

        // B. Restore Timestamp
        if (data.progress_ms) {
            sessionStorage.setItem('restore_seek', (data.progress_ms / 1000).toString());
        }
      }
      isLoaded.current = true;
    };

    loadState();
  }, [user, supabase, restoreState]);

  // 2. SAVE STATE (Backup / Sidebar)
  const savePlaybackState = useCallback(async (currentProgressSec: number) => {
    if (!user) return;
    const state = usePlayerStore.getState(); 
    
    // Ensure this backup save matches PlayerContent
    const queueData = {
        ids: state.ids,
        priority: state.bucketB,
        shuffledOrder: state.shuffledOrder,
        isShuffled: state.isShuffled,
        isPlayingPriority: state.isPlayingPriority,
        lastActiveId: state.lastActiveContextId, // 🟢 SAVE THE BOOKMARK
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

    const { error } = await supabase
      .from('playback_state')
      .upsert(payload);

    if (error) {
      console.error('Failed to save playback state', error);
    }
  }, [user, supabase]);

  return { savePlaybackState };
};

export default usePlaybackSync;