// src/components/Header.tsx
'use client';

import Button from "./Button";
import useAuthModalStore from "@/stores/useAuthModalStore";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";
import { useRouter } from "next/navigation";
import GlobalSearch from "@/components/GlobalSearch"; // 1. Import the component

const Header = () => {
  const { onOpen } = useAuthModalStore();
  const supabaseClient = useSupabaseClient();
  const user = useUser();
  const router = useRouter();

  const handleLogout = async () => {
    const { error } = await supabaseClient.auth.signOut();
    router.refresh();
  };

  return (
    <div 
      className="
        sticky     /* 1. STICKY POSITIONING */
        top-0      /* 2. STICK TO TOP */
        z-50       /* 3. FLOAT ABOVE CONTENT */
        h-fit 
        bg-black 
        py-3 
        px-6 
        border-b 
        border-neutral-700
      "
    >
      <div className="w-full flex items-center justify-between gap-x-4">
        
        {/* 2. Search Bar Section 
           - Replaced the empty div
           - Added 'flex-1' so it takes up available space up to its max-width
           - Removed 'hidden' so it is visible on mobile too
        */}
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