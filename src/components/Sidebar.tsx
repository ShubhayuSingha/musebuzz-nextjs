// src/components/Sidebar.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { HiHome } from 'react-icons/hi';
// Removed HiQueueList import
import { TbPlaylist } from 'react-icons/tb';
import { AiOutlinePlus, AiFillHeart } from 'react-icons/ai'; 
import { FiMenu } from 'react-icons/fi';

import { useUser } from "@supabase/auth-helpers-react";
import useAuthModalStore from "@/stores/useAuthModalStore";

import LikeDataLoader from "@/components/LikeDataLoader";

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle }) => {
  const [showText, setShowText] = useState(!isCollapsed);
  
  const authModal = useAuthModalStore();
  const user = useUser();

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
        transition-all duration-300 ease-in-out
        ${isCollapsed ? 'w-15' : 'w-64'}
      `}
    >
      {/* Data Loader runs logic invisibly */}
      <LikeDataLoader />

      <div className="flex items-center justify-start gap-x-4 mb-10 h-10 px-4">
        <button onClick={onToggle} className="rounded-full hover:bg-white/10 transition">
          <FiMenu size={26} />
        </button>
        {showText && <div className={`font-bold text-2xl ${textClasses}`}>MuseBuzz</div>}
      </div>
      <nav>
        <ul>
          <li className="mb-4">
            <Link href="/" className="h-10 flex items-center gap-x-4 text-lg hover:text-zinc-400 transition-colors duration-200 px-4">
              <HiHome size={26} />
              {showText && <span className={textClasses}>Home</span>}
            </Link>
          </li>
          
          {/* QUEUE LINK REMOVED FROM HERE */}

        </ul>
      </nav>

      <div className="border-t border-white/20 my-4" />
      
      <nav>
        <ul>
          <li className="mb-4">
            <Link 
              href="/liked" 
              onClick={handleLikedClick}
              className="h-10 flex items-center gap-x-4 text-lg hover:text-zinc-400 transition-colors duration-200 px-4"
            >
              <AiFillHeart size={26} />
              {showText && <span className={textClasses}>Liked Songs</span>}
            </Link>
          </li>

          <li className="mb-4">
            <a href="#" className="h-10 flex items-center gap-x-4 text-lg hover:text-zinc-400 transition-colors duration-200 px-4">
              <TbPlaylist size={26} />
              {showText && <span className={textClasses}>Your Library</span>}
            </a>
          </li>
            <li className="mb-4">
            <a href="#" className="h-10 flex items-center gap-x-4 text-lg hover:text-zinc-400 transition-colors duration-200 px-4">
              <AiOutlinePlus size={26} />
              {showText && <span className={textClasses}>Create Playlist</span>}
            </a>
          </li>
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;