"use client";

import * as ContextMenu from "@radix-ui/react-context-menu"; 
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { AiOutlinePlus, AiOutlineDelete } from "react-icons/ai"; 
import { BsPersonFill } from "react-icons/bs";
import { MdQueueMusic } from "react-icons/md";

import usePlayerStore from "@/stores/usePlayerStore";
import useLibrary from "@/hooks/useLibrary"; 
import usePlaylistStore from "@/stores/usePlaylistStore"; 
import useAuthModalStore from "@/stores/useAuthModalStore"; // 🟢 Import Modal Store

import { useUser, useSupabaseClient } from "@supabase/auth-helpers-react";
import { useEffect, useState } from "react";

interface MediaContextMenuProps {
  children: React.ReactNode;
  data: {
    id: string;
    type: 'song' | 'album' | 'playlist';
    title?: string;
    artist_id?: string;
    playlistId?: string; 
  };
  songId?: string; 
  playlistId?: string; 
}

const MediaContextMenu: React.FC<MediaContextMenuProps> = ({ 
    children, 
    data, 
    songId,     
    playlistId  
}) => {
  const router = useRouter(); 
  const player = usePlayerStore();
  const library = useLibrary(); 
  const user = useUser();
  const supabase = useSupabaseClient();
  
  const { refreshPlaylists } = usePlaylistStore(); 
  const { openDelete } = useAuthModalStore(); // 🟢 Get openDelete action

  const [isSaved, setIsSaved] = useState(false);

  // Consolidate IDs
  const finalSongId = songId || (data.type === 'song' ? data.id : undefined);
  const finalPlaylistId = playlistId || data.playlistId;

  useEffect(() => {
    if (!user?.id || data.type !== 'album') return;

    const checkStatus = async () => {
      const { data: savedData, error } = await supabase
        .from('saved_albums')
        .select('*')
        .eq('user_id', user.id)
        .eq('album_id', data.id)
        .single();

      if (!error && savedData) {
        setIsSaved(true);
      } else {
        setIsSaved(false);
      }
    };

    checkStatus();
  }, [data.id, user, supabase, data.type]);

  // --- ACTIONS ---

  const handleAddToLibrary = async () => {
    if (!user) return toast.error("Log in to save albums");
    
    await library.addAlbum(data.id); 
    setIsSaved(true); 
    refreshPlaylists(); 
    router.refresh(); 
  };

  const handleRemoveFromLibrary = async () => {
     if (!user) return;
     
     await library.removeAlbum(data.id); 
     setIsSaved(false); 
     refreshPlaylists(); 
     router.refresh(); 
  };

  const handleDeletePlaylist = () => {
      if (!user) return;
      // 🟢 TRIGGER CUSTOM MODAL INSTEAD OF WINDOW.CONFIRM
      openDelete(data.id); 
  };

  const handleRemoveFromPlaylist = async () => {
    if (!user || !finalPlaylistId || !finalSongId) return;

    const { error } = await supabase
        .from('playlist_songs')
        .delete()
        .eq('playlist_id', finalPlaylistId)
        .eq('song_id', finalSongId);

    if (error) {
        toast.error('Failed to remove song');
    } else {
        toast.success('Removed from playlist');
        router.refresh();
    }
  };

  const handleGoToArtist = () => {
    if (data.artist_id) {
        router.push(`/artist/${data.artist_id}`);
    }
  };

  const handleAddToQueue = () => {
     player.addToQueue(finalSongId || data.id); 
     toast.success('Added to Queue');
  };

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div className="w-full h-auto">
            {children}
        </div>
      </ContextMenu.Trigger>

      <ContextMenu.Portal>
        <ContextMenu.Content 
            onMouseDown={(e) => e.stopPropagation()} 
            className="
                min-w-[220px] 
                bg-neutral-800 
                rounded-md 
                overflow-hidden 
                p-1 
                shadow-[0px_10px_38px_-10px_rgba(22,_23,_24,_0.35),_0px_10px_20px_-15px_rgba(22,_23,_24,_0.2)] 
                border 
                border-neutral-700
                z-[100]
            "
        >
            {/* --- PLAYLIST ACTIONS --- */}
            {data.type === 'playlist' && (
                <ContextMenu.Item 
                    onClick={handleDeletePlaylist}
                    className="text-sm text-neutral-200 hover:bg-neutral-700 hover:text-white rounded-sm px-3 py-2 cursor-pointer outline-none flex items-center gap-x-3"
                >
                    <AiOutlineDelete size={18} />
                    Delete Playlist
                </ContextMenu.Item>
            )}

            {/* --- ALBUM ACTIONS --- */}
            {data.type === 'album' && (
                isSaved ? (
                    <ContextMenu.Item 
                        onClick={handleRemoveFromLibrary}
                        className="text-sm text-neutral-200 hover:bg-neutral-700 hover:text-white rounded-sm px-3 py-2 cursor-pointer outline-none flex items-center gap-x-3"
                    >
                        <AiOutlineDelete size={18} />
                        Remove from Library
                    </ContextMenu.Item>
                ) : (
                    <ContextMenu.Item 
                        onClick={handleAddToLibrary}
                        className="text-sm text-neutral-200 hover:bg-neutral-700 hover:text-white rounded-sm px-3 py-2 cursor-pointer outline-none flex items-center gap-x-3"
                    >
                        <AiOutlinePlus size={18} />
                        Add to Library
                    </ContextMenu.Item>
                )
            )}

            {/* --- SONG ACTIONS --- */}
            {data.type === 'song' && (
                 <>
                    <ContextMenu.Item 
                        onClick={handleAddToQueue}
                        className="text-sm text-neutral-200 hover:bg-neutral-700 hover:text-white rounded-sm px-3 py-2 cursor-pointer outline-none flex items-center gap-x-3"
                    >
                        <MdQueueMusic size={18} />
                        Add to Queue
                    </ContextMenu.Item>

                    {finalPlaylistId && (
                         <ContextMenu.Item 
                            onClick={handleRemoveFromPlaylist}
                            className="text-sm text-neutral-200 hover:bg-neutral-700 hover:text-white rounded-sm px-3 py-2 cursor-pointer outline-none flex items-center gap-x-3"
                        >
                            <AiOutlineDelete size={18} />
                            Remove from Playlist
                        </ContextMenu.Item>
                    )}
                 </>
            )}

            {/* --- COMMON ACTIONS --- */}
            {data.artist_id && (
                 <ContextMenu.Item 
                    onClick={handleGoToArtist}
                    className="text-sm text-neutral-200 hover:bg-neutral-700 hover:text-white rounded-sm px-3 py-2 cursor-pointer outline-none flex items-center gap-x-3"
                >
                    <BsPersonFill size={18} />
                    Go to Artist
                </ContextMenu.Item>
            )}

        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
};

export default MediaContextMenu;