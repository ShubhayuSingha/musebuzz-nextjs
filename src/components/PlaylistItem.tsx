// src/components/PlaylistItem.tsx
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
        group
        relative
        flex
        flex-col
        rounded-xl
        p-3
        cursor-pointer
        select-none

        isolate
        will-change-transform

        transition-transform
        duration-300
        hover:-translate-y-2
      "
    >
      {/* INSET DEPTH (CLIPPED, NO BLEED) */}
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
          alt={playlist.title}
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
        <p
          className="font-semibold truncate"
          title={playlist.title}
        >
          {playlist.title}
        </p>

        <p className="text-neutral-400 text-sm truncate">
          Playlist
        </p>
      </div>
    </div>
  );
};

export default PlaylistItem;
