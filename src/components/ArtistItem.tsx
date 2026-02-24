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

  // 🟢 Use 'artist_images' bucket
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
            isolate
            will-change-transform
            transition-transform
            duration-300
            hover:-translate-y-2
          "
        >
          {/* INSET DEPTH */}
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

          {/* IMAGE - 🟢 Circular for Artists */}
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
              draggable={false}
              src={imageUrl}
              fill
              alt={artist.name}
              className="
                object-cover
                transition-transform
                duration-300
                ease-out
              "
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
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