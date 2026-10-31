'use client';

import { supabase } from '@/lib/supabaseClient';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import MediaContextMenu from './MediaContextMenu';

interface AlbumItemProps {
  album: any;
}

const FALLBACK_IMAGE = '/images/album-placeholder.png';

const AlbumItem: React.FC<AlbumItemProps> = ({ album }) => {
  const router = useRouter();

  const imageUrl = album.image_url || (album.image_path
    ? supabase.storage
        .from('images')
        .getPublicUrl(album.image_path).data.publicUrl
    : FALLBACK_IMAGE);

  const handleClick = () => {
    router.push(`/album/${album.id}`);
  };

  return (
    <MediaContextMenu
      data={{
        id: album.id,
        type: 'album',
        title: album.title,
        artist_id: album.artists?.id
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
            unoptimized
            draggable={false}
            src={imageUrl || '/images/album-placeholder.png'}
            fill
            alt={album.title}
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            onError={(e) => {
              e.currentTarget.src = '/images/album-placeholder.png';
            }}
          />
        </div>

        {/* TEXT */}
        <div className="flex flex-col w-full pt-4 gap-y-1">
          <p className="font-semibold truncate" title={album.title}>
            {album.title}
          </p>
          <p className="text-neutral-400 text-sm truncate">
            By {album.artists?.name || 'Unknown Artist'}
          </p>
        </div>
      </div>
    </MediaContextMenu>
  );
};

export default AlbumItem;
