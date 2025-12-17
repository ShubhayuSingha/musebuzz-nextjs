// src/components/Header.tsx
'use client';

import Button from "./Button";
import useAuthModalStore from "@/stores/useAuthModalStore";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";
import { useRouter } from "next/navigation";

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
        h-fit 
        bg-black 
        py-3 
        px-6 
        border-b 
        border-neutral-700
      "
    >
      <div className="w-full flex items-center justify-between">
        <div className="hidden md:flex gap-x-2 items-center" />
        
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
                // ADDED 'py-2' HERE TO MATCH THE OTHER BUTTONS
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