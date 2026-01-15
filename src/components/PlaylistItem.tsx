'use client';

import { supabase } from '@/lib/supabaseClient';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

interface PlaylistItemProps {
  playlist: any;
}

const FALLBACK_IMAGE = '/images/playlist-placeholder.png';

const PlaylistItem: React.FC<PlaylistItemProps> = ({ playlist }) => {
  const router = useRouter();

  const imageUrl = playlist.image_path
    ? supabase.storage
        .from('images')
        .getPublicUrl(playlist.image_path).data.publicUrl
    : FALLBACK_IMAGE;

  const handleClick = () => {
    router.push(`/playlist/${playlist.id}`);
  };

  return (
    <div
      onClick={handleClick}
      className="
        relative
        group
        flex
        flex-col
        items-center
        justify-center
        rounded-md
        overflow-hidden
        gap-x-4
        bg-neutral-400/5
        cursor-pointer
        hover:bg-purple-950/50
        transition
        p-3
        select-none
      "
    >
      <div
        className="relative aspect-square w-full h-full rounded-md overflow-hidden"
        onDragStart={(e) => e.preventDefault()}
      >
        <Image
          draggable={false}
          className="object-cover select-none"
          src={imageUrl}
          fill
          alt={playlist.title}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
      </div>

      <div className="flex flex-col items-start w-full pt-4 gap-y-1">
        <p
          className="font-semibold truncate w-full"
          title={playlist.title}
        >
          {playlist.title}
        </p>

        <p className="text-neutral-400 text-sm pb-4 w-full truncate">
          Playlist
        </p>
      </div>
    </div>
  );
};

export default PlaylistItem;
