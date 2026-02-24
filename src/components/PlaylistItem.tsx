'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { FaHeart } from 'react-icons/fa';
import MediaContextMenu from "./MediaContextMenu"; 

interface PlaylistItemProps {
  playlist: {
    id: string;
    title: string;
    image_path?: string;
    user_id: string;
    description?: string;
  };
}

const PlaylistItem: React.FC<PlaylistItemProps> = ({ playlist }) => {
  const router = useRouter();
  const supabaseClient = useSupabaseClient();

  const isLikedSongs = playlist.id === 'liked';
  const imagePath = playlist.image_path || 'playlist-placeholder.jpg';

  const { data: imageData } = supabaseClient
    .storage
    .from('playlist_images') 
    .getPublicUrl(imagePath);

  const imageUrl = imageData.publicUrl;

  const handleClick = () => {
    if (isLikedSongs) {
      router.push('/liked');
    } else {
      router.push(`/playlist/${playlist.id}`);
    }
  };

  const CardContent = (
    <div
      onClick={handleClick}
      className="
        group
        relative
        flex
        flex-col
        rounded-xl
        p-3
        cursor-pointer
        isolate
        will-change-transform
        transition-transform
        duration-300
        hover:-translate-y-2
      "
    >
      {/* INSET DEPTH SHADOW */}
      <div
        className="
          pointer-events-none
          absolute
          inset-0
          rounded-xl
          opacity-0
          group-hover:opacity-100 
          transition-opacity
          duration-300
          shadow-[inset_0_-14px_22px_-18px_rgba(0,0,0,0.55)]
        "
      />

      {/* IMAGE CONTAINER */}
      <div
        className="
          relative
          aspect-square
          w-full
          rounded-lg
          overflow-hidden
        "
        onDragStart={(e) => e.preventDefault()}
      >
        {isLikedSongs ? (
           <div className="
              w-full h-full 
              bg-gradient-to-br from-violet-600 to-blue-600 
              flex items-center justify-center
              transition-transform duration-300 ease-out
           ">
              <FaHeart className="text-white text-4xl drop-shadow-lg" />
           </div>
        ) : (
           <Image
             draggable={false}
             src={imageUrl}
             fill
             alt={playlist.title}
             className="
               object-cover
               transition-transform
               duration-300
               ease-out
             "
             sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
           />
        )}
      </div>

      {/* TEXT */}
      <div className="flex flex-col w-full pt-4 gap-y-1">
        <p className="font-semibold truncate text-white" title={playlist.title}>
          {playlist.title}
        </p>
        <p className="text-neutral-400 text-sm truncate">
          {isLikedSongs ? 'Your Favourites' : (playlist.user_id ? 'By You' : 'Playlist')}
        </p>
      </div>
    </div>
  );

  if (isLikedSongs) {
     return CardContent;
  }

  return (
    <MediaContextMenu 
      data={{ 
        id: playlist.id, 
        title: playlist.title, 
        type: 'playlist' 
      }}
    >
      {CardContent}
    </MediaContextMenu>
  );
};

export default PlaylistItem;