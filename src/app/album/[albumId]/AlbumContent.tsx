// src/app/album/[albumId]/AlbumContent.tsx
'use client';

import usePlayerStore from '@/stores/usePlayerStore';
import { formatTime } from '@/lib/helpers';
import { BsPlayFill } from 'react-icons/bs';
import LikeButton from '@/components/LikeButton'; // 👈 Import LikeButton

interface AlbumContentProps {
  songs: any[];
}

const AlbumContent: React.FC<AlbumContentProps> = ({ songs }) => {
  const player = usePlayerStore();

  const onPlay = (id: string) => {
    player.setId(id);
    player.setIds(songs.map((song) => song.id));
  };

  if (songs.length === 0) {
    return <div className="mt-4 text-neutral-400">No songs in this album.</div>
  }

  return (
    <ol className="mt-4 flex flex-col gap-y-2">
      {songs.map((song, index) => (
        <li 
          key={song.id} 
          className="
            flex 
            items-center 
            justify-between 
            p-3 
            rounded-md 
            hover:bg-purple-950/50
            transition 
            cursor-pointer 
            group
          "
          onClick={() => onPlay(song.id)}
        >
          {/* Left side: Number/Play Icon and Title */}
          <div className="flex items-center gap-x-4">
            <div className="flex items-center justify-center w-6 relative">
              <span className="text-neutral-400 group-hover:opacity-0">{index + 1}</span>
              <div className="absolute opacity-0 group-hover:opacity-100 transition">
                <BsPlayFill size={20} className="text-white" />
              </div>
            </div>
            <p className="text-white truncate">{song.title}</p>
          </div>

          {/* Right side: Like Button and Duration */}
          <div className="flex items-center gap-x-4">
             {/* 👇 Add LikeButton here */}
             <LikeButton songId={song.id} />
             <span className="text-neutral-400">
               {formatTime(song.duration_seconds)}
             </span>
          </div>
        </li>
      ))}
    </ol>
  );
};

export default AlbumContent;