// src/components/LikeButton.tsx

'use client';

import { useState } from "react";
import { useUser } from "@supabase/auth-helpers-react";
import { useRouter } from "next/navigation";
import { AiFillHeart, AiOutlineHeart } from "react-icons/ai";
import { toast } from "react-hot-toast";

import useAuthModalStore from "@/stores/useAuthModalStore";
import { supabase } from "@/lib/supabaseClient";
import useLikeStore from "@/stores/useLikeStore";
import usePlayerStore from "@/stores/usePlayerStore";

interface LikeButtonProps {
  songId: string;
}

const LikeButton: React.FC<LikeButtonProps> = ({ songId }) => {
  const router = useRouter();
  const { onOpen } = useAuthModalStore();
  const user = useUser();
  
  const { hasLikedId, addLikedId, removeLikedId } = useLikeStore();
  
  // 🟢 CHANGED: We now use syncLikedSongs instead of the old context helpers
  const { syncLikedSongs } = usePlayerStore();

  const isLiked = hasLikedId(songId);

  const handleLike = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();

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

  const Icon = isLiked ? AiFillHeart : AiOutlineHeart;

  return (
    <button 
      onClick={handleLike}
      className="hover:opacity-75 transition"
    >
      <Icon size={25} color={isLiked ? '#8f04b1ff' : 'white'} />
    </button>
  );
}

export default LikeButton;