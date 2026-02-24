// src/components/MediaContextMenu.tsx
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
import { saveMixToLibrary } from '@/actions/saveMix'; 

import { useUser, useSupabaseClient } from "@supabase/auth-helpers-react";
import { useEffect, useState } from "react";

interface MediaContextMenuProps {
  children: React.ReactNode;
  data: {
    id: string;
    type: 'song' | 'album' | 'playlist' | 'artist' | 'generated_playlist' | 'liked';
    title?: string;
    artist_id?: string;
    playlistId?: string; 
    song_ids?: string[]; 
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
      setIsFollowing(true); 
      await library.followArtist(data.id);
      refreshPlaylists(); 
      router.refresh();
  }

  const handleUnfollow = async () => {
      if (!user) return;
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

  const handleSaveMix = async () => {
    if (!user) return toast.error("Log in to save mixes");
    const toastId = toast.loading('Saving to library...');
    try {
      const result = await saveMixToLibrary(data.id);
      if (result.success) {
        toast.success(`Saved as "${result.title}"`, { id: toastId });
        refreshPlaylists();
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to save mix', { id: toastId });
      }
    } catch (error) {
      toast.error('Something went wrong', { id: toastId });
    }
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

  // 🟢 UPDATED: Uses addManyToQueue to push items into Bucket B (Priority)
  const handleAddToQueue = async () => {
     // 1. Single Song
     if (data.type === 'song') {
        player.addToQueue(finalSongId || data.id); 
        toast.success('Added to Queue');
        return;
     }

     // 2. Generated Mix
     if (data.type === 'generated_playlist' && data.song_ids) {
        player.addManyToQueue(data.song_ids); 
        toast.success('Added Mix to Queue');
        return;
     }

     // 3. Personal Playlist
     if (data.type === 'playlist') {
        const { data: songs } = await supabase
            .from('playlist_songs')
            .select('song_id')
            .eq('playlist_id', data.id)
            .order('song_order', { ascending: true });
        
        if (songs && songs.length > 0) {
            const idsToAdd = songs.map(s => s.song_id);
            player.addManyToQueue(idsToAdd);
            toast.success('Added Playlist to Queue');
        } else {
            toast.error('Playlist is empty');
        }
        return;
     }

     // 4. Album
     if (data.type === 'album') {
        const { data: songs } = await supabase
            .from('songs')
            .select('id')
            .eq('album_id', data.id)
            .order('created_at', { ascending: true });
        
        if (songs && songs.length > 0) {
            const idsToAdd = songs.map(s => s.id);
            player.addManyToQueue(idsToAdd);
            toast.success('Added Album to Queue');
        } else {
            toast.error('Album is empty');
        }
        return;
     }

     // 5. Liked Songs
     if (data.type === 'liked') {
        if (!user) return toast.error("Log in to access liked songs");
        
        const { data: songs } = await supabase
             .from('liked_songs')
             .select('song_id')
             .eq('user_id', user.id)
             .order('created_at', { ascending: false });

        if (songs && songs.length > 0) {
             const idsToAdd = songs.map(s => s.song_id);
             player.addManyToQueue(idsToAdd);
             toast.success('Added Liked Songs to Queue');
        } else {
             toast.error('Your Liked Songs is empty');
        }
        return;
     }
  };

  return (
    <ContextMenu.Root modal={false}>
      <ContextMenu.Trigger asChild>
        {children}
      </ContextMenu.Trigger>

      <ContextMenu.Portal>
        <ContextMenu.Content 
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
            {/* GROUP: QUEUE */}
            {(data.type === 'song' || data.type === 'playlist' || data.type === 'generated_playlist' || data.type === 'album' || data.type === 'liked') && (
                <>
                    <ContextMenu.Item onSelect={handleAddToQueue} className="text-sm text-neutral-200 hover:bg-neutral-700 hover:text-white rounded-sm px-3 py-2 cursor-pointer outline-none flex items-center gap-x-3">
                        <MdQueueMusic size={18} /> Add to Queue
                    </ContextMenu.Item>
                    
                    {/* HIDE SEPARATOR FOR LIKED SONGS */}
                    {data.type !== 'liked' && (
                       <ContextMenu.Separator className="h-[1px] bg-neutral-700 my-1" />
                    )}
                </>
            )}

            {/* GROUP: ARTIST */}
            {data.type === 'artist' && (
                isFollowing ? (
                    <ContextMenu.Item onSelect={handleUnfollow} className="text-sm text-neutral-200 hover:bg-neutral-700 hover:text-white rounded-sm px-3 py-2 cursor-pointer outline-none flex items-center gap-x-3">
                        <AiOutlineUserDelete size={18} /> Unfollow Artist
                    </ContextMenu.Item>
                ) : (
                    <ContextMenu.Item onSelect={handleFollow} className="text-sm text-neutral-200 hover:bg-neutral-700 hover:text-white rounded-sm px-3 py-2 cursor-pointer outline-none flex items-center gap-x-3">
                        <AiOutlineUserAdd size={18} /> Follow Artist
                    </ContextMenu.Item>
                )
            )}

            {/* GROUP: ALBUM */}
            {data.type === 'album' && (
                isSaved ? (
                    <ContextMenu.Item onSelect={handleRemoveFromLibrary} className="text-sm text-neutral-200 hover:bg-neutral-700 hover:text-white rounded-sm px-3 py-2 cursor-pointer outline-none flex items-center gap-x-3">
                        <AiOutlineDelete size={18} /> Remove from Library
                    </ContextMenu.Item>
                ) : (
                    <ContextMenu.Item onSelect={handleAddToLibrary} className="text-sm text-neutral-200 hover:bg-neutral-700 hover:text-white rounded-sm px-3 py-2 cursor-pointer outline-none flex items-center gap-x-3">
                        <AiOutlinePlus size={18} /> Add to Library
                    </ContextMenu.Item>
                )
            )}

            {/* GROUP: GENERATED MIX */}
            {data.type === 'generated_playlist' && (
                <ContextMenu.Item onSelect={handleSaveMix} className="text-sm text-neutral-200 hover:bg-neutral-700 hover:text-white rounded-sm px-3 py-2 cursor-pointer outline-none flex items-center gap-x-3">
                    <AiOutlinePlus size={18} /> Save to Your Library
                </ContextMenu.Item>
            )}

            {/* GROUP: PLAYLIST */}
            {data.type === 'playlist' && (
                <ContextMenu.Item onSelect={handleDeletePlaylist} className="text-sm text-neutral-200 hover:bg-neutral-700 hover:text-white rounded-sm px-3 py-2 cursor-pointer outline-none flex items-center gap-x-3">
                    <AiOutlineDelete size={18} /> Delete Playlist
                </ContextMenu.Item>
            )}

            {/* GROUP: SONG */}
            {data.type === 'song' && finalPlaylistId && (
                <ContextMenu.Item onSelect={handleRemoveFromPlaylist} className="text-sm text-neutral-200 hover:bg-neutral-700 hover:text-white rounded-sm px-3 py-2 cursor-pointer outline-none flex items-center gap-x-3">
                    <AiOutlineDelete size={18} /> Remove from Playlist
                </ContextMenu.Item>
            )}

            {/* GROUP: NAVIGATION */}
            {(data.artist_id || data.type === 'artist') && (
                <>
                    <ContextMenu.Separator className="h-[1px] bg-neutral-700 my-1" />
                    <ContextMenu.Item onSelect={handleGoToArtist} className="text-sm text-neutral-200 hover:bg-neutral-700 hover:text-white rounded-sm px-3 py-2 cursor-pointer outline-none flex items-center gap-x-3">
                        <BsPersonFill size={18} /> {data.type === 'artist' ? 'Go to Artist Page' : 'Go to Artist'}
                    </ContextMenu.Item>
                </>
            )}

        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
};

export default MediaContextMenu;