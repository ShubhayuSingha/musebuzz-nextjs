import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import LikedView from "./components/LikedView";
import { withTimeout } from "@/lib/helpers";

export const revalidate = 0;

export default async function Liked() {
  const cookieStore = await cookies();

  const supabase = createServerComponentClient({
    cookies: () => cookieStore as any,
  });

  (supabase.auth as any).suppressGetSessionWarning = true;
  let user: any = null;
  try {
    const sessionRes = await supabase.auth.getSession();
    user = sessionRes?.data?.session?.user || null;
  } catch {
    user = null;
  }

  // If user is not authenticated on the server, return empty initial songs immediately (0ms delay)
  if (!user?.id) {
    return <LikedView initialSongs={[]} />;
  }

  const { data } = await withTimeout(
    supabase
      .from("liked_songs")
      .select(`
        *, 
        songs(
          *, 
          albums(
            id, 
            title, 
            image_path, 
            artists(id, name)
          )
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    3000
  ).catch(() => ({ data: [] }));

  const songs = data
    ? data.map((item: any) => {
        // Generate Image URL
        const imagePath = item.songs?.albums?.image_path;
        let imageUrl = '/images/album-placeholder.png'; // Fallback
        
        if (imagePath) {
           const { data: imgData } = supabase.storage.from('images').getPublicUrl(imagePath);
           imageUrl = imgData?.publicUrl || imageUrl;
        }

        return {
          ...item.songs,
          author: item.songs?.albums?.artists?.name || "Unknown Artist",
          album_title: item.songs?.albums?.title || "Unknown Album",
          liked_created_at: item.created_at,
          imageUrl: imageUrl, 
        };
      }).filter((s: any) => s.id)
    : [];

  return <LikedView initialSongs={songs} />;
}
