// src/app/album/[albumId]/AlbumContent.tsx
'use client';

import usePlayerStore from '@/stores/usePlayerStore';
import { formatTime } from '@/lib/helpers';
import { BsPlayFill, BsPauseFill } from 'react-icons/bs'; // Added Pause Icon
import LikeButton from '@/components/LikeButton';
import PlayingAnimation from '@/components/PlayingAnimation'; // Added Visualizer

interface AlbumContentProps {
  songs: any[];
  albumName: string;
}

const AlbumContent: React.FC<AlbumContentProps> = ({ songs, albumName }) => {
  const player = usePlayerStore();

  const onPlay = (id: string) => {
    // SMART TOGGLE LOGIC
    if (player.activeId === id) {
      // If clicking the song that is ALREADY active...
      if (player.isPlaying) {
        player.setIsPlaying(false); // Pause it
      } else {
        player.setIsPlaying(true);  // Resume it
      }
    } else {
      // If clicking a NEW song...
      player.setId(id);
      player.setIds(songs.map((song) => song.id), {
        type: 'album',
        title: albumName
      });
    }
  };

  if (songs.length === 0) {
    return <div className="mt-4 text-neutral-400">No songs in this album.</div>
  }

  return (
    <ol className="mt-4 flex flex-col gap-y-2">
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
              ${isActive ? 'bg-neutral-800/50' : 'hover:bg-neutral-800/50'}
            `}
            onClick={() => onPlay(song.id)}
          >
            {/* Left side: Icon/Number and Title */}
            <div className="flex items-center gap-x-4">
              
              <div className="flex items-center justify-center w-6 h-6 relative">
                 {/* CASE 1: Active & Playing 
                    Show Visualizer. On hover, show Pause button.
                 */}
                 {isActive && isPlaying ? (
                    <>
                      <div className="group-hover:hidden">
                        <PlayingAnimation />
                      </div>
                      <BsPauseFill size={25} className="text-white hidden group-hover:block" />
                    </>
                 ) : (
                    /* CASE 2: Not Playing (Paused OR Inactive)
                       Show Number (Green if active). On hover, show Play button.
                    */
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

              {/* Title: Green if active */}
              <p className={`truncate font-medium ${isActive ? 'text-green-500' : 'text-white'}`}>
                {song.title}
              </p>
            </div>

            {/* Right side: Like Button and Duration */}
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
};

export default AlbumContent;