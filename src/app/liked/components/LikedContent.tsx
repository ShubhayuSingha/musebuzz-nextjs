// src/app/liked/components/LikedContent.tsx
'use client';

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useUser } from "@supabase/auth-helpers-react";
import usePlayerStore from "@/stores/usePlayerStore";
import { BsPlayFill } from "react-icons/bs";

// We'll define a simple helper here in case imports are tricky, 
// matching your AlbumContent logic.
const formatTime = (seconds: number) => {
  if (!seconds) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
};

interface LikedContentProps {
  songs: any[];
}

const LikedContent: React.FC<LikedContentProps> = ({ songs }) => {
  const router = useRouter();
  const user = useUser();
  const player = usePlayerStore();

  useEffect(() => {
    if (!user) {
      router.replace('/');
    }
  }, [user, router]);

  const onPlay = (id: string) => {
    player.setId(id);
    // This ensures that after the liked song finishes, the next one in the list plays
    player.setIds(songs.map((song) => song.id)); 
  };

  if (songs.length === 0) {
    return (
      <div className="flex flex-col gap-y-2 w-full px-6 text-neutral-400 font-medium">
        No liked songs found.
      </div>
    );
  }

  return ( 
    <ol className="flex flex-col gap-y-2 w-full">
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
            {/* The Magic Number Container */}
            <div className="flex items-center justify-center w-6 relative">
              {/* The Number (Visible by default) */}
              <span className="text-neutral-400 font-medium group-hover:opacity-0 transition">
                {index + 1}
              </span>
              
              {/* The Play Icon (Visible on hover) */}
              <div className="absolute opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                <BsPlayFill size={20} className="text-white" />
              </div>
            </div>

            {/* Song Title & Artist */}
            <div className="flex flex-col">
              <p className="text-white truncate font-medium">
                {song.title}
              </p>
              <p className="text-neutral-400 text-sm truncate">
                {song.author}
              </p>
            </div>
          </div>

          {/* Right side: Duration */}
          <span className="text-neutral-400 text-sm font-medium">
            {formatTime(song.duration || 0)} 
          </span>
        </li>
      ))}
    </ol>
   );
}
 
export default LikedContent;