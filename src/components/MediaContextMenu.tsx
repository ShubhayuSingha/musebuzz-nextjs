"use client";

import * as ContextMenu from "@radix-ui/react-context-menu"; 
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { AiOutlinePlus, AiOutlineDelete, AiOutlineUserAdd, AiOutlineUserDelete } from "react-icons/ai"; 
import { BsPersonFill } from "react-icons/bs";
import { MdQueueMusic } from "react-icons/md";

import usePlayerStore from "@/stores/usePlayerStore";
import useLibrary from "@/hooks/useLibrary"; 
import usePlaylistStore from "@/stores/usePlaylistStore"; 
import useAuthModalStore from "@/stores/useAuthModalStore";

import { useUser, useSupabaseClient } from "@supabase/auth-helpers-react";
import { useEffect, useState } from "react";

interface MediaContextMenuProps {
  children: React.ReactNode;
  data: {
    id: string;
    type: 'song' | 'album' | 'playlist' | 'artist';
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
  const { openDelete } = useAuthModalStore();

  const [isSaved, setIsSaved] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

  const finalSongId = songId || (data.type === 'song' ? data.id : undefined);
  const finalPlaylistId = playlistId || data.playlistId;

  // --- CHECK STATUS ---
  useEffect(() => {
    if (!user?.id) return;

    const checkStatus = async () => {
      if (data.type === 'album') {
          const saved = await library.checkIsSaved(data.id);
          setIsSaved(saved);
      }
      if (data.type === 'artist') {
          const following = await library.checkIsArtistSaved(data.id);
          setIsFollowing(following);
      }
    };

    checkStatus();
  }, [data.id, data.type, user, library]);

  // --- ACTIONS ---

  const handleFollow = async () => {
      if (!user) return toast.error("Log in to follow artists");
      // Optimistic update
      setIsFollowing(true); 
      await library.followArtist(data.id);
      refreshPlaylists(); 
      router.refresh();
  }

  const handleUnfollow = async () => {
      if (!user) return;
      // Optimistic update
      setIsFollowing(false);
      await library.unfollowArtist(data.id);
      refreshPlaylists();
      router.refresh();
  }

  const handleAddToLibrary = async () => {
    if (!user) return toast.error("Log in to save albums");
    setIsSaved(true); 
    await library.addAlbum(data.id); 
    refreshPlaylists(); 
    router.refresh(); 
  };

  const handleRemoveFromLibrary = async () => {
     if (!user) return;
     setIsSaved(false); 
     await library.removeAlbum(data.id); 
     refreshPlaylists(); 
     router.refresh(); 
  };

  const handleDeletePlaylist = () => {
      if (!user) return;
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
    if (data.type === 'artist') {
        router.push(`/artist/${data.id}`);
        return;
    }
    if (data.artist_id) {
        router.push(`/artist/${data.artist_id}`);
    }
  };

  const handleAddToQueue = () => {
     player.addToQueue(finalSongId || data.id); 
     toast.success('Added to Queue');
  };

  return (
    <ContextMenu.Root modal={false}>
      <ContextMenu.Trigger asChild>
        {children}
      </ContextMenu.Trigger>

      <ContextMenu.Portal>
        <ContextMenu.Content 
            // 🟢 FIX: Stop propagation of ALL pointer events.
            // This prevents the "click outside" listener on your Search Bar 
            // from firing when you are just clicking inside this menu.
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}

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
            {/* ARTIST */}
            {data.type === 'artist' && (
                isFollowing ? (
                    <ContextMenu.Item 
                        // 🟢 FIX: Use onSelect (Radix standard) instead of onClick
                        onSelect={handleUnfollow}
                        className="text-sm text-neutral-200 hover:bg-neutral-700 hover:text-white rounded-sm px-3 py-2 cursor-pointer outline-none flex items-center gap-x-3"
                    >
                        <AiOutlineUserDelete size={18} />
                        Unfollow Artist
                    </ContextMenu.Item>
                ) : (
                    <ContextMenu.Item 
                        onSelect={handleFollow}
                        className="text-sm text-neutral-200 hover:bg-neutral-700 hover:text-white rounded-sm px-3 py-2 cursor-pointer outline-none flex items-center gap-x-3"
                    >
                        <AiOutlineUserAdd size={18} />
                        Follow Artist
                    </ContextMenu.Item>
                )
            )}

            {/* PLAYLIST */}
            {data.type === 'playlist' && (
                <ContextMenu.Item 
                    onSelect={handleDeletePlaylist}
                    className="text-sm text-neutral-200 hover:bg-neutral-700 hover:text-white rounded-sm px-3 py-2 cursor-pointer outline-none flex items-center gap-x-3"
                >
                    <AiOutlineDelete size={18} />
                    Delete Playlist
                </ContextMenu.Item>
            )}

            {/* ALBUM */}
            {data.type === 'album' && (
                isSaved ? (
                    <ContextMenu.Item 
                        onSelect={handleRemoveFromLibrary}
                        className="text-sm text-neutral-200 hover:bg-neutral-700 hover:text-white rounded-sm px-3 py-2 cursor-pointer outline-none flex items-center gap-x-3"
                    >
                        <AiOutlineDelete size={18} />
                        Remove from Library
                    </ContextMenu.Item>
                ) : (
                    <ContextMenu.Item 
                        onSelect={handleAddToLibrary}
                        className="text-sm text-neutral-200 hover:bg-neutral-700 hover:text-white rounded-sm px-3 py-2 cursor-pointer outline-none flex items-center gap-x-3"
                    >
                        <AiOutlinePlus size={18} />
                        Add to Library
                    </ContextMenu.Item>
                )
            )}

            {/* SONG */}
            {data.type === 'song' && (
                 <>
                    <ContextMenu.Item 
                        onSelect={handleAddToQueue}
                        className="text-sm text-neutral-200 hover:bg-neutral-700 hover:text-white rounded-sm px-3 py-2 cursor-pointer outline-none flex items-center gap-x-3"
                    >
                        <MdQueueMusic size={18} />
                        Add to Queue
                    </ContextMenu.Item>

                    {finalPlaylistId && (
                         <ContextMenu.Item 
                            onSelect={handleRemoveFromPlaylist}
                            className="text-sm text-neutral-200 hover:bg-neutral-700 hover:text-white rounded-sm px-3 py-2 cursor-pointer outline-none flex items-center gap-x-3"
                        >
                            <AiOutlineDelete size={18} />
                            Remove from Playlist
                        </ContextMenu.Item>
                    )}
                 </>
            )}

            {/* COMMON: Go to Artist */}
            {(data.artist_id || data.type === 'artist') && (
                 <ContextMenu.Item 
                    onSelect={handleGoToArtist}
                    className="text-sm text-neutral-200 hover:bg-neutral-700 hover:text-white rounded-sm px-3 py-2 cursor-pointer outline-none flex items-center gap-x-3"
                >
                    <BsPersonFill size={18} />
                    {data.type === 'artist' ? 'Go to Artist Page' : 'Go to Artist'}
                </ContextMenu.Item>
            )}

        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
};

export default MediaContextMenu;