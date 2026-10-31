'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useUser } from '@supabase/auth-helpers-react';
import { toast } from 'react-hot-toast';
import { HiCheck } from 'react-icons/hi2';
import { PiPlusBold } from 'react-icons/pi';
import { RiWifiOffLine } from 'react-icons/ri';
import { BsStars } from 'react-icons/bs';

import useLibrary from '@/hooks/useLibrary';
import usePlaylistStore from '@/stores/usePlaylistStore';
import useOfflineModeStore from '@/stores/useOfflineModeStore';
import DownloadButton from '@/components/DownloadButton';

interface MixHeaderProps {
  playlist: any;
  imageUrl: string;
  songsCount: number;
}

const MixHeader: React.FC<MixHeaderProps> = ({ playlist, imageUrl, songsCount }) => {
  const router = useRouter();
  const user = useUser();
  const library = useLibrary();
  const { refreshPlaylists } = usePlaylistStore();

  const [isSaved, setIsSaved] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hasImageError, setHasImageError] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Check if mix is saved to user library
  useEffect(() => {
    if (!user) return;
    const checkStatus = async () => {
      const saved = await library.checkIsMixSaved(playlist.id);
      setIsSaved(saved);
    };
    checkStatus();
  }, [playlist.id, library, user]);

  const { isOnline, isOfflineMode } = useOfflineModeStore();

  const toggleSave = async () => {
    if (!isOnline || isOfflineMode) {
      return toast.error("Saving mixes is not available offline");
    }
    if (!user) return toast.error("Log in to save mixes");

    if (isSaved) {
      await library.removeMix(playlist.id);
      setIsSaved(false);
    } else {
      await library.addMix(playlist.id);
      setIsSaved(true);
    }
    refreshPlaylists();
  };

  // Determine image source - prioritize distinct mix placeholder if placeholder is used
  const displayImage = (!imageUrl || imageUrl.includes('playlist-placeholder'))
    ? '/images/mix-placeholder.png'
    : imageUrl;

  // SIZING LOGIC
  const title = playlist.title || "Mix";
  const titleLength = title.length;
  let titleSizeClass = "text-4xl sm:text-5xl lg:text-6xl";
  if (titleLength > 40) titleSizeClass = "text-2xl sm:text-3xl lg:text-4xl";
  else if (titleLength > 15) titleSizeClass = "text-3xl sm:text-4xl lg:text-5xl";

  return (
    <div className="bg-gradient-to-b from-purple-900 to-black w-full">
      <div className="p-6">
        <div className="flex flex-col md:flex-row items-center md:items-end gap-x-5">

          {/* IMAGE */}
          <div className="
            relative h-32 w-32 lg:h-52 lg:w-52 rounded-xl 
            overflow-hidden shadow-2xl flex-shrink-0 bg-neutral-800 
            flex items-center justify-center border border-purple-500/20
          ">
            {!hasImageError ? (
              <Image
                unoptimized
                fill
                sizes="(max-width: 768px) 128px, 208px"
                src={displayImage}
                alt={title}
                className="object-cover"
                onError={() => setHasImageError(true)}
              />
            ) : (
              <Image
                unoptimized
                fill
                sizes="(max-width: 768px) 128px, 208px"
                src="/images/mix-placeholder.png"
                alt={title}
                className="object-cover"
              />
            )}
          </div>

          {/* TEXT CONTENT */}
          <div className="
              flex flex-col gap-y-2 mt-4 md:mt-0 mb-2 w-full flex-1 min-w-0 
              justify-end lg:h-52
          ">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                Generated Mix
              </span>
              {mounted && (!isOnline || isOfflineMode) && (
                <span className="px-2 py-0.5 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-400 text-xs font-semibold flex items-center gap-1 select-none">
                  <RiWifiOffLine className="w-3 h-3" /> Offline
                </span>
              )}
            </div>

            <div className="group flex flex-col gap-y-1 text-center md:text-left">
              <div className="flex flex-col md:flex-row md:items-center gap-y-2 md:gap-x-4">
                <h1 className={`text-white font-bold drop-shadow-lg line-clamp-2 break-words leading-none pb-1 ${titleSizeClass}`}>
                  {title}
                </h1>
              </div>

              <p className="text-neutral-400 text-sm font-medium line-clamp-2 max-w-2xl mx-auto md:mx-0">
                {playlist.description || "Curated just for you by MuseBuzz"}
              </p>

              <div className="flex items-center justify-center md:justify-start gap-x-2 mt-2">
                <div className="relative h-6 w-6 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center overflow-hidden shadow">
                  <span className="text-[10px] text-white font-bold">M</span>
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

        {/* ACTION CONTROLS ROW */}
        <div className="flex items-center justify-center md:justify-start gap-x-4 mt-6">
          {/* SAVE BUTTON */}
          <button
            onClick={toggleSave}
            className={`
                inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm
                transition-all duration-200 hover:scale-[1.03] active:scale-95 shadow-md flex-shrink-0 cursor-pointer border
                ${isSaved
                ? 'bg-purple-500/20 border-purple-500/60 text-purple-300 hover:bg-purple-500/30 hover:border-purple-400 shadow-purple-900/30'
                : 'bg-neutral-800/90 border-neutral-600 text-white hover:bg-neutral-700 hover:border-neutral-500'
              }
            `}
            title={isSaved ? "In Library (Click to remove)" : "Save to Library"}
            aria-label={isSaved ? "Remove from Library" : "Save to Library"}
          >
            {isSaved
              ? <><HiCheck size={18} className="text-purple-300 flex-shrink-0" /><span>Saved</span></>
              : <><PiPlusBold size={18} className="flex-shrink-0" /><span>Add to Library</span></>
            }
          </button>

          {/* DOWNLOAD BUTTON (Only enabled if mix is added to library) */}
          <DownloadButton
            id={playlist.id}
            type="playlist"
            title={title}
            disabled={!isSaved}
            disabledTooltip={!user ? "Log in and save mix to library before downloading" : "Add mix to library before downloading"}
          />
        </div>
      </div>
    </div>
  );
};

export default MixHeader;
