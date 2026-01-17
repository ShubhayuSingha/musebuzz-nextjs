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
  const { removeFromContext, prependToContext } = usePlayerStore();

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
      removeFromContext(songId); 
      toast('Unliked!', { icon: '💔' });

      // 2. DB Request
      try {
        const { error } = await supabase
          .from('liked_songs')
          .delete()
          .eq('user_id', user.id)
          .eq('song_id', songId);

        if (error) throw error;
        
        // 3. Background Refresh (The Missing Piece)
        // This silently updates the server components to match the new DB state
        router.refresh();

      } catch (error: any) {
        // Revert Optimistic Update on Failure
        addLikedId(songId);
        prependToContext(songId);
        console.error("Unlike failed:", error.message);
        toast.error("Could not unlike");
      }

    } else {
      // --- LIKE ---

      // 1. Optimistic Update (Immediate Feedback)
      addLikedId(songId);
      prependToContext(songId); 
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

        // 3. Background Refresh (The Missing Piece)
        // This ensures the "Liked Songs" page will show this song immediately 
        // if you navigate there, without a full page reload.
        router.refresh();

      } catch (error: any) {
        if (error.code === '23505') {
            // Unique violation means it's already there. We are good.
            // We still refresh just to be safe.
            router.refresh();
        } else {
            // Genuine failure -> Revert UI
            removeLikedId(songId);
            removeFromContext(songId);
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