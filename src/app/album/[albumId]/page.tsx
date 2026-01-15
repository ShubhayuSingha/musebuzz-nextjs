// src/app/album/[albumId]/page.tsx
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import Image from "next/image";
import AlbumContent from "./AlbumContent";

export const revalidate = 0;

interface AlbumProps {
  params: {
    albumId: string;
  }
}

export default async function Album({ params }: AlbumProps) {
  const cookieStore = cookies();
  const supabase = createServerComponentClient({
    cookies: () => cookieStore
  });

  // 1. Fetch Album Data
  const { data: album } = await supabase
    .from('albums')
    .select('*, songs(*), artists(*)')
    .eq('id', params.albumId)
    .single();

  if (!album) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-neutral-400">
        Album not found.
      </div>
    )
  }

  // 2. Get Public URL for the Album Art
  const { data: imageData } = supabase
    .storage
    .from('images')
    .getPublicUrl(album.image_path);

  // 3. Dynamic Font Size Logic
  const titleLength = album.title.length;
  let titleSizeClass = "text-4xl sm:text-6xl lg:text-8xl"; // Default (Huge)

  if (titleLength > 40) {
    titleSizeClass = "text-2xl sm:text-4xl lg:text-5xl"; // Smallest for very long titles
  } else if (titleLength > 20) {
    titleSizeClass = "text-3xl sm:text-5xl lg:text-6xl"; // Medium
  }

  return (
    <div 
      className="
        bg-neutral-900 
        h-full 
        w-full 
        overflow-hidden 
        overflow-y-auto
      "
    >
      {/* SECTION 1: HERO HEADER */}
      <div className="bg-gradient-to-b from-purple-900 to-black w-full">
        <div className="p-6">
          <div className="flex flex-col md:flex-row items-end gap-x-5">
            {/* Album Art Container */}
            <div className="
              relative 
              h-32 
              w-32 
              lg:h-52 
              lg:w-52
              rounded-md
              overflow-hidden
              shadow-2xl
              flex-shrink-0 
            ">
              <Image 
                fill
                src={imageData.publicUrl}
                alt={album.title}
                className="object-cover"
              />
            </div>

            {/* Album Info */}
            <div className="flex flex-col gap-y-2 mt-4 md:mt-0 mb-2 w-full">
              <p className="hidden md:block font-semibold text-sm text-neutral-200 uppercase tracking-wider">
                Album
              </p>
              
              {/* DYNAMIC TITLE HERE */}
              <h1 className={`
                text-white 
                font-bold 
                drop-shadow-lg 
                line-clamp-2 
                break-words
                ${titleSizeClass}
              `}>
                {album.title}
              </h1>

              <div className="flex items-center gap-x-2 mt-2">
                 <p className="text-neutral-300 text-sm font-bold hover:underline cursor-pointer">
                    {album.artists?.name}
                 </p>
                 <span className="text-neutral-400 text-sm">•</span>
                 <p className="text-neutral-400 text-sm font-medium">
                    {album.songs.length} {album.songs.length === 1 ? 'song' : 'songs'}
                 </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: SONG LIST */}
      <div className="flex flex-col gap-y-2 p-6 w-full">
        <AlbumContent songs={album.songs} />
      </div>
    </div>
  );
}