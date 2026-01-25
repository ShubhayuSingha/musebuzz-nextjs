'use client';

import Image from 'next/image';
import { BsPatchCheckFill, BsPersonFill } from 'react-icons/bs';

interface ArtistHeaderProps {
  artist: any;
  imageUrl: string;
  songsCount: number;
  albumsCount: number;
}

const ArtistHeader: React.FC<ArtistHeaderProps> = ({ artist, imageUrl, songsCount, albumsCount }) => {
  
  // SIZING LOGIC
  const title = artist?.name || 'Unknown Artist';
  const titleLength = title.length;
  let titleSizeClass = "text-4xl sm:text-5xl lg:text-6xl"; 
  if (titleLength > 40) titleSizeClass = "text-2xl sm:text-3xl lg:text-4xl"; 
  else if (titleLength > 15) titleSizeClass = "text-3xl sm:text-4xl lg:text-5xl"; 

  return (
    // 🟢 CHANGE: Use 'from-purple-900' to match PlaylistHeader
    <div className="bg-gradient-to-b from-purple-900 to-black w-full transition-all duration-500">
        <div className="p-6">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-x-5">
            
            {/* IMAGE (Fixed Height: h-32 mobile, h-52 desktop) - CIRCULAR for Artists */}
            <div className="
              relative h-32 w-32 lg:h-52 lg:w-52 rounded-full 
              overflow-hidden shadow-2xl flex-shrink-0 bg-neutral-800 
              flex items-center justify-center
              group
            ">
              {imageUrl ? (
                <Image 
                    fill 
                    src={imageUrl} 
                    alt={title} 
                    className="object-cover group-hover:scale-105 transition duration-500" 
                />
              ) : (
                <BsPersonFill size={80} className="text-neutral-500" />
              )}
            </div>

            {/* TEXT CONTENT */}
            {/* Added 'min-w-0' and 'lg:h-52' to match PlaylistHeader layout */}
            <div className="
                flex flex-col gap-y-2 mt-4 md:mt-0 mb-2 w-full flex-1 min-w-0 
                items-center md:items-start justify-end lg:h-52
            ">
              {/* Verified Badge */}
              <div className="flex items-center gap-x-2">
                  <BsPatchCheckFill className="text-blue-500" size={20} />
                  <p className="font-medium text-sm text-white uppercase tracking-wider">
                    Verified Artist
                  </p>
              </div>
              
              {/* Title */}
              <h1 className={`text-white font-black drop-shadow-lg text-center md:text-left leading-none pb-1 ${titleSizeClass}`}>
                {title}
              </h1>
              
              {/* Stats Row */}
              <div className="flex items-center gap-x-2 mt-2">
                  <p className="text-neutral-300 text-sm font-bold">
                      {albumsCount.toLocaleString()} {albumsCount === 1 ? 'Release' : 'Releases'}
                  </p>
                  <span className="text-neutral-400 text-sm">•</span>
                  <p className="text-neutral-300 text-sm font-medium">
                      {songsCount.toLocaleString()} {songsCount === 1 ? 'Song' : 'Songs'}
                  </p>
              </div>

            </div>
          </div>
        </div>
    </div>
  );
}

export default ArtistHeader;