// src/components/LikeButton.tsx

'use client';

import { useState, useEffect } from "react";
import { useUser } from "@supabase/auth-helpers-react";
import { useRouter } from "next/navigation";
import { IoHeart, IoHeartOutline } from "react-icons/io5";
import { toast } from "react-hot-toast";

import useAuthModalStore from "@/stores/useAuthModalStore";
import { supabase } from "@/lib/supabaseClient";
import useLikeStore from "@/stores/useLikeStore";
import usePlayerStore from "@/stores/usePlayerStore";
import useOfflineModeStore from "@/stores/useOfflineModeStore";

interface LikeButtonProps {
  songId: string;
}

const LikeButton: React.FC<LikeButtonProps> = ({ songId }) => {
  const router = useRouter();
  const { onOpen } = useAuthModalStore();
  const user = useUser();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  
  const { hasLikedId, addLikedId, removeLikedId } = useLikeStore();
  
  // 🟢 CHANGED: We now use syncLikedSongs instead of the old context helpers
  const { syncLikedSongs } = usePlayerStore();

  const isLiked = hasLikedId(songId);

  const { isOnline, isOfflineMode } = useOfflineModeStore();
  const isOffline = mounted && (!isOnline || isOfflineMode);

  const handleLike = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();

    // Restriction: Cannot like/unlike songs while offline
    if (isOffline) {
      toast('Liking songs is disabled in offline mode', { icon: '⚠️' });
      return;
    }

    if (!user) {
      return onOpen('sign_in');
    }

    if (isLiked) {
      // --- UNLIKE ---
      
      // 1. Optimistic Update (Immediate Feedback)
      removeLikedId(songId); 
      // 🟢 SYNC: Remove from queue immediately if Context is Liked Songs
      syncLikedSongs(songId, 'remove'); 
      toast('Unliked!', { icon: '💔' });

      // 2. DB Request
      try {
        const { error } = await supabase
          .from('liked_songs')
          .delete()
          .eq('user_id', user.id)
          .eq('song_id', songId);

        if (error) throw error;
        
        // 🟢 AUTO-SYNC: If Liked Songs is downloaded, immediately remove from offline storage
        import('@/stores/useDownloadStore').then(({ default: useDownloadStore }) => {
          if (useDownloadStore.getState().downloadedIds.has('liked')) {
            import('@/lib/downloadService').then(({ autoSyncLikedSong }) => {
              autoSyncLikedSong(supabase, user.id, songId, 'remove');
            });
          }
        });

        // 3. Background Refresh
        router.refresh();

      } catch (error: any) {
        // Revert Optimistic Update on Failure
        addLikedId(songId);
        // 🟢 REVERT: Add it back to queue if DB failed
        syncLikedSongs(songId, 'add');
        console.error("Unlike failed:", error.message);
        toast.error("Could not unlike");
      }

    } else {
      // --- LIKE ---

      // 1. Optimistic Update (Immediate Feedback)
      addLikedId(songId);
      // 🟢 SYNC: Add to queue (Randomly if shuffled) if Context is Liked Songs
      syncLikedSongs(songId, 'add'); 
      toast('Liked!', { icon: '❤️' });

      // 2. DB Request
      try {
        const { error } = await supabase
          .from('liked_songs')
          .upsert(
            { 
              song_id: songId, 
              user_id: user.id 
            }, 
            { 
              onConflict: 'song_id, user_id', 
              ignoreDuplicates: true          
            }
          );

        if (error) throw error;

        // 🟢 AUTO-SYNC: If Liked Songs is downloaded, immediately fetch and save audio & metadata
        import('@/stores/useDownloadStore').then(({ default: useDownloadStore }) => {
          if (useDownloadStore.getState().downloadedIds.has('liked')) {
            import('@/lib/downloadService').then(({ autoSyncLikedSong }) => {
              autoSyncLikedSong(supabase, user.id, songId, 'add');
            });
          }
        });

        // 3. Background Refresh
        router.refresh();

      } catch (error: any) {
        if (error.code === '23505') {
            // Unique violation means it's already there. We are good.
            router.refresh();
        } else {
            // Genuine failure -> Revert UI
            removeLikedId(songId);
            // 🟢 REVERT: Remove from queue if DB failed
            syncLikedSongs(songId, 'remove');
            console.error("Like failed:", error.message);
            toast.error("Could not like");
        }
      }
    }
  }

  return (
    <button 
      type="button"
      onClick={handleLike}
      disabled={isOffline}
      className={`group/heart relative flex items-center justify-center p-1.5 rounded-full transition-all duration-200 ${
        isOffline 
          ? 'opacity-40 cursor-not-allowed' 
          : 'hover:bg-purple-600/10 cursor-pointer active:scale-85'
      }`}
      title={isOffline ? 'Liking songs is disabled while offline' : isLiked ? 'Unlike' : 'Like'}
      aria-label={isLiked ? "Unlike" : "Like"}
    >
      {isLiked ? (
        <IoHeart size={21} className="text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.75)] transition-transform duration-200 group-hover/heart:scale-110" />
      ) : (
        <IoHeartOutline size={21} className="text-neutral-400 group-hover/heart:text-purple-300 transition-all duration-200 group-hover/heart:scale-110" />
      )}
    </button>
  );
}

export default LikeButton;