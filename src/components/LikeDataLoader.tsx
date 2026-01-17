'use client';

import { useEffect } from "react";
import { useSessionContext } from "@supabase/auth-helpers-react";
import useLikeStore from "@/stores/useLikeStore";

const LikeDataLoader = () => {
  const { supabaseClient } = useSessionContext();
  const { setLikedIds, addLikedId, removeLikedId, isLoaded } = useLikeStore();

  useEffect(() => {
    // Define the secure fetch function
    const fetchLikedSongs = async () => {
      // 1. Securely get the verified user from the server
      const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
      
      if (userError || !user) return;

      // 2. Fetch Data using the verified User ID
      try {
        const { data, error } = await supabaseClient
          .from('liked_songs')
          .select('song_id')
          .eq('user_id', user.id)
          .abortSignal(AbortSignal.timeout(10000));

        if (data) {
          setLikedIds(data.map((item: any) => item.song_id));
        }
      } catch (err) {
        console.warn("Like fetch failed", err);
      }
    };

    // A. Run immediately on mount (if we haven't loaded yet)
    if (!isLoaded) {
        fetchLikedSongs();
    }

    // B. Set up Realtime Subscription & Auth Listener
    // This ensures we react if the user logs in/out or data changes
    const channel = supabaseClient
      .channel('realtime_liked_songs')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'liked_songs' },
        (payload) => {
           // We can't check user_id easily here without 'user' object in scope, 
           // but RLS ensures we only receive our own events anyway.
           if (payload.eventType === 'INSERT') addLikedId(payload.new.song_id);
           if (payload.eventType === 'DELETE') removeLikedId(payload.old.song_id);
        }
      )
      .subscribe();

    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN') {
            fetchLikedSongs(); // Re-run secure fetch on login
        }
        if (event === 'SIGNED_OUT') {
            setLikedIds([]); // Clear store on logout
        }
    });

    return () => {
      supabaseClient.removeChannel(channel);
      subscription.unsubscribe();
    };

  }, [supabaseClient, setLikedIds, addLikedId, removeLikedId, isLoaded]);

  return null;
};

export default LikeDataLoader;