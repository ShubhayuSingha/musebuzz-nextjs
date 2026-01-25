// src/components/AlbumItem.tsx
'use client';

import { supabase } from '@/lib/supabaseClient';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import MediaContextMenu from './MediaContextMenu'; // 🟢 Import the new wrapper

interface AlbumItemProps {
  album: any;
}

const FALLBACK_IMAGE = '/images/album-placeholder.png';

const AlbumItem: React.FC<AlbumItemProps> = ({ album }) => {
  const router = useRouter();

  const imageUrl = album.image_path
    ? supabase.storage
        .from('images')
        .getPublicUrl(album.image_path).data.publicUrl
    : FALLBACK_IMAGE;

  const handleClick = () => {
    router.push(`/album/${album.id}`);
  };

  return (
    // 🟢 WRAPPER: Handles the Right Click
    <MediaContextMenu 
        data={{
            id: album.id,
            type: 'album',
            title: album.title,
            artist_id: album.artists?.id // Ensure your query fetches artist ID if needed
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
          {/* INSET DEPTH (NO BLEED, NO GPU SPILL) */}
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

          {/* IMAGE */}
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
            <Image
              draggable={false}
              src={imageUrl}
              fill
              alt={album.title}
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
          <div className="flex flex-col w-full pt-4 gap-y-1">
            <p className="font-semibold truncate" title={album.title}>
              {album.title}
            </p>
            <p className="text-neutral-400 text-sm truncate">
              By {album.artists.name}
            </p>
          </div>
        </div>
    </MediaContextMenu>
  );
};

export default AlbumItem;