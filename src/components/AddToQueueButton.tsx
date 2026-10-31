// src/components/AddToQueueButton.tsx

'use client';

import usePlayerStore from "@/stores/usePlayerStore";
import useAuthModalStore from "@/stores/useAuthModalStore";
import { useUser } from "@supabase/auth-helpers-react";
import { LuCirclePlus } from "react-icons/lu";
import { toast } from "react-hot-toast";

interface AddToQueueButtonProps {
  songId: string;
}

const AddToQueueButton: React.FC<AddToQueueButtonProps> = ({ songId }) => {
  const addToQueue = usePlayerStore((state) => state.addToQueue);
  const user = useUser();
  const authModal = useAuthModalStore();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Prevent the click from bubbling up to the row (which would play the song)
    e.stopPropagation();
    
    if (!user) {
      return authModal.onOpen('sign_in');
    }

    addToQueue(songId);
    toast.success('Added to priority queue');
  };

  return (
    <button 
      type="button"
      onClick={handleClick}
      className="group/queue relative flex items-center justify-center p-1.5 rounded-full text-neutral-400 hover:text-purple-300 hover:bg-purple-600/15 active:scale-90 transition-all duration-200 cursor-pointer"
      title="Add to priority queue"
      aria-label="Add to priority queue"
    >
      <LuCirclePlus size={19} className="transition-transform duration-200 group-hover/queue:scale-110" />
    </button>
  );
};

export default AddToQueueButton;
