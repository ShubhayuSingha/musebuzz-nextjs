import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import LikedContent from "./components/LikedContent";

export const revalidate = 0;

export default async function Liked() {
  const cookieStore = await cookies();

  const supabase = createServerComponentClient({
    cookies: () => cookieStore as any,
  });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { data } = await supabase
    .from("liked_songs")
    .select("*, songs(*, albums(*, artists(*)))")
    .eq("user_id", session?.user?.id)
    .order("created_at", { ascending: false });

  /**
   * IMPORTANT:
   * We enrich each song with:
   * - author (already done)
   * - album_title (NEW)
   * - liked_created_at (NEW) → used for date added
   */
  const songs = data
    ? data.map((item: any) => ({
        ...item.songs,
        author: item.songs.albums?.artists?.name || "Unknown Artist",
        album_title: item.songs.albums?.title || "Unknown Album",
        liked_created_at: item.created_at, 
      }))
    : [];

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
      {/* HEADER */}
      <div className="bg-gradient-to-b from-purple-900 to-black w-full">
        <div className="p-6">
          <div className="flex flex-col md:flex-row items-end gap-x-5">
            
            {/* IMAGE */}
            <div className="
                relative h-32 w-32 lg:h-52 lg:w-52 rounded-md 
                overflow-hidden shadow-2xl flex-shrink-0 
                bg-gradient-to-br from-violet-600 to-blue-600 
                flex items-center justify-center
            ">
              <span className="text-white text-7xl lg:text-8xl">❤️</span>
            </div>

            {/* TEXT CONTENT */}
            {/* Matches PlaylistHeader: min-w-0, justify-end, lg:h-52 */}
            <div className="
                flex flex-col gap-y-2 mt-4 md:mt-0 mb-2 w-full flex-1 min-w-0 
                justify-end lg:h-52
            ">
              <p className="hidden md:block font-semibold text-sm text-neutral-200 uppercase tracking-wider">
                Playlist
              </p>
              
              <div className="flex items-center gap-x-4">
                 <h1 className="text-white font-bold drop-shadow-lg line-clamp-2 break-words leading-none pb-1 text-4xl sm:text-5xl lg:text-6xl">
                    Liked Songs
                 </h1>
              </div>

              <div className="flex items-center gap-x-2 mt-2">
                  {/* User Avatar Placeholder */}
                  <div className="relative h-6 w-6 rounded-full bg-neutral-500 flex items-center justify-center overflow-hidden">
                      <span className="text-[10px] text-black font-bold">U</span>
                  </div>
                  
                  <p className="text-neutral-300 text-sm font-bold hover:underline cursor-pointer">
                      You
                  </p>
                  
                  <span className="text-neutral-400 text-sm">•</span>
                  
                  <p className="text-neutral-400 text-sm font-medium">
                      {songs.length} {songs.length === 1 ? "song" : "songs"}
                  </p>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* SONG LIST */}
      <div className="flex flex-col gap-y-2 p-6 w-full">
        <LikedContent songs={songs} />
      </div>
    </div>
  );
}