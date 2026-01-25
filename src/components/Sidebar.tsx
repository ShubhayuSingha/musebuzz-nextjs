'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image'; 
import { useRouter } from 'next/navigation';
import { HiHome } from 'react-icons/hi';
import { TbPlaylist } from 'react-icons/tb';
import { AiOutlinePlus, AiFillHeart } from 'react-icons/ai'; 
import { FiMenu } from 'react-icons/fi';

import { motion, AnimatePresence } from 'framer-motion';

import { useUser, useSupabaseClient } from "@supabase/auth-helpers-react";
import useAuthModalStore from "@/stores/useAuthModalStore";
import { toast } from 'react-hot-toast';

import LikeDataLoader from "@/components/LikeDataLoader";
import usePlaylistStore from '@/stores/usePlaylistStore';
import usePlaybackSync from "@/hooks/usePlaybackSync"; 
import MediaContextMenu from "@/components/MediaContextMenu";

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

interface SidebarItem {
  id: string;
  type: 'playlist' | 'album';
  title: string;
  subtitle: string;
  imageUrl: string | null;
  path: string;
  sortDate: string; 
  artist_id?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle }) => {
  const supabase = useSupabaseClient();
  const router = useRouter();
  const authModal = useAuthModalStore();
  const user = useUser();

  usePlaybackSync();
  const { refreshPlaylists, version } = usePlaylistStore();
  const [libraryItems, setLibraryItems] = useState<SidebarItem[]>([]);
  
  // --- FETCH LOGIC ---
  const fetchLibrary = async () => {
    if (!user?.id) {
        setLibraryItems([]);
        return;
    }

    // 1. Fetch Playlists
    const { data: playlists } = await supabase
      .from('playlists')
      .select('id, title, image_path, user_id, last_accessed_at, created_at')
      .eq('user_id', user.id)
      .eq('type', 'personal');

    // 2. Fetch Saved Albums
    const { data: savedAlbums } = await supabase
      .from('saved_albums')
      .select(`
         created_at,
         last_accessed_at,
         albums (
            id, title, image_path, artists (id, name)
         )
      `)
      .eq('user_id', user.id);

    // 3. Normalize Playlists
    const formattedPlaylists: SidebarItem[] = (playlists || []).map((pl: any) => {
        const imgPath = pl.image_path || 'playlist-placeholder.jpg';
        const { data: imgData } = supabase.storage.from('playlist_images').getPublicUrl(imgPath);
        const userName = user.user_metadata.full_name || 'User';

        return {
            id: pl.id,
            type: 'playlist',
            title: pl.title,
            subtitle: `Playlist • ${userName}`,
            imageUrl: imgData.publicUrl,
            path: `/playlist/${pl.id}`,
            sortDate: pl.last_accessed_at || pl.created_at
        };
    });

    // 4. Normalize Albums
    const formattedAlbums = (savedAlbums || []).map((item: any) => {
        const album = item.albums;
        if (!album) return null;

        let imageUrl = '/images/album-placeholder.png';
        if (album.image_path) {
            const { data } = supabase.storage.from('images').getPublicUrl(album.image_path);
            imageUrl = data.publicUrl;
        }

        return {
            id: album.id,
            type: 'album' as const,
            title: album.title,
            subtitle: `Album • ${album.artists?.name}`,
            imageUrl: imageUrl,
            path: `/album/${album.id}`,
            sortDate: item.last_accessed_at || item.created_at,
            artist_id: album.artists?.id
        } as SidebarItem;

    }).filter((item) => item !== null) as SidebarItem[];

    // 5. Combine & Sort
    const combined = [...formattedPlaylists, ...formattedAlbums]
        .sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime())
        .slice(0, 10);

    setLibraryItems(combined);
  };

  useEffect(() => {
    fetchLibrary();
  }, [user, supabase, version]); 


  // --- CREATE PLAYLIST LOGIC ---
  const handleCreatePlaylist = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) return authModal.onOpen('sign_in');

    const { count } = await supabase.from('playlists').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
    const nextNumber = (count || 0) + 1;
    const defaultTitle = `My Playlist #${nextNumber}`;
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('playlists')
      .insert({
        user_id: user.id,
        title: defaultTitle,
        type: 'personal',
        description: 'New playlist',
        image_path: null,
        last_accessed_at: now,
        created_at: now 
      })
      .select().single();

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Playlist Created!');
      refreshPlaylists(); 
      router.refresh(); 
      router.push(`/playlist/${data.id}`);
    }
  };

  const handleLikedClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!user) {
      e.preventDefault(); 
      authModal.onOpen('sign_in'); 
    }
  }

  // HELPER: Common classes for the fixed-width icon container
  const iconBoxClass = "min-w-[80px] h-full flex items-center justify-center flex-shrink-0";
  
  // HELPER: Text container that fades out smoothly
  const textContainerClass = `
      flex flex-col whitespace-nowrap overflow-hidden transition-all duration-300
      ${isCollapsed ? 'opacity-0 w-0 translate-x-[-10px]' : 'opacity-100 w-auto translate-x-0'}
  `;

  return (
    <aside 
      className={`
        bg-gradient-to-b from-purple-950 to-black text-white py-4 
        flex flex-col flex-shrink-0
        transition-all duration-300 ease-in-out h-full max-h-screen z-40
        ${isCollapsed ? 'w-[80px]' : 'w-72'} 
      `}
    >
      <LikeDataLoader />

      {/* HEADER */}
      <div className="flex items-center h-10 mb-6 w-full">
        {/* Toggle Button Wrapper */}
        <div className={iconBoxClass}>
            <button 
                onClick={onToggle} 
                className="rounded-full hover:bg-white/10 transition p-2"
                title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"} 
            >
                <FiMenu size={26} />
            </button>
        </div>
        {/* Title */}
        <div className={textContainerClass}>
            <div className="font-bold text-2xl">MuseBuzz</div>
        </div>
      </div>

      {/* MAIN NAV */}
      <nav className="flex-shrink-0 w-full">
        <ul className="flex flex-col w-full">
          <li className="mb-2 w-full">
            <Link 
                href="/" 
                className="h-10 flex items-center hover:text-white text-zinc-400 transition-colors duration-200 group"
                title="Home"
            >
               <div className={iconBoxClass}>
                   <HiHome size={28} />
               </div>
               <span className={`${textContainerClass} text-lg font-medium group-hover:text-white`}>Home</span>
            </Link>
          </li>
        </ul>
      </nav>

      {/* DIVIDER */}
      <div className={`border-t border-white/10 my-2 flex-shrink-0 transition-all duration-300 ${isCollapsed ? 'mx-4' : 'mx-6'}`} />
      
      {/* LIBRARY NAV */}
      <nav className="flex-shrink-0 w-full">
        <ul className="flex flex-col w-full">
          {/* Liked Songs */}
          <li className="mb-2 w-full">
            <Link 
                href="/liked" 
                onClick={handleLikedClick} 
                className="h-10 flex items-center hover:text-white text-zinc-400 transition-colors duration-200 group"
                title="Liked Songs"
            >
              <div className={iconBoxClass}>
                 <AiFillHeart size={28} />
              </div>
              <span className={`${textContainerClass} text-lg font-medium group-hover:text-white`}>Liked Songs</span>
            </Link>
          </li>

          {/* Your Library Link */}
          <li className="mb-2 w-full">
            <Link 
                href="/library" 
                className="h-10 flex items-center hover:text-white text-zinc-400 transition-colors duration-200 group"
                title="Your Library" 
            >
              <div className={iconBoxClass}>
                  <TbPlaylist size={28} />
              </div>
              <span className={`${textContainerClass} text-lg font-medium group-hover:text-white`}>Your Library</span>
            </Link>
          </li>

          {/* Create Playlist Button */}
          <li className="mb-2 w-full">
            <div 
                onClick={handleCreatePlaylist} 
                className="h-10 flex items-center hover:text-white text-zinc-400 transition-colors duration-200 cursor-pointer group"
                title="Create Playlist" 
            >
              <div className={iconBoxClass}>
                 <div className="bg-zinc-400 group-hover:bg-white text-black p-1 rounded-[4px] transition">
                    <AiOutlinePlus size={20} /> 
                 </div>
              </div>
              <span className={`${textContainerClass} text-lg font-medium group-hover:text-white`}>Create Playlist</span>
            </div>
          </li>
        </ul>
      </nav>

      {/* SEPARATOR */}
      {libraryItems.length > 0 && (
         <div className={`border-t border-white/10 mt-2 mb-2 flex-shrink-0 transition-all duration-300 ${isCollapsed ? 'mx-4' : 'mx-6'}`} />
      )}

      {/* SCROLLABLE LIST - 🟢 ADDED pb-24 padding */}
      <div className="flex-1 overflow-y-auto custom-scrollbar overflow-x-hidden w-full pb-24">
         <AnimatePresence initial={false} mode='popLayout'>
           {libraryItems.map((item) => (
             <MediaContextMenu 
                key={`${item.type}-${item.id}`} 
                data={{ id: item.id, type: item.type, title: item.title, artist_id: item.artist_id }}
             >
                 <motion.div
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                 >
                     <Link 
                       href={item.path}
                       className="group flex items-center h-14 hover:bg-white/5 transition cursor-pointer w-full"
                       title={`${item.title}\n${item.subtitle}`}
                     >
                         {/* Fixed Width Icon Container (Matches Collapsed Width) */}
                         <div className={iconBoxClass}>
                            <div className="relative h-12 w-12 overflow-hidden rounded-md shadow-sm">
                                <Image 
                                    fill
                                    src={item.imageUrl || '/images/playlist-placeholder.jpg'}
                                    alt={item.title}
                                    className="object-cover"
                                />
                            </div>
                         </div>

                         {/* Text Content (Collapses smoothly) */}
                         <div className={textContainerClass}>
                             <p className="truncate text-white font-medium text-sm pr-4">
                                 {item.title}
                             </p>
                             <p className="truncate text-zinc-400 text-xs pr-4">
                                 {item.subtitle}
                             </p>
                         </div>
                     </Link>
                 </motion.div>
             </MediaContextMenu>
           ))}
         </AnimatePresence>
      </div>

    </aside>
  );
};

export default Sidebar;