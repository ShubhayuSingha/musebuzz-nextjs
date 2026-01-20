// src/components/AddToQueueButton.tsx

'use client';

import usePlayerStore from "@/stores/usePlayerStore";
import { BsPlusCircle } from "react-icons/bs";
import { toast } from "react-hot-toast";

interface AddToQueueButtonProps {
  songId: string;
}

const AddToQueueButton: React.FC<AddToQueueButtonProps> = ({ songId }) => {
  const addToQueue = usePlayerStore((state) => state.addToQueue);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Prevent the click from bubbling up to the row (which would play the song)
    e.stopPropagation();
    
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