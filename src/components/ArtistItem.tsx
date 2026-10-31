'use client';

import { supabase } from '@/lib/supabaseClient';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import MediaContextMenu from './MediaContextMenu';

interface ArtistItemProps {
  artist: any;
}

const FALLBACK_IMAGE = '/images/artist-placeholder.png';

const ArtistItem: React.FC<ArtistItemProps> = ({ artist }) => {
  const router = useRouter();

  const imageUrl = artist.image_path
    ? supabase.storage
        .from('artist_images')
        .getPublicUrl(artist.image_path).data.publicUrl
    : FALLBACK_IMAGE;

  const handleClick = () => {
    router.push(`/artist/${artist.id}`);
  };

  return (
    <MediaContextMenu
      data={{
        id: artist.id,
        type: 'artist',
        title: artist.name,
        artist_id: artist.id
      }}
    >
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
        {/* IMAGE - Circular for Artists */}
        <div
          className="
            relative
            aspect-square
            w-full
            rounded-full
            overflow-hidden
            shadow-lg
          "
          onDragStart={(e) => e.preventDefault()}
        >
          <Image
            unoptimized
            draggable={false}
            src={imageUrl || '/images/artist-placeholder.png'}
            fill
            alt={artist.name}
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            onError={(e) => {
              e.currentTarget.src = '/images/artist-placeholder.png';
            }}
          />
        </div>

        {/* TEXT */}
        <div className="flex flex-col w-full pt-4 gap-y-1 items-center text-center">
          <p className="font-semibold truncate w-full" title={artist.name}>
            {artist.name}
          </p>
          <p className="text-neutral-400 text-sm truncate">
            Artist
          </p>
        </div>
      </div>
    </MediaContextMenu>
  );
};

export default ArtistItem;
