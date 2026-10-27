// src/components/Header.tsx
'use client';

import Button from "./Button";
import useAuthModalStore from "@/stores/useAuthModalStore";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import GlobalSearch from "@/components/GlobalSearch"; 
import usePlayerStore from "@/stores/usePlayerStore";
import { FaUserCircle } from "react-icons/fa";
import { RiWifiOffLine } from "react-icons/ri";
import useOfflineModeStore from "@/stores/useOfflineModeStore";
import StorageIndicator from "@/components/StorageIndicator";

interface HeaderProps {
  onMenuClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { onOpen } = useAuthModalStore();
  const supabaseClient = useSupabaseClient();
  const user = useUser();
  const router = useRouter();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  
  const [mounted, setMounted] = useState(false);
  const [networkOnline, setNetworkOnline] = useState(true);

  const resetPlayer = usePlayerStore((state) => state.reset); 
  const { isOnline, isOfflineMode, toggleOfflineMode } = useOfflineModeStore();

  useEffect(() => {
    setMounted(true);
    setNetworkOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);

    const handleOnline = () => setNetworkOnline(true);
    const handleOffline = () => setNetworkOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const isNetworkDisconnected = mounted && (!networkOnline || !isOnline);
  const offlineActive = mounted && isOfflineMode;

  // Close profile dropdown if clicked outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    // 1. Reset the Zustand store in RAM
    resetPlayer(); 
    
    // 2. Nuke the Zustand persistent storage from the browser's hard drive
    localStorage.removeItem('musebuzz-player-storage');

    // 3. Tell Supabase to destroy the auth session cookie
    await supabaseClient.auth.signOut();
    
    // 4. THE MAGIC BULLET: Force a hard browser reload instead of a soft Next.js refresh.
    // This completely obliterates all React memory, stale states, and ghost UI.
    window.location.href = '/';
  };

  return (
    <div 
      className="
        sticky     
        top-0      
        z-50       
        h-fit 
        bg-black 
        py-3 
        px-6 
        border-b 
        border-neutral-700
      "
    >
      <div className="w-full flex items-center justify-between gap-x-4">
        
        {/* Mobile Hamburger Menu (visible only on phones) */}
        {onMenuClick && (
          <button 
            onClick={onMenuClick} 
            className="md:hidden p-2 -ml-2 text-neutral-400 hover:text-white transition"
          >
            <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="24" width="24" xmlns="http://www.w3.org/2000/svg"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>
        )}

        {/* Global search stays centered implicitly or grows via its own relative container */}
        <GlobalSearch isMobileRightAligned={false} />
        
        {/* Content Right side */}
        <div className="flex-1 flex justify-end items-center gap-x-2 sm:gap-x-3 md:gap-x-4">
          {/* Mobile Search Icon rendered on the right */}
          <GlobalSearch isMobileRightAligned={true} />

          {/* Network Error Status */}
          {isNetworkDisconnected && (
            <div 
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold whitespace-nowrap animate-pulse select-none"
              title="Network connection lost"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
              <span>Network Error</span>
            </div>
          )}

          {/* Offline Mode Toggle Button - Always Visible */}
          <button
            onClick={toggleOfflineMode}
            type="button"
            className={`
              flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold transition active:scale-95 select-none whitespace-nowrap
              ${
                offlineActive
                  ? 'bg-purple-600/30 border border-purple-500 text-purple-200 hover:bg-purple-600/40 shadow-sm shadow-purple-900/40'
                  : 'bg-neutral-800/80 hover:bg-neutral-800 border border-neutral-700/80 text-neutral-300 hover:text-white'
              }
            `}
            title={offlineActive ? "Offline Mode is ON — Click to switch to Online" : "Offline Mode is OFF — Click to switch to Offline"}
          >
            <RiWifiOffLine className={`w-3.5 h-3.5 ${offlineActive ? 'text-purple-300' : 'text-neutral-400'}`} />
            <span className="hidden sm:inline">Offline Mode</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
              offlineActive ? 'bg-purple-500 text-white' : 'bg-neutral-700 text-neutral-400'
            }`}>
              {offlineActive ? 'ON' : 'OFF'}
            </span>
          </button>
           
          {/* Offline Storage Indicator on Navbar */}
          <StorageIndicator variant="navbar" />

          {user ? (
            <div ref={profileRef} className="relative">
              <button 
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center justify-center rounded-full bg-neutral-800 p-2 text-neutral-400 hover:text-white transition active:scale-95 border border-transparent hover:border-neutral-700"
              >
                <FaUserCircle size={24} />
              </button>
              
              {/* Profile Dropdown */}
              {isProfileOpen && (
                <div className="absolute right-0 top-[110%] w-40 bg-zinc-900 border border-neutral-800 rounded-lg shadow-2xl py-2 z-50 animate-fade-in flex flex-col overflow-hidden">
                   <div className="px-4 py-2 border-b border-neutral-800 mb-1">
                      <p className="text-xs text-neutral-400 truncate">Logged in</p>
                   </div>
                   <button 
                     onClick={() => {
                       setIsProfileOpen(false);
                       handleLogout();
                     }}
                     className="w-full text-left px-4 py-2 text-sm font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition"
                   >
                     Log out
                   </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Button 
                onClick={() => onOpen('sign_up')}
                className="bg-transparent text-neutral-300 font-medium whitespace-nowrap py-2 hidden sm:block"
              >
                Sign up
              </Button>
              <Button 
                onClick={() => onOpen('sign_in')}
                className="bg-white px-6 py-2 whitespace-nowrap"
              >
                Log in
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Header;