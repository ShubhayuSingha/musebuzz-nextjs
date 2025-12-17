// src/app/page.tsx
'use client'; // <-- Now a Client Component

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient'; // <-- Use the client-side Supabase
import AlbumItem from '@/components/AlbumItem';
import Greeting from '@/components/Greeting'; // <-- Import our new component

export default function Home() {
  const [albums, setAlbums] = useState<any[]>([]);

  // Data fetching now happens inside a useEffect hook
  useEffect(() => {
    const fetchAlbums = async () => {
      const { data, error } = await supabase
        .from('albums')
        .select('*, artists(*)')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching albums:', error);
      } else if (data) {
        setAlbums(data);
      }
    };

    fetchAlbums();
  }, []);

  return (
    <div className="p-8">
      <Greeting /> {/* <-- Use the animated greeting here */}
      <p className="mt-4 text-zinc-400">
        Music buzzing every day.
      </p>

      <div className="mt-8">
        <h2 className="text-2xl font-semibold">Newest Albums</h2>
        <div
          className="
            grid 
            grid-cols-[repeat(auto-fill,180px)]
            gap-4 
            mt-4
          "
        >
          {albums?.map((album) => (
            <AlbumItem key={album.id} album={album} />
          ))}
        </div>
      </div>
    </div>
  );
}