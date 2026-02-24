"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import MediaContextMenu from "./MediaContextMenu"; // 🟢 Switched to MediaContextMenu

interface MixPlaylistItemProps {
  data: any;
}

const MixPlaylistItem: React.FC<MixPlaylistItemProps> = ({ data }) => {
  const router = useRouter();

  const handleClick = () => {
    router.push(`/mix/${data.id}`);
  };

  return (
    // 🟢 Updated Data Props
    <MediaContextMenu 
      data={{ 
        id: data.id, 
        title: data.title, 
        type: 'generated_playlist', // New type
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
          isolate
          will-change-transform
          transition-transform
          duration-300
          hover:-translate-y-2
        "
      >
        {/* ... (Rest of the JSX remains exactly the same) ... */}
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
            className="
              object-cover
              transition-transform
              duration-300
              ease-out
            "
            src={data.image_url || "/images/liked.png"}
            fill
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