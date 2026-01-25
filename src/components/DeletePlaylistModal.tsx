'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";

import useAuthModalStore from "@/stores/useAuthModalStore";
import usePlaylistStore from "@/stores/usePlaylistStore";
import Modal from "./Modal"; // Reuse your existing Modal wrapper

const DeletePlaylistModal = () => {
  const { isDeleteOpen, closeDelete, deleteId } = useAuthModalStore();
  const { refreshPlaylists } = usePlaylistStore();
  const supabase = useSupabaseClient();
  const user = useUser();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);

  const onChange = (open: boolean) => {
    if (!open) closeDelete();
  }

  const handleDelete = async () => {
    if (!user || !deleteId) return;

    setIsLoading(true);

    const { error } = await supabase
        .from('playlists')
        .delete()
        .eq('id', deleteId)
        .eq('user_id', user.id);

    if (error) {
        toast.error(error.message);
    } else {
        toast.success('Playlist deleted');
        refreshPlaylists();
        
        // If we are currently ON that playlist page, go home
        if (window.location.pathname === `/playlist/${deleteId}`) {
            router.push('/');
        }
        
        closeDelete();
        router.refresh();
    }
    
    setIsLoading(false);
  }

  return (
    <Modal
      title="Delete Playlist"
      description="Are you sure? This action cannot be undone."
      isOpen={isDeleteOpen}
      onChange={onChange}
    >
        <div className="flex flex-col gap-y-4">
            <div className="flex items-center justify-end gap-x-4 w-full">
                {/* Cancel Button */}
                <button
                    disabled={isLoading}
                    onClick={closeDelete}
                    className="
                        px-4 
                        py-2 
                        text-neutral-400 
                        hover:text-white 
                        transition 
                        font-medium
                        disabled:opacity-50
                    "
                >
                    Cancel
                </button>

                {/* Confirm Button */}
                <button
                    disabled={isLoading}
                    onClick={handleDelete}
                    className="
                        px-6 
                        py-2 
                        bg-red-600 
                        hover:bg-red-700 
                        text-white 
                        rounded-full 
                        font-bold 
                        transition
                        disabled:opacity-50
                    "
                >
                    {isLoading ? 'Deleting...' : 'Delete'}
                </button>
            </div>
        </div>
    </Modal>
  );
}

export default DeletePlaylistModal;