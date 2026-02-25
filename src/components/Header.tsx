// src/components/Header.tsx
'use client';

import Button from "./Button";
import useAuthModalStore from "@/stores/useAuthModalStore";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";
import { useRouter } from "next/navigation";
import GlobalSearch from "@/components/GlobalSearch"; 
import usePlayerStore from "@/stores/usePlayerStore"; // 🟢 1. Import your player store

const Header = () => {
  const { onOpen } = useAuthModalStore();
  const supabaseClient = useSupabaseClient();
  const user = useUser();
  const router = useRouter();
  
  // 🟢 2. Extract ONLY the reset function (this prevents the Header from re-rendering every time the volume changes)
  const resetPlayer = usePlayerStore((state) => state.reset); 

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
        
        <div className="flex-1 flex items-center max-w-[500px]">
           <GlobalSearch />
        </div>
        
        {/* Auth Buttons Section */}
        <div className="flex justify-end items-center gap-x-4">
          {user ? (
            <Button 
              onClick={handleLogout}
              className="bg-white px-6 py-2 whitespace-nowrap"
            >
              Logout
            </Button>
          ) : (
            <>
              <Button 
                onClick={() => onOpen('sign_up')}
                className="bg-transparent text-neutral-300 font-medium whitespace-nowrap py-2"
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