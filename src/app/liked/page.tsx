// src/app/liked/page.tsx
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import LikedContent from "./components/LikedContent";
import Image from "next/image";

export const revalidate = 0;

export default async function Liked() {  
  const cookieStore = cookies();
  const supabase = createServerComponentClient({
    cookies: () => cookieStore
  });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { data } = await supabase
    .from('liked_songs')
    .select('*, songs(*, albums(*, artists(*)))')
    .eq('user_id', session?.user?.id)
    .order('created_at', { ascending: false });

  const songs = data ? data.map((item: any) => ({
    ...item.songs,
    author: item.songs.albums?.artists?.name || "Unknown Artist"
  })) : [];

  return (
    <div 
      className="
        bg-black
        h-full 
        w-full 
        overflow-hidden 
        overflow-y-auto
      "
    >
      {/* SECTION 1: HEADER
        This div handles the purple background. 
        It ends when the content inside it ends.
      */}
      <div className="bg-gradient-to-b from-purple-900 to-black w-full">
        <div className="p-6">
          <div className="flex flex-col md:flex-row items-end gap-x-5">
            {/* Heart Box */}
            <div className="
              relative 
              h-32 
              w-32 
              lg:h-52 
              lg:w-52
              bg-gradient-to-br from-violet-600 to-blue-600
              rounded-md
              flex items-center justify-center
              shadow-2xl
            ">
                <span className="text-white text-7xl lg:text-8xl">❤️</span>
            </div>

            {/* Text Info */}
            <div className="flex flex-col gap-y-2 mt-4 md:mt-0 mb-2">
              <p className="hidden md:block font-semibold text-sm text-neutral-200 uppercase tracking-wider">
                Playlist
              </p>
              <h1 className="text-white text-4xl sm:text-6xl lg:text-8xl font-bold drop-shadow-lg">
                Liked Songs
              </h1>
              <p className="text-neutral-300 text-sm font-medium mt-2">
                 {songs.length} {songs.length === 1 ? 'song' : 'songs'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: SONG LIST
        This is a separate div. It sits comfortably BELOW the header 
        in the standard neutral-900 background.
      */}
      <div className="flex flex-col gap-y-2 p-6 w-full">
        <LikedContent songs={songs} />
      </div>
    </div>
  );
}