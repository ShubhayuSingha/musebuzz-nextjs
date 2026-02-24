import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import MixContent from "./components/MixContent"; 
import MixHeader from "./components/MixHeader";   

export const revalidate = 0;

interface MixPageProps {
  params: Promise<{
    mixId: string;
  }>;
}

export default async function MixPage(props: MixPageProps) {
  const params = await props.params;
  const { mixId } = params;

  const cookieStore = await cookies();
  const supabase = createServerComponentClient({
    cookies: () => cookieStore as any,
  });

  // 1. Fetch Mix Metadata
  const { data: mix, error } = await supabase
    .from("generated_playlists")
    .select("*")
    .eq("id", mixId)
    .single();

  if (error || !mix) {
    return notFound();
  }

  // 2. Fetch Songs (Raw DB Data)
  let songs: any[] = [];
  
  if (mix.song_ids && mix.song_ids.length > 0) {
    const { data: songsData } = await supabase
      .from("songs")
      .select(`
        *,
        albums (
          id,
          title,
          image_path,
          artists ( id, name )
        )
      `)
      .in("id", mix.song_ids);

    if (songsData) {
      // 3. Format data EXACTLY like PlaylistPage
      songs = mix.song_ids
        .map((id: string) => songsData.find((s: any) => s.id === id))
        .filter((s: any) => s !== undefined)
        .map((item: any) => {
            const imagePath = item.albums?.image_path;
            let imageUrl = '/images/album-placeholder.png';
            
            if (imagePath) {
               const { data: imgData } = supabase.storage.from('images').getPublicUrl(imagePath);
               imageUrl = imgData.publicUrl;
            }

            return {
                ...item,
                author: item.albums?.artists?.name || "Unknown Artist",
                album_title: item.albums?.title || "Unknown Album",
                album_id: item.albums?.id,
                imageUrl: imageUrl,
                added_at: null 
            };
        });
    }
  }

  const mixImage = mix.image_url || null;

  return (
    <div className="bg-black h-full w-full overflow-hidden overflow-y-auto">
      <MixHeader 
        playlist={mix} 
        imageUrl={mixImage} 
        songsCount={songs.length} 
      />
      <div className="flex flex-col gap-y-2 p-6 w-full">
        <MixContent 
           songs={songs} 
           playlistId={mix.id} 
           playlistTitle={mix.title}
           playlistCreatedAt={mix.created_at}
        />
      </div>
    </div>
  );
}