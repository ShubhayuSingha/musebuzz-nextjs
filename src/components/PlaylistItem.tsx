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
  let imageUrl = '/images/playlist-placeholder.jpg';

  if (playlist.image_path) {
    if ((playlist as any).image_url) {
      imageUrl = (playlist as any).image_url;
    } else {
      const { data: imageData } = supabaseClient
        .storage
        .from('playlist_images')
        .getPublicUrl(playlist.image_path);
      imageUrl = imageData?.publicUrl || imageUrl;
    }
  }

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
        bg-neutral-900/40
        hover:bg-neutral-800/80
        border
        border-neutral-800/60
        hover:border-neutral-700
        transition-all
        duration-200
        shadow-sm
        hover:shadow-md
        h-full
      "
    >
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
           ">
              <FaHeart className="text-white text-4xl drop-shadow-lg" />
           </div>
        ) : (
           <Image
             unoptimized
             draggable={false}
             src={imageUrl || '/images/playlist-placeholder.jpg'}
             fill
             alt={playlist.title}
             className="object-cover"
             sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
             onError={(e) => {
               e.currentTarget.src = '/images/playlist-placeholder.jpg';
             }}
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
