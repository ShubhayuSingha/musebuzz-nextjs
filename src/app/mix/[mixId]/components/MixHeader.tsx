'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { BsMusicNoteBeamed } from 'react-icons/bs';

interface MixHeaderProps {
  playlist: any;
  imageUrl: string;
  songsCount: number;
}

const MixHeader: React.FC<MixHeaderProps> = ({ playlist, imageUrl, songsCount }) => {
  const router = useRouter();

  // SIZING LOGIC (Matched exactly to PlaylistHeader)
  const title = playlist.title || "Mix";
  const titleLength = title.length;
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
            flex items-center justify-center
          ">
            {imageUrl ? (
              <Image fill src={imageUrl} alt={title} className="object-cover" />
            ) : (
              <BsMusicNoteBeamed size={60} className="text-neutral-500" />
            )}
          </div>

          {/* TEXT CONTENT */}
          <div className="
              flex flex-col gap-y-2 mt-4 md:mt-0 mb-2 w-full flex-1 min-w-0 
              justify-end lg:h-52
          ">
            <p className="hidden md:block font-semibold text-sm text-neutral-200 uppercase tracking-wider">
              Generated Mix
            </p>
            
            <div className="group flex flex-col gap-y-1">
              <div className="flex items-center gap-x-4">
                <h1 className={`text-white font-bold drop-shadow-lg line-clamp-2 break-words leading-none pb-1 ${titleSizeClass}`}>
                  {title}
                </h1>
              </div>
              
              <p className="text-neutral-400 text-sm font-medium line-clamp-2 max-w-2xl">
                {playlist.description || "Curated just for you"}
              </p>

              <div className="flex items-center gap-x-2 mt-2">
                  <div className="relative h-6 w-6 rounded-full bg-green-500 flex items-center justify-center overflow-hidden">
                      <span className="text-[10px] text-black font-bold">M</span>
                  </div>
                  <p className="text-neutral-300 text-sm font-bold hover:underline cursor-pointer">
                      MuseBuzz
                  </p>
                  <span className="text-neutral-400 text-sm">•</span>
                  <p className="text-neutral-400 text-sm font-medium">
                      {songsCount} {songsCount === 1 ? 'song' : 'songs'}
                  </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MixHeader;