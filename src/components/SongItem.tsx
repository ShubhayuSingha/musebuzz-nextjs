// src/components/SongItem.tsx
'use client';

import { supabase } from '@/lib/supabaseClient';
import Image from 'next/image';
import usePlayerStore from '@/stores/usePlayerStore'; 

interface SongItemProps {
  song: any;
}

const SongItem: React.FC<SongItemProps> = ({ song }) => {
  const { setId } = usePlayerStore(); 

  const { data: imageData } = supabase.storage
    .from('images')
    .getPublicUrl(song.albums.image_path);

  const handlePlay = () => {
    setId(song.id);
  };

  return (
    <div
      onClick={handlePlay} 
      className="
        relative group flex flex-col items-center justify-center 
        rounded-md overflow-hidden gap-x-4 bg-neutral-400/5 
        cursor-pointer hover:bg-neutral-400/10 transition p-3
      "
    >
      <div className="relative aspect-square w-full h-full rounded-md overflow-hidden">
        <Image
          className="object-cover"
          src={imageData.publicUrl}
          fill
          alt={song.title}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
      </div>
      <div className="flex flex-col items-start w-full pt-4 gap-y-1">
        {/* 👇 ADDED title attribute here */}
        <p className="font-semibold truncate w-full" title={song.title}>
            {song.title}
        </p>
        <p className="text-neutral-400 text-sm pb-4 w-full truncate">
          By {song.albums.artists.name}
        </p>
      </div>
    </div>
  );
};

export default SongItem;