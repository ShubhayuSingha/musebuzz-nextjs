// src/components/LikeButton.tsx
"use client";

import { useEffect, useState } from "react";
import { useUser } from "@supabase/auth-helpers-react";
import { useRouter } from "next/navigation";
import { AiFillHeart, AiOutlineHeart } from "react-icons/ai";
import { toast } from "react-hot-toast";

import useAuthModalStore from "@/stores/useAuthModalStore";
import { supabase } from "@/lib/supabaseClient";
import useLikeStore from "@/stores/useLikeStore"; 

interface LikeButtonProps {
  songId: string;
}

const LikeButton: React.FC<LikeButtonProps> = ({ songId }) => {
  const router = useRouter();
  const { onOpen } = useAuthModalStore();
  const user = useUser();
  
  // Connect to the store
  const { refreshTrigger, toggleRefresh } = useLikeStore();

  const [isLiked, setIsLiked] = useState(false);

  useEffect(() => {
    if (!user?.id || !songId) {
      return;
    }

    const checkLikedStatus = async () => {
      const { data, error } = await supabase
        .from('liked_songs')
        .select('*')
        .eq('user_id', user.id)
        .eq('song_id', songId)
        .single();

      if (!error && data) {
        setIsLiked(true);
      } else {
        setIsLiked(false);
      }
    }

    checkLikedStatus();
    // Dependency added: runs whenever the trigger changes
  }, [songId, user?.id, refreshTrigger]);

  const handleLike = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();

    if (!user) {
      return onOpen('sign_in');
    }

    if (isLiked) {
      const { error } = await supabase
        .from('liked_songs')
        .delete()
        .eq('user_id', user.id)
        .eq('song_id', songId);

      if (error) {
        toast.error(error.message);
      } else {
        setIsLiked(false);
        // 👇 CHANGED: Custom Broken Heart Icon
        toast('Unliked!', { icon: '💔' });
      }
    } else {
      const { error } = await supabase
        .from('liked_songs')
        .insert({
          song_id: songId,
          user_id: user.id
        });

      if (error) {
        toast.error(error.message);
      } else {
        setIsLiked(true);
        // 👇 CHANGED: Custom Heart Icon
        toast('Liked!', { icon: '❤️' });
      }
    }
    
    // Signal sent: Tell everyone to update immediately
    toggleRefresh();
    
    router.refresh(); 
  }

  const Icon = isLiked ? AiFillHeart : AiOutlineHeart;

  return (
    <button 
      onClick={handleLike}
      className="
        hover:opacity-75 
        transition
      "
    >
      <Icon size={25} color={isLiked ? '#8f04b1ff' : 'white'} />
    </button>
  );
}

export default LikeButton;