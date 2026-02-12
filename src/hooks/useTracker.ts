import { useEffect, useRef } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import usePlayerStore from '@/stores/usePlayerStore';
import useSongById from '@/hooks/useSongById';

const useTracker = () => {
  const supabase = useSupabaseClient();
  const user = useUser();
  const { activeId, activeContext, isPlaying } = usePlayerStore();
  const { song } = useSongById(activeId);

  // Refs
  const activeIdRef = useRef<string | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const accumulatedTimeRef = useRef<number>(0);
  const contextRef = useRef<string | null>(null);
  
  // 🟢 NEW: Store duration mapped to the specific ID
  // This prevents Song B's duration from overwriting Song A's duration
  const durationMapRef = useRef<Record<string, number>>({});

  // Helper: Get total listened
  const getTotalListened = () => {
    let currentSession = 0;
    if (startTimeRef.current) {
        currentSession = (Date.now() - startTimeRef.current) / 1000;
    }
    return Math.floor(accumulatedTimeRef.current + currentSession);
  };

  const logHistory = async (songId: string, listenedSeconds: number, context: string) => {
    if (!user || listenedSeconds < 5) return;

    // 🟢 Retrieve the duration SPECIFICALLY for this song ID from our map
    const totalSongDuration = durationMapRef.current[songId] || 0;
    
    // Debug log to see what's happening
    console.log(`[Tracker] Saving: ${songId} | Listened: ${listenedSeconds}s | Total: ${totalSongDuration}s`);

    const isCompleted = totalSongDuration > 0 && listenedSeconds >= (totalSongDuration * 0.9);

    const payload = {
        user_id: user.id,
        song_id: songId,
        context_type: context,
        played_at: new Date().toISOString(),
        duration_listened: listenedSeconds,
        skipped: listenedSeconds < 30,
        completed: isCompleted
    };

    supabase.from('listening_history').insert(payload).then(({ error }) => {
        if (error) console.error("Tracker Error:", error.message);
    });
  };

  // 1. Update Duration Map whenever song loads
  useEffect(() => {
    if (song?.id && song?.duration_seconds) {
        durationMapRef.current[song.id] = song.duration_seconds;
    }
  }, [song]);

  // 2. Play/Pause Timer Logic
  useEffect(() => {
    if (isPlaying) {
        startTimeRef.current = Date.now();
    } else {
        if (startTimeRef.current) {
            const sessionDuration = (Date.now() - startTimeRef.current) / 1000;
            accumulatedTimeRef.current += sessionDuration;
            startTimeRef.current = null;
        }
    }
  }, [isPlaying]);

  // 3. Song Change Logic
  useEffect(() => {
    // A. Log PREVIOUS Song
    if (activeIdRef.current && activeId !== activeIdRef.current) {
        const listened = getTotalListened();
        logHistory(activeIdRef.current, listened, contextRef.current || 'unknown');
        
        // Reset
        accumulatedTimeRef.current = 0;
        startTimeRef.current = isPlaying ? Date.now() : null;
    }

    // B. Setup NEW Song
    if (activeId) {
        activeIdRef.current = activeId;
        contextRef.current = activeContext?.type || 'unknown';
        if (isPlaying && !startTimeRef.current) {
            startTimeRef.current = Date.now();
        }
    }
  }, [activeId, activeContext, user]);

  // 4. Tab Close Logic
  useEffect(() => {
    const handleBeforeUnload = () => {
        if (activeIdRef.current) {
            const listened = getTotalListened();
            if (listened > 5) {
                logHistory(activeIdRef.current, listened, contextRef.current || 'unknown');
            }
        }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [user]);
};

export default useTracker;