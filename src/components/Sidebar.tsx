'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HiHome } from 'react-icons/hi';
import { TbPlaylist } from 'react-icons/tb';
import { AiOutlinePlus, AiFillHeart } from 'react-icons/ai'; 
import { FiMenu } from 'react-icons/fi';
import { BsMusicNoteBeamed } from 'react-icons/bs'; 

// Re-import Framer Motion
import { motion, AnimatePresence } from 'framer-motion';

import { useUser, useSupabaseClient } from "@supabase/auth-helpers-react";
import useAuthModalStore from "@/stores/useAuthModalStore";
import { toast } from 'react-hot-toast';

import LikeDataLoader from "@/components/LikeDataLoader";
import usePlaylistStore from '@/stores/usePlaylistStore';

// 🟢 NEW: Import the Sync Hook
import usePlaybackSync from "@/hooks/usePlaybackSync"; 

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

interface Playlist {
  id: string;
  title: string;
  user_id: string;
  last_accessed_at?: string; 
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle }) => {
  const supabase = useSupabaseClient();
  const router = useRouter();
  const authModal = useAuthModalStore();
  const user = useUser();

  // 🟢 MOUNT SYNC HOOK: This starts the "State Restore" & "Auto-Save" process
  usePlaybackSync();

  const { refreshPlaylists, version } = usePlaylistStore();

  const [showText, setShowText] = useState(!isCollapsed);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  
  useEffect(() => {
    if (isCollapsed) {
      setShowText(false);
    } else {
      const timer = setTimeout(() => {
        setShowText(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isCollapsed]);

  // 1. Fetch Playlists Logic
  const fetchPlaylists = async () => {
    if (!user?.id) {
        setPlaylists([]);
        return;
    }

    const { data, error } = await supabase
      .from('playlists')
      .select('id, title, user_id, last_accessed_at')
      .eq('user_id', user.id)
      .eq('type', 'personal') 
      .order('last_accessed_at', { ascending: false }) 
      .limit(5);

    if (!error && data) {
      setPlaylists(data);
    }
  };

  useEffect(() => {
    fetchPlaylists();
  }, [user, supabase, version]);

  // 2. Create Playlist Logic
  const handleCreatePlaylist = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) {
      return authModal.onOpen('sign_in');
    }

    const { count, error: countError } = await supabase
        .from('playlists')
        .select('*', { count: 'exact', head: true }) 
        .eq('user_id', user.id)
        .eq('type', 'personal');

    if (countError) {
        return toast.error(countError.message);
    }

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
      .select() 
      .single();

    if (error) {
      toast.error(`Failed to create playlist: ${error.message}`);
    } else {
      toast.success('Playlist Created!');
      // Optimistic update
      setPlaylists((prev) => [data, ...prev].slice(0, 5)); 
      
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

  const textClasses = `whitespace-nowrap transition-opacity duration-200 ${isCollapsed ? 'opacity-0' : 'opacity-100'}`;

  return (
    <aside 
      className={`
        bg-gradient-to-b from-purple-950 to-black text-white py-4 
        flex flex-col
        transition-all duration-300 ease-in-out h-full max-h-screen
        ${isCollapsed ? 'w-[70px]' : 'w-64'} 
      `}
    >
      <LikeDataLoader />

      {/* HEADER */}
      <div className="flex items-center justify-start gap-x-4 mb-6 h-10 px-4 flex-shrink-0">
        <button onClick={onToggle} className="rounded-full hover:bg-white/10 transition">
          <FiMenu size={26} />
        </button>
        {showText && <div className={`font-bold text-2xl ${textClasses}`}>MuseBuzz</div>}
      </div>

      {/* MAIN NAV */}
      <nav className="flex-shrink-0">
        <ul>
          <li className="mb-2">
            <Link href="/" className="h-10 flex items-center gap-x-4 text-lg hover:text-zinc-400 transition-colors duration-200 px-4">
              <HiHome size={26} />
              {showText && <span className={textClasses}>Home</span>}
            </Link>
          </li>
        </ul>
      </nav>

      {/* DIVIDER */}
      <div className="border-t border-white/20 my-4 mx-4 flex-shrink-0" />
      
      {/* LIBRARY ACTIONS */}
      <nav className="flex-shrink-0">
        <ul>
          <li className="mb-2">
            <Link 
              href="/liked" 
              onClick={handleLikedClick}
              className="h-10 flex items-center gap-x-4 text-lg hover:text-zinc-400 transition-colors duration-200 px-4"
            >
              <AiFillHeart size={26} className="text-white" /> 
              {showText && <span className={textClasses}>Liked Songs</span>}
            </Link>
          </li>

          <li className="mb-2">
            <Link href="/library" className="h-10 flex items-center gap-x-4 text-lg hover:text-zinc-400 transition-colors duration-200 px-4">
              <TbPlaylist size={26} />
              {showText && <span className={textClasses}>Your Library</span>}
            </Link>
          </li>

          <li className="mb-2">
            <div 
               onClick={handleCreatePlaylist}
               className="h-10 flex items-center gap-x-4 text-lg hover:text-zinc-400 transition-colors duration-200 px-4 cursor-pointer"
            >
              <div className="bg-white text-black p-1 rounded-[2px]">
                 <AiOutlinePlus size={16} /> 
              </div>
              {showText && <span className={textClasses}>Create Playlist</span>}
            </div>
          </li>
        </ul>
      </nav>

      {/* SEPARATOR */}
      {showText && playlists.length > 0 && (
         <div className="border-t border-white/10 mt-2 mx-4 mb-2 flex-shrink-0" />
      )}

      {/* SCROLLABLE LIST */}
      <div className="flex-1 overflow-y-auto px-4 custom-scrollbar overflow-x-hidden">
         {/* AnimatePresence handles items entering/leaving */}
         <AnimatePresence initial={false} mode='popLayout'>
           {playlists.map((playlist) => (
              <motion.div
                 layout // Safe now: Only triggers when DB data changes, not continuously
                 key={playlist.id}
                 initial={{ opacity: 0, x: -10 }}
                 animate={{ opacity: 1, x: 0 }}
                 exit={{ opacity: 0, x: -10 }}
                 transition={{ 
                    type: "spring", 
                    stiffness: 400, 
                    damping: 25 
                 }}
              >
                  <Link 
                     href={`/playlist/${playlist.id}`}
                     className="flex items-center gap-x-4 py-2 hover:text-white text-zinc-400 transition truncate group"
                  >
                      {isCollapsed ? (
                          <div className="min-w-[26px] flex justify-center">
                              <BsMusicNoteBeamed size={20} />
                          </div>
                      ) : (
                          <p className={`truncate text-sm ${textClasses}`}>{playlist.title}</p>
                      )}
                  </Link>
              </motion.div>
           ))}
         </AnimatePresence>
      </div>

    </aside>
  );
};

export default Sidebar;