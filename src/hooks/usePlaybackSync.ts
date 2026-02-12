import { useEffect, useRef, useCallback } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import usePlayerStore from '@/stores/usePlayerStore';

const usePlaybackSync = () => {
  const supabase = useSupabaseClient();
  const user = useUser();
  
  const { restoreState } = usePlayerStore();
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
        if (data.queue_state && data.active_song_id) {
            const state = data.queue_state as any;
            
            // Extract all saved fields
            const savedIds = state.ids || [];               // Bucket A (Context)
            const savedPriority = state.priority || [];     // Bucket B (Priority)
            const savedAutoplay = state.autoplay || [];     // Bucket C (AI) 🟢
            
            const savedShuffledOrder = state.shuffledOrder || [];
            const savedIsShuffled = state.isShuffled || false;
            
            const savedIsPriority = state.isPlayingPriority || false;
            const savedIsAutoplay = state.isPlayingAutoplay || false; // 🟢
            
            const savedContext = state.context || undefined;
            const savedLastActiveId = state.lastActiveId || undefined;

            // RESTORE EVERYTHING
            restoreState(
                savedIds, 
                savedPriority, 
                savedShuffledOrder,
                data.active_song_id,
                savedContext,
                savedIsShuffled,
                savedIsPriority,
                savedIsAutoplay, // 🟢
                savedAutoplay,   // 🟢
                savedLastActiveId
            );
        }

        // Restore Seek Position
        if (data.progress_ms) {
            sessionStorage.setItem('restore_seek', (data.progress_ms / 1000).toString());
        }
      }
      isLoaded.current = true;
    };

    loadState();
  }, [user, supabase, restoreState]);

  // 2. SAVE STATE
  const savePlaybackState = useCallback(async (currentProgressSec: number) => {
    if (!user) return;
    const state = usePlayerStore.getState(); 
    
    // Create the Backup Object
    const queueData = {
        ids: state.bucketA, // Save Context as 'ids' for compatibility
        priority: state.bucketB,
        autoplay: state.autoplay, // 🟢 Save AI Queue
        
        shuffledOrder: state.shuffledOrder,
        isShuffled: state.isShuffled,
        
        isPlayingPriority: state.isPlayingPriority,
        isPlayingAutoplay: state.isPlayingAutoplay, // 🟢 Save AI Mode status
        
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

    const { error } = await supabase.from('playback_state').upsert(payload);

    if (error) console.error('Failed to save playback state', error);
  }, [user, supabase]);

  return { savePlaybackState };
};

export default usePlaybackSync;