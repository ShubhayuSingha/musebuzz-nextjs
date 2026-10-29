'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { Session } from '@supabase/supabase-js';

interface SupabaseProviderProps {
  children: React.ReactNode;
  session: Session | null;
}

const SupabaseProvider: React.FC<SupabaseProviderProps> = ({ 
  children, 
  session 
}) => {
  const [supabaseClient] = useState(() =>
    createClientComponentClient()
  );

  // Clean stale ?code= from URL to prevent infinite token exchange retry loops and 429 rate limits
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('code=')) {
      const url = new URL(window.location.href);
      url.searchParams.delete('code');
      window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
    }
  }, []);

  return (
    <SessionContextProvider 
      supabaseClient={supabaseClient} 
      initialSession={session}
    >
      {children}
    </SessionContextProvider>
  );
};

export default SupabaseProvider;
