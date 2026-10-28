// src/components/AddToQueueButton.tsx

'use client';

import usePlayerStore from "@/stores/usePlayerStore";
import useAuthModalStore from "@/stores/useAuthModalStore";
import { useUser } from "@supabase/auth-helpers-react";
import { BsPlusCircle } from "react-icons/bs";
import { toast } from "react-hot-toast";

interface AddToQueueButtonProps {
  songId: string;
}

const AddToQueueButton: React.FC<AddToQueueButtonProps> = ({ songId }) => {
  const addToQueue = usePlayerStore((state) => state.addToQueue);
  const user = useUser();
  const authModal = useAuthModalStore();

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Prevent the click from bubbling up to the row (which would play the song)
    e.stopPropagation();
    
    if (!user) {
      return authModal.onOpen('sign_in');
    }

    addToQueue(songId);
    toast.success('Added to queue');
  };

  return (
    <div 
      onClick={handleClick}
      className="text-neutral-400 hover:text-white cursor-pointer transition flex items-center justify-center"
      title="Add to queue"
    >
      <BsPlusCircle size={20} />
    </div>
  );
};

export default AddToQueueButton;