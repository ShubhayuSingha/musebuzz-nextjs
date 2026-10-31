"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import MediaContextMenu from "./MediaContextMenu";

interface MixPlaylistItemProps {
  data: any;
}

const MixPlaylistItem: React.FC<MixPlaylistItemProps> = ({ data }) => {
  const router = useRouter();

  const handleClick = () => {
    router.push(`/mix/${data.id}`);
  };

  return (
    <MediaContextMenu
      data={{
        id: data.id,
        title: data.title,
        type: 'generated_playlist',
        song_ids: data.song_ids
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
            draggable={false}
            className="object-cover"
            src={(!data.image_url || data.image_url.includes('playlist-placeholder')) ? '/images/mix-placeholder.png' : data.image_url}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
            alt="Mix Cover"
          />
        </div>

        {/* TEXT */}
        <div className="flex flex-col w-full pt-4 gap-y-1">
          <p className="font-semibold truncate w-full" title={data.title}>
            {data.title}
          </p>
          <p className="text-neutral-400 text-sm truncate w-full">
            {data.description || "Made for You"}
          </p>
        </div>
      </div>
    </MediaContextMenu>
  );
};

export default MixPlaylistItem;
