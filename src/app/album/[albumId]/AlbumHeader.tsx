'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useUser } from '@supabase/auth-helpers-react';
import { toast } from 'react-hot-toast';
import { HiCheck } from 'react-icons/hi2';
import { PiPlusBold } from 'react-icons/pi';
import { BsMusicNoteBeamed } from 'react-icons/bs';
import { RiWifiOffLine } from 'react-icons/ri';
import useLibrary from '@/hooks/useLibrary';
import usePlaylistStore from '@/stores/usePlaylistStore';
import useOfflineModeStore from '@/stores/useOfflineModeStore';
import DownloadButton from '@/components/DownloadButton';

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
  const [hasImageError, setHasImageError] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Check initial save status
  useEffect(() => {
    if (!user) return;
    const checkStatus = async () => {
      const saved = await library.checkIsSaved(album.id);
      setIsSaved(saved);
    };
    checkStatus();
  }, [album.id, library, user]);

  useEffect(() => {
    setHasImageError(false);
  }, [imageUrl]);

  const { isOnline, isOfflineMode } = useOfflineModeStore();

  const toggleSave = async () => {
    if (!isOnline || isOfflineMode) {
      return toast.error("Saving albums is not available offline");
    }

    if (!user) return toast.error("Log in to save albums");

    if (isSaved) {
      await library.removeAlbum(album.id);
      setIsSaved(false);
    } else {
      await library.addAlbum(album.id);
      setIsSaved(true);
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
        <div className="flex flex-col md:flex-row items-center md:items-end gap-x-5">

          {/* IMAGE */}
          <div className="
              relative h-32 w-32 lg:h-52 lg:w-52 rounded-md
              overflow-hidden shadow-2xl flex-shrink-0 bg-neutral-800
              flex items-center justify-center
            ">
            {!hasImageError && imageUrl ? (
              <Image
                unoptimized
                fill
                sizes="(max-width: 768px) 128px, 208px"
                src={imageUrl}
                alt={album.title}
                className="object-cover"
                onError={() => setHasImageError(true)}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-purple-800 via-indigo-950 to-neutral-900 flex items-center justify-center">
                <BsMusicNoteBeamed size={56} className="text-white/60 drop-shadow" />
              </div>
            )}
          </div>

          {/* TEXT CONTENT */}
          <div className="flex flex-col gap-y-2 mt-4 md:mt-0 mb-2 w-full flex-1 min-w-0 justify-end lg:h-52">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-xs md:text-sm text-neutral-200 uppercase tracking-wider">
                <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                  Album
                </span>
              </p>
              {mounted && (!isOnline || isOfflineMode) && (
                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-semibold flex items-center gap-1 select-none">
                  <RiWifiOffLine className="w-3 h-3" /> Offline
                </span>
              )}
            </div>

            <div className="group flex flex-col gap-y-1 text-center md:text-left">
              <h1 className={`text-white font-bold drop-shadow-lg line-clamp-2 break-words leading-none pb-1 ${titleSizeClass}`}>
                {album.title}
              </h1>

              {/* Artist Name */}
              {album.artists?.id || album.artist_id ? (
                <Link
                  href={`/artist/${album.artists?.id || album.artist_id}`}
                  className="text-neutral-300 text-sm font-bold hover:underline hover:text-white cursor-pointer mx-auto md:mx-0 mt-1 transition-colors"
                >
                  {album.artists?.name}
                </Link>
              ) : (
                <p className="text-neutral-300 text-sm font-bold mx-auto md:mx-0 mt-1">
                  {album.artists?.name}
                </p>
              )}
            </div>

            {/* Meta Info */}
            <div className="flex items-center justify-center md:justify-start gap-x-2 mt-1">
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

          {/* DOWNLOAD BUTTON (Requires album to be added to library first) */}
          <DownloadButton
            id={album.id}
            type="album"
            title={album.title}
            disabled={!isSaved}
            disabledTooltip={!user ? "Log in and save album to library before downloading" : "Add album to library before downloading"}
          />
        </div>
      </div>
    </div>
  );
}

export default AlbumHeader;
