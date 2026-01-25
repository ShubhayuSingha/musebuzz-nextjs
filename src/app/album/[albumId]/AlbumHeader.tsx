'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useUser } from '@supabase/auth-helpers-react';
import { toast } from 'react-hot-toast';
import { AiOutlineCheck, AiOutlinePlus } from 'react-icons/ai'; 
import useLibrary from '@/hooks/useLibrary';
import usePlaylistStore from '@/stores/usePlaylistStore';

interface AlbumHeaderProps {
  album: any;
  imageUrl: string;
  songsCount: number;
  releaseYear: number | null;
}

const AlbumHeader: React.FC<AlbumHeaderProps> = ({ album, imageUrl, songsCount, releaseYear }) => {
  const user = useUser();
  const library = useLibrary();
  const { refreshPlaylists } = usePlaylistStore();

  const [isSaved, setIsSaved] = useState(false);

  // Check initial save status
  useEffect(() => {
    if (!user) return;
    const checkStatus = async () => {
        const saved = await library.checkIsSaved(album.id);
        setIsSaved(saved);
    };
    checkStatus();
  }, [album.id, library, user]);

  const toggleSave = async () => {
      if (!user) return toast.error("Log in to save albums");

      if (isSaved) {
          await library.removeAlbum(album.id);
          setIsSaved(false);
          // 🟢 FIX: Removed duplicate toast.success (handled in useLibrary)
      } else {
          await library.addAlbum(album.id);
          setIsSaved(true);
          // 🟢 FIX: Removed duplicate toast.success (handled in useLibrary)
      }
      refreshPlaylists();
  };

  // SIZING LOGIC
  const titleLength = album.title.length;
  let titleSizeClass = "text-4xl sm:text-5xl lg:text-6xl"; 
  if (titleLength > 40) titleSizeClass = "text-2xl sm:text-3xl lg:text-4xl"; 
  else if (titleLength > 15) titleSizeClass = "text-3xl sm:text-4xl lg:text-5xl"; 

  return (
    <div className="bg-gradient-to-b from-purple-900 to-black w-full">
        <div className="p-6">
          <div className="flex flex-col md:flex-row items-end gap-x-5">
            
            {/* IMAGE */}
            <div className="
              relative h-32 w-32 lg:h-52 lg:w-52 rounded-md
              overflow-hidden shadow-2xl flex-shrink-0 bg-neutral-800
            ">
              <Image 
                fill
                src={imageUrl}
                alt={album.title}
                className="object-cover"
              />
            </div>

            {/* TEXT CONTENT */}
            <div className="flex flex-col gap-y-2 mt-4 md:mt-0 mb-2 w-full flex-1 min-w-0 justify-end lg:h-52">
              <p className="hidden md:block font-semibold text-sm text-neutral-200 uppercase tracking-wider">
                Album
              </p>
              
              <div className="group flex flex-col gap-y-1">
                  
                  {/* 🟢 CHANGE: Title & Button Row */}
                  <div className="flex items-center gap-x-3">
                      <h1 className={`text-white font-bold drop-shadow-lg line-clamp-2 break-words leading-none pb-1 ${titleSizeClass}`}>
                        {album.title}
                      </h1>

                      {/* SAVE BUTTON (Now beside title) */}
                      <button 
                        onClick={toggleSave}
                        className={`
                            p-2 rounded-full border transition hover:scale-105 flex-shrink-0
                            ${isSaved 
                                ? 'bg-green-500 border-green-500 text-black' 
                                : 'bg-transparent border-neutral-400 text-neutral-400 hover:border-white hover:text-white'
                            }
                        `}
                        title={isSaved ? "Remove from Library" : "Save to Library"}
                      >
                        {isSaved ? <AiOutlineCheck size={20} /> : <AiOutlinePlus size={20} />}
                      </button>
                  </div>

                  {/* Artist Name */}
                  <p className="text-neutral-300 text-sm font-bold hover:underline cursor-pointer w-fit mt-1">
                    {album.artists?.name}
                  </p>
              </div>

              {/* Meta Info */}
              <div className="flex items-center gap-x-2 mt-1">
                  {releaseYear && (
                    <>
                        <span className="text-neutral-300 text-sm font-medium">
                            {releaseYear}
                        </span>
                        <span className="text-neutral-400 text-sm">•</span>
                    </>
                  )}
                  <p className="text-neutral-400 text-sm font-medium">
                    {songsCount} {songsCount === 1 ? 'song' : 'songs'}
                  </p>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}

export default AlbumHeader;