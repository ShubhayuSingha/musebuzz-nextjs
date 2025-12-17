'use client';

import { supabase } from '@/lib/supabaseClient';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

interface AlbumItemProps {
  album: any;
}

const AlbumItem: React.FC<AlbumItemProps> = ({ album }) => {
  const router = useRouter();

  const { data: imageData } = supabase.storage
    .from('images')
    .getPublicUrl(album.image_path);

  const handleClick = () => {
    router.push(`/album/${album.id}`);
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
      "
    >
      <div className="relative aspect-square w-full h-full rounded-md overflow-hidden">
        <Image
          className="object-cover"
          src={imageData.publicUrl}
          fill
          alt={album.title}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
      </div>
      <div className="flex flex-col items-start w-full pt-4 gap-y-1">
        <p className="font-semibold truncate w-full">{album.title}</p>
        <p className="text-neutral-400 text-sm pb-4 w-full truncate">
          By {album.artists.name}
        </p>
      </div>
    </div>
  );
};

export default AlbumItem;