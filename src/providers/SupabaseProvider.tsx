'use client';

import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { Session } from '@supabase/supabase-js'; // 🟢 Import Session Type

interface SupabaseProviderProps {
  children: React.ReactNode;
  session: Session | null; // 🟢 FIX: Accept the session prop
}

const SupabaseProvider: React.FC<SupabaseProviderProps> = ({ 
  children,
  session // 🟢 Destructure it here
}) => {
  const [supabaseClient] = useState(() =>
    createClientComponentClient()
  );

  return (
    <SessionContextProvider 
      supabaseClient={supabaseClient} 
      initialSession={session} // 🟢 FIX: Pass it here for instant auth
    >
      {children}
    </SessionContextProvider>
  );
};

export default SupabaseProvider;