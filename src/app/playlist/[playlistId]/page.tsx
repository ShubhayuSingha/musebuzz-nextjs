import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import PlaylistContent from "./PlaylistContent";
import PlaylistHeader from "./PlaylistHeader"; 

export const revalidate = 0;

interface PlaylistPageProps {
  params: Promise<{
    playlistId: string;
  }>;
}

export default async function PlaylistPage(props: PlaylistPageProps) {
  const params = await props.params;
  const { playlistId } = params;

  const cookieStore = await cookies();
  const supabase = createServerComponentClient({
    cookies: () => cookieStore as any
  });

  // 🟢 FIX: Comments removed from inside the string to prevent ParseError
  const { data: playlist, error } = await supabase
    .from('playlists')
    .select(`
      *, 
      playlist_songs(
        created_at, 
        song_order, 
        songs(
          *, 
          albums(
            id, 
            title, 
            image_path,
            artists(name)
          )
        )
      )
    `)
    .eq('id', playlistId)
    .single();

  if (error || !playlist) {
    return notFound();
  }

  const songs = playlist.playlist_songs
    ?.sort((a: any, b: any) => a.song_order - b.song_order)
    .map((item: any) => {
        // Generate Image URL
        const imagePath = item.songs.albums?.image_path;
        let imageUrl = '/images/album-placeholder.png'; // Fallback
        
        if (imagePath) {
           const { data: imgData } = supabase.storage.from('images').getPublicUrl(imagePath);
           imageUrl = imgData.publicUrl;
        }

        return {
          ...item.songs,
          author: item.songs.albums?.artists?.name || "Unknown Artist",
          album_title: item.songs.albums?.title || "Unknown Album",
          album_id: item.songs.albums?.id,
          added_at: item.created_at,
          imageUrl: imageUrl 
        };
    })
    .filter((song: any) => song.id); 

  const imagePath = playlist.image_path || 'playlist-placeholder.jpg';
  
  const { data: imageData } = supabase
    .storage
    .from('playlist_images')
    .getPublicUrl(imagePath);

  return (
    <div className="bg-black h-full w-full overflow-hidden overflow-y-auto">
      
      <PlaylistHeader 
        playlist={playlist} 
        imageUrl={imageData.publicUrl} 
        songsCount={songs.length} 
      />

      <div className="flex flex-col gap-y-2 p-6 w-full">
        <PlaylistContent 
           songs={songs} 
           playlistId={playlist.id} 
           playlistTitle={playlist.title}
        />
      </div>
    </div>
  );
}