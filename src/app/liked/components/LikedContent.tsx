// src/app/liked/components/LikedContent.tsx
'use client';

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useUser } from "@supabase/auth-helpers-react";
import usePlayerStore from "@/stores/usePlayerStore";
import { BsPlayFill, BsPauseFill } from "react-icons/bs"; // Added Pause
import LikeButton from "@/components/LikeButton"; 
import PlayingAnimation from '@/components/PlayingAnimation'; // Added Visualizer

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
    // SMART TOGGLE LOGIC
    if (player.activeId === id) {
      if (player.isPlaying) {
        player.setIsPlaying(false);
      } else {
        player.setIsPlaying(true);
      }
    } else {
      player.setId(id);
      player.setIds(songs.map((song) => song.id), {
         type: 'playlist',
         title: 'Liked Songs'
      });
    }
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
      {songs.map((song, index) => {
        const isActive = player.activeId === song.id;
        const isPlaying = player.isPlaying;

        return (
          <li 
            key={song.id} 
            className={`
              flex 
              items-center 
              justify-between 
              p-3 
              rounded-md 
              transition 
              cursor-pointer 
              group
              ${isActive ? 'bg-neutral-800/50' : 'hover:bg-purple-950/50'}
            `}
            onClick={() => onPlay(song.id)}
          >
            {/* Left Side: Icon/Number/Visualizer */}
            <div className="flex items-center gap-x-4">
              <div className="flex items-center justify-center w-6 h-6 relative">
                 {/* Active & Playing -> Visualizer (Hover: Pause) */}
                 {isActive && isPlaying ? (
                    <>
                      <div className="group-hover:hidden">
                        <PlayingAnimation />
                      </div>
                      <BsPauseFill size={25} className="text-white hidden group-hover:block" />
                    </>
                 ) : (
                    /* Inactive OR Paused -> Number (Hover: Play) */
                    <>
                      <span className={`
                        font-medium 
                        group-hover:hidden 
                        ${isActive ? 'text-green-500' : 'text-neutral-400'}
                      `}>
                        {index + 1}
                      </span>
                      <BsPlayFill size={25} className="text-white hidden group-hover:block" />
                    </>
                 )}
              </div>

              {/* Title */}
              <div className="flex flex-col">
                <p className={`truncate font-medium ${isActive ? 'text-green-500' : 'text-white'}`}>
                  {song.title}
                </p>
                <p className="text-neutral-400 text-sm truncate">
                  {song.author}
                </p>
              </div>
            </div>

            {/* Right Side */}
            <div className="flex items-center gap-x-4">
              <LikeButton songId={song.id} />
              <span className="text-neutral-400 text-sm font-medium">
                {formatTime(song.duration_seconds)} 
              </span>
            </div>
          </li>
        );
      })}
    </ol>
   );
}
 
export default LikedContent;