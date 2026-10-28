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
import { HiCog6Tooth } from "react-icons/hi2";
import useOfflineModeStore from "@/stores/useOfflineModeStore";
import StorageIndicator from "@/components/StorageIndicator";
import { stopSound } from "@/lib/audioEngine";

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

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  
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

  // Close dropdowns if clicked outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    // 1. Stop audio engine
    stopSound();

    // 2. Reset the Zustand store in RAM
    resetPlayer(); 
    
    // 3. Nuke the Zustand persistent storage from the browser's hard drive
    localStorage.removeItem('musebuzz-player-storage');
    sessionStorage.removeItem('restore_seek');

    // 4. Tell Supabase to destroy the auth session cookie
    await supabaseClient.auth.signOut();
    
    // 5. Force a hard browser reload to home
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

          {/* Subtle Network Outage Indicator Icon (visible when disconnected) */}
          {isNetworkDisconnected && (
            <div 
              className="relative group p-2 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 transition cursor-help flex items-center justify-center flex-shrink-0"
              title="Network disconnected — Operating offline"
              aria-label="Network disconnected — Operating offline"
            >
              <RiWifiOffLine size={18} />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />

              {/* Hover Tooltip (desktop) */}
              <div className="absolute right-0 top-[125%] hidden group-hover:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700/80 text-[11px] font-medium text-red-300 shadow-2xl whitespace-nowrap z-50 pointer-events-none">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                <span>Network disconnected</span>
              </div>
            </div>
          )}

          {/* Settings Menu Dropdown (Offline Mode & Storage) */}
          <div ref={settingsRef} className="relative flex-shrink-0">
            <button
              onClick={() => {
                setIsSettingsOpen(!isSettingsOpen);
                if (isProfileOpen) setIsProfileOpen(false);
              }}
              className={`
                flex items-center justify-center rounded-full p-2 transition active:scale-95 border
                ${isSettingsOpen 
                  ? 'bg-neutral-800 text-white border-neutral-600' 
                  : 'bg-neutral-800/80 text-neutral-400 hover:text-white border-transparent hover:border-neutral-700'}
              `}
              title="Settings & Offline"
              aria-label="Settings and Offline preferences"
            >
              <HiCog6Tooth 
                size={20} 
                className={`transition-transform duration-200 ${isSettingsOpen ? 'rotate-45 text-white' : ''}`} 
              />
            </button>

            {/* Settings Dropdown Popover */}
            {isSettingsOpen && (
              <div className="absolute right-0 top-[120%] w-72 sm:w-80 bg-zinc-900/95 backdrop-blur-md border border-neutral-800 rounded-xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                  <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                    Settings & Offline
                  </span>
                </div>

                {/* Offline Mode Toggle Option */}
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-950/60 border border-neutral-800/80">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-lg ${offlineActive ? 'bg-purple-600/20 text-purple-400' : 'bg-neutral-800 text-neutral-400'}`}>
                      <RiWifiOffLine size={16} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-white">Offline Mode</span>
                      <span className="text-[10px] text-neutral-400">
                        {offlineActive ? 'Using downloaded songs only' : 'Stream songs from cloud'}
                      </span>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <button
                    onClick={toggleOfflineMode}
                    type="button"
                    role="switch"
                    aria-checked={offlineActive}
                    className={`
                      relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent 
                      transition-colors duration-200 ease-in-out focus:outline-none
                      ${offlineActive ? 'bg-purple-600' : 'bg-neutral-700'}
                    `}
                  >
                    <span
                      className={`
                        pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 
                        transition duration-200 ease-in-out
                        ${offlineActive ? 'translate-x-5' : 'translate-x-0'}
                      `}
                    />
                  </button>
                </div>

                {/* Offline Storage Indicator inside Settings Menu */}
                <StorageIndicator variant="menu" />
              </div>
            )}
          </div>

          {/* Extreme Right: Profile Icon (if logged in) or Login/Signup buttons (if logged out) */}
          {user ? (
            <div ref={profileRef} className="relative flex-shrink-0">
              <button 
                onClick={() => {
                  setIsProfileOpen(!isProfileOpen);
                  if (isSettingsOpen) setIsSettingsOpen(false);
                }}
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