'use client';

import React, { useEffect, useRef, useMemo } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid'; 

// Icons
import { MdOutlinePlaylistAdd, MdDeleteOutline, MdQueueMusic } from 'react-icons/md';
import { BsDisc, BsPerson } from 'react-icons/bs';

import useAddToPlaylistModal from '@/stores/useAddToPlaylistModal';
import usePlayerStore from '@/stores/usePlayerStore';
import { useContextMenuStore } from '@/stores/useContextMenuStore';

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

  useEffect(() => {
    if (!visible) return;

    const handleClick = (e: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
            setOpenId(null);
        }
    };
    
    const handleScroll = () => {
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

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault(); 
    e.stopPropagation(); 

    let x = e.pageX;
    let y = e.pageY;
    
    // Prevent menu from clipping off the right screen edge
    if (x + 220 > window.innerWidth) x = x - 220;
    
    setPoints({ x, y });
    setOpenId(menuId); 
  };

  // --- ACTIONS ---

  const handleAddToQueue = () => {
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
      toast.success('Removed from playlist');
      router.refresh(); 
    }
    setOpenId(null);
  };

  // 🟢 Reusable Class for Menu Items (Replaces the styled-jsx block)
  const menuItemClass = "w-full flex items-center gap-x-3 px-3 py-2.5 text-sm text-neutral-200 hover:bg-neutral-700 hover:text-white rounded-sm cursor-pointer transition";

  return (
    <div onContextMenu={handleContextMenu} className="w-full h-full">
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
                animate-in fade-in zoom-in-95 duration-100
            "
            style={{ top: points.y, left: points.x }}
         >
            {/* 1. Add to Queue */}
            <div onClick={handleAddToQueue} className={menuItemClass}>
               <MdQueueMusic size={20} />
               Add to Queue
            </div>

            {/* 2. Navigation Group */}
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