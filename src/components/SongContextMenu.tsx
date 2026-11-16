'use client';

import React, { useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid'; 

// Icons
import { MdOutlinePlaylistAdd, MdDeleteOutline, MdQueueMusic } from 'react-icons/md';
import { BsDisc, BsPerson } from 'react-icons/bs';
import { AiFillHeart, AiOutlineHeart } from 'react-icons/ai';

import useAddToPlaylistModal from '@/stores/useAddToPlaylistModal';
import usePlayerStore from '@/stores/usePlayerStore';
import { useContextMenuStore } from '@/stores/useContextMenuStore';
import useLikeStore from '@/stores/useLikeStore';
import useAuthModalStore from '@/stores/useAuthModalStore';
import { useUser } from '@supabase/auth-helpers-react';

interface SongContextMenuProps {
  children: React.ReactNode;
  songId: string;
  playlistId?: string;
  isReadOnly?: boolean; 
  albumId?: string;
  artistId?: string;
}

const SongContextMenu: React.FC<SongContextMenuProps> = ({ 
    children, 
    songId, 
    playlistId,
    isReadOnly = false, 
    albumId,
    artistId
}) => {
  const menuId = useMemo(() => uuidv4(), []);
  const { openId, setOpenId } = useContextMenuStore();
  const visible = openId === menuId;

  const [points, setPoints] = React.useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  
  const addToPlaylistModal = useAddToPlaylistModal();
  const supabaseClient = useSupabaseClient();
  const router = useRouter();
  const player = usePlayerStore();
  const user = useUser();
  const { onOpen } = useAuthModalStore();
  const { hasLikedId, addLikedId, removeLikedId } = useLikeStore();
  
  const isLiked = hasLikedId(songId);

  useEffect(() => {
    if (!visible) return;

    const handleClick = (e: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
            setOpenId(null);
        }
    };
    
    const handleScroll = (e: Event) => {
        const target = e.target as HTMLElement | null;
        if (target && typeof target.closest === 'function' && target.closest('[data-lyrics-container="true"]')) {
            return;
        }
        if (visible) setOpenId(null);
    };

    window.addEventListener('click', handleClick);
    window.addEventListener('contextmenu', handleClick); 
    window.addEventListener('scroll', handleScroll, true); 

    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('contextmenu', handleClick);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [visible, setOpenId]);

  // Dynamically measure and reposition the context menu so it strictly stays inside the visible screen
  useLayoutEffect(() => {
    if (!visible || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const menuWidth = rect.width || 210;
    const menuHeight = rect.height || 260;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const PADDING = 12;

    setPoints((prev) => {
      let { x, y } = prev;

      // 1. Vertical positioning: if opening downwards overflows the bottom (or taskbar/player), flip upwards
      if (y + menuHeight > vh - PADDING) {
        y = y - menuHeight;
      }

      // If flipping upwards overflows the top, clamp to top padding
      if (y < PADDING) {
        y = PADDING;
      }

      // Final boundary clamp so bottom never bleeds into taskbar
      if (y + menuHeight > vh - PADDING) {
        y = Math.max(PADDING, vh - menuHeight - PADDING);
      }

      // 2. Horizontal positioning: if opening rightwards overflows the screen, flip leftwards
      if (x + menuWidth > vw - PADDING) {
        x = x - menuWidth;
      }

      // If flipping leftwards overflows the left edge, clamp to left padding
      if (x < PADDING) {
        x = PADDING;
      }

      // Final horizontal clamp
      if (x + menuWidth > vw - PADDING) {
        x = Math.max(PADDING, vw - menuWidth - PADDING);
      }

      if (x === prev.x && y === prev.y) return prev;
      return { x, y };
    });
  }, [visible]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault(); 
    e.stopPropagation(); 

    setPoints({ x: e.clientX, y: e.clientY });
    setOpenId(menuId); 
  };

  const handleClickCapture = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const trigger = target.closest('[data-context-trigger="true"]');
    if (trigger) {
      e.preventDefault();
      e.stopPropagation();
      setOpenId(menuId);

      const rect = trigger.getBoundingClientRect();
      setPoints({ x: rect.left, y: rect.bottom + 4 });
    }
  };

  // --- ACTIONS ---

  const handleToggleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      setOpenId(null);
      return onOpen('sign_in');
    }
    
    if (isLiked) {
      removeLikedId(songId); 
      player.syncLikedSongs(songId, 'remove');
      toast('Unliked!', { icon: '💔' });
      setOpenId(null);
      
      try {
        const { error } = await supabaseClient
          .from('liked_songs').delete()
          .eq('user_id', user.id).eq('song_id', songId);

        if (error) throw error;
        router.refresh();
      } catch (error: any) {
        addLikedId(songId);
        player.syncLikedSongs(songId, 'add');
        toast.error("Could not unlike");
      }
    } else {
      addLikedId(songId);
      player.syncLikedSongs(songId, 'add'); 
      toast('Liked!', { icon: '❤️' });
      setOpenId(null);

      try {
        const { error } = await supabaseClient
          .from('liked_songs').upsert(
            { song_id: songId, user_id: user.id }, 
            { onConflict: 'song_id, user_id', ignoreDuplicates: true }
          );

        if (error) throw error;
        router.refresh();
      } catch (error: any) {
        if (error.code === '23505') router.refresh();
        else {
            removeLikedId(songId);
            player.syncLikedSongs(songId, 'remove');
            toast.error("Could not like");
        }
      }
    }
  };

  const handleAddToQueue = () => {
    if (!user) {
      setOpenId(null);
      return onOpen('sign_in');
    }
    player.addToQueue(songId);
    toast.success('Added to Queue');
    setOpenId(null);
  };

  const handleGoToArtist = () => {
    if (artistId) router.push(`/artist/${artistId}`);
    setOpenId(null);
  };

  const handleGoToAlbum = () => {
    if (albumId) router.push(`/album/${albumId}`);
    setOpenId(null);
  };

  const handleAddToPlaylist = () => {
    addToPlaylistModal.onOpen(songId);
    setOpenId(null);
  };

  const handleRemoveFromPlaylist = async () => {
    if (!playlistId || isReadOnly) return; 

    player.syncPlaylistQueue(songId, playlistId, 'remove');

    const { error } = await supabaseClient
      .from('playlist_songs')
      .delete()
      .eq('playlist_id', playlistId)
      .eq('song_id', songId);

    if (error) {
      toast.error(error.message);
    } else {
      // 🟢 AUTO-SYNC: If playlist is downloaded, sync immediately in background!
      import('@/stores/useDownloadStore').then(({ default: useDownloadStore }) => {
        if (useDownloadStore.getState().downloadedIds.has(playlistId)) {
          import('@/lib/downloadService').then(({ syncPlaylist }) => {
            syncPlaylist(supabaseClient, playlistId, true);
          });
        }
      });

      toast.success('Removed from playlist');
      router.refresh(); 
    }
    setOpenId(null);
  };

  // 🟢 Reusable Class for Menu Items (Replaces the styled-jsx block)
  const menuItemClass = "w-full flex items-center gap-x-3 px-3 py-2.5 text-sm text-neutral-200 hover:bg-neutral-700 hover:text-white rounded-sm cursor-pointer transition";

  return (
    <div onContextMenu={handleContextMenu} onClickCapture={handleClickCapture} className="w-full h-full">
      {children}

      {visible && (
         <div 
            ref={menuRef}
            className="
                fixed z-[9999] 
                bg-neutral-800 
                border border-neutral-700 
                rounded-md shadow-xl 
                p-1 min-w-[200px]
                max-h-[calc(100vh-24px)]
                overflow-y-auto
                scrollbar-thin
                animate-in fade-in zoom-in-95 duration-100
            "
            style={{ top: points.y, left: points.x }}
         >
            {/* 1. Like / Unlike */}
            <div onClick={handleToggleLike} className={`${menuItemClass} ${isLiked ? 'text-purple-400 hover:text-purple-300' : ''}`}>
               {isLiked ? <AiFillHeart size={20} className="text-purple-500" /> : <AiOutlineHeart size={20} />}
               {isLiked ? 'Unlike' : 'Like'}
            </div>

            {/* 2. Add to Queue */}
            <div onClick={handleAddToQueue} className={menuItemClass}>
               <MdQueueMusic size={20} />
               Add to Queue
            </div>

            {/* 3. Navigation Group */}
            {(artistId || albumId) && <div className="h-[1px] bg-neutral-700 my-1" />}
            
            {artistId && (
                <div onClick={handleGoToArtist} className={menuItemClass}>
                   <BsPerson size={20} />
                   Go to Artist
                </div>
            )}
            
            {albumId && (
                <div onClick={handleGoToAlbum} className={menuItemClass}>
                   <BsDisc size={20} />
                   Go to Album
                </div>
            )}

            <div className="h-[1px] bg-neutral-700 my-1" />

            {/* 3. Playlist Actions */}
            <div onClick={handleAddToPlaylist} className={menuItemClass}>
               <MdOutlinePlaylistAdd size={20} />
               Add to Playlist...
            </div>

            {/* 4. Remove (Only if NOT Read-Only) */}
            {playlistId && !isReadOnly && (
               <>
                 <div className="h-[1px] bg-neutral-700 my-1" />
                 <div onClick={handleRemoveFromPlaylist} className={`${menuItemClass} hover:text-red-500`}>
                    <MdDeleteOutline size={20} />
                    Remove from this Playlist
                 </div>
               </>
            )}
         </div>
      )}
    </div>
  );
};

export default SongContextMenu;