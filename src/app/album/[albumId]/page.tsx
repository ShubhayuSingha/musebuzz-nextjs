// src/app/album/[albumId]/page.tsx

import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import Image from "next/image";
import AlbumContent from "./AlbumContent";

export const revalidate = 0;

interface AlbumProps {
  params: Promise<{
    albumId: string;
  }>;
}

export default async function Album(props: AlbumProps) {
  const params = await props.params;
  const { albumId } = params;

  const cookieStore = await cookies();
  
  const supabase = createServerComponentClient({
    cookies: () => cookieStore as any
  });

  const { data: album } = await supabase
    .from('albums')
    .select('*, songs(*), artists(*)')
    .eq('id', albumId)
    .single();

  if (!album) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-neutral-400">
        Album not found.
      </div>
    )
  }

  const { data: imageData } = supabase
    .storage
    .from('images')
    .getPublicUrl(album.image_path);

  // 🟢 STANDARD SIZING LOGIC (Matches PlaylistHeader)
  // Reduced max size to 6xl to ensure it fits within the fixed h-52 container
  const titleLength = album.title.length;
  let titleSizeClass = "text-4xl sm:text-5xl lg:text-6xl"; 

  if (titleLength > 40) {
    titleSizeClass = "text-2xl sm:text-3xl lg:text-4xl"; 
  } else if (titleLength > 15) { 
    titleSizeClass = "text-3xl sm:text-4xl lg:text-5xl"; 
  }

  // Format Year
  const releaseYear = album.release_date ? new Date(album.release_date).getFullYear() : null;

  return (
    <div 
      className=" 
        h-full 
        w-full 
        overflow-hidden 
        overflow-y-auto
      "
    >
      <div className="bg-gradient-to-b from-purple-900 to-black w-full">
        <div className="p-6">
          <div className="flex flex-col md:flex-row items-end gap-x-5">
            
            {/* IMAGE (Fixed Height) */}
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
              bg-neutral-800
            ">
              <Image 
                fill
                src={imageData.publicUrl}
                alt={album.title}
                className="object-cover"
              />
            </div>

            {/* TEXT CONTENT - FIXED HEIGHT CONTAINER */}
            {/* 🟢 Applied fix: 
                - lg:h-52 locks height to match image.
                - justify-end aligns text to bottom.
                - min-w-0 prevents overflow.
            */}
            <div className="
                flex flex-col gap-y-2 mt-4 md:mt-0 mb-2 w-full flex-1 min-w-0 
                justify-end lg:h-52
            ">
              <p className="hidden md:block font-semibold text-sm text-neutral-200 uppercase tracking-wider">
                Album
              </p>
              
              <div className="group flex flex-col gap-y-1">
                  <h1 className={`
                    text-white 
                    font-bold 
                    drop-shadow-lg 
                    line-clamp-2 
                    break-words
                    leading-none
                    pb-1
                    ${titleSizeClass}
                  `}>
                    {album.title}
                  </h1>

                  <p className="text-neutral-300 text-sm font-bold hover:underline cursor-pointer w-fit">
                    {album.artists?.name}
                  </p>
              </div>

              <div className="flex items-center gap-x-2 mt-2">
                  {releaseYear && (
                    <>
                        <span className="text-neutral-300 text-sm font-medium">
                            {releaseYear}
                        </span>
                        <span className="text-neutral-400 text-sm">•</span>
                    </>
                  )}
                  <p className="text-neutral-400 text-sm font-medium">
                    {album.songs.length} {album.songs.length === 1 ? 'song' : 'songs'}
                  </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-y-2 p-6 w-full">
        <AlbumContent 
          songs={album.songs} 
          albumName={album.title}
          albumId={album.id} 
        />
      </div>
    </div>
  );
}