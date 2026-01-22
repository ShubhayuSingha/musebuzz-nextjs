'use client';

import React, { useEffect, useRef, useMemo } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid'; // Ensure uuid is installed or use a random string helper

import { MdOutlinePlaylistAdd, MdDeleteOutline } from 'react-icons/md';

import useAddToPlaylistModal from '@/stores/useAddToPlaylistModal';
import usePlayerStore from '@/stores/usePlayerStore';
import { useContextMenuStore } from '@/stores/useContextMenuStore'; // 🟢 Import the new store

interface SongContextMenuProps {
  children: React.ReactNode;
  songId: string;
  playlistId?: string; 
}

const SongContextMenu: React.FC<SongContextMenuProps> = ({ children, songId, playlistId }) => {
  // 🟢 Generate a unique ID for THIS specific menu instance
  // This ensures that even if the same song is listed twice, only one menu opens.
  const menuId = useMemo(() => uuidv4(), []);

  // 🟢 Use Global Store instead of local state
  const { openId, setOpenId } = useContextMenuStore();
  const visible = openId === menuId;

  const [points, setPoints] = React.useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  
  const addToPlaylistModal = useAddToPlaylistModal();
  const supabaseClient = useSupabaseClient();
  const router = useRouter();
  const player = usePlayerStore();

  useEffect(() => {
    // Only attach listeners if THIS menu is visible
    if (!visible) return;

    const handleClick = (e: MouseEvent) => {
        // If clicking outside, close THIS menu
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
            setOpenId(null);
        }
    };
    
    const handleScroll = () => {
        if (visible) setOpenId(null);
    };

    // Listen for clicks and right-clicks globally to close this menu
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
    e.stopPropagation(); // Stop bubbling so parent menus don't trigger

    let x = e.pageX;
    let y = e.pageY;
    
    if (x + 200 > window.innerWidth) x = x - 200;
    
    setPoints({ x, y });
    setOpenId(menuId); // 🟢 Set THIS menu as the globally active one
  };

  const handleAddToPlaylist = () => {
    addToPlaylistModal.onOpen(songId);
    setOpenId(null);
  };

  const handleRemoveFromPlaylist = async () => {
    if (!playlistId) return;

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
                p-1 min-w-[180px]
                animate-in fade-in zoom-in-95 duration-100
            "
            style={{ top: points.y, left: points.x }}
         >
            {/* OPTION 1: Add to Playlist */}
            <div 
                onClick={handleAddToPlaylist}
                className="
                    w-full 
                    flex items-center gap-x-3 
                    px-3 py-2.5 
                    text-sm text-neutral-200 
                    hover:bg-neutral-700 hover:text-white 
                    rounded-sm cursor-pointer
                    transition
                "
            >
               <MdOutlinePlaylistAdd size={20} />
               Add to Playlist
            </div>

            {/* OPTION 2: Remove */}
            {playlistId && (
               <>
                 <div className="h-[1px] bg-neutral-700 my-1" />
                 <div 
                    onClick={handleRemoveFromPlaylist}
                    className="
                        w-full 
                        flex items-center gap-x-3 
                        px-3 py-2.5 
                        text-sm text-neutral-200 
                        hover:bg-neutral-700 hover:text-red-500 
                        rounded-sm cursor-pointer
                        transition
                    "
                 >
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