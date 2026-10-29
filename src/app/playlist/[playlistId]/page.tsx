import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import PlaylistView from "./PlaylistView";
import { withTimeout } from "@/lib/helpers";

export const revalidate = 0;

interface PlaylistPageProps {
  params: Promise<{
    playlistId: string;
  }>;
}

export default async function PlaylistPage(props: PlaylistPageProps) {
  const params = await props.params;
  const { playlistId } = params;

  if (playlistId === 'liked' || playlistId.startsWith('liked_')) {
    redirect('/liked');
  }

  let playlist: any = null;
  let songs: any[] = [];
  let imageUrl = '/images/playlist-placeholder.jpg';
  let shouldRedirectToMix = false;

  try {
    const cookieStore = await cookies();
    const supabase = createServerComponentClient({
      cookies: () => cookieStore as any
    });

    const playlistQuery = supabase
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
              genre,
              release_type,
              artists(id, name)
            )
          )
        )
      `)
      .eq('id', playlistId)
      .single();

    const { data, error } = await withTimeout(playlistQuery, 3000);

    if (!error && data) {
      playlist = data;

      songs = (playlist.playlist_songs || [])
        .sort((a: any, b: any) => a.song_order - b.song_order)
        .map((item: any) => {
          const imagePath = item.songs?.albums?.image_path;
          let songImg = '/images/album-placeholder.png'; 
          
          if (imagePath) {
            const { data: imgData } = supabase.storage.from('images').getPublicUrl(imagePath);
            songImg = imgData?.publicUrl || songImg;
          }

          return {
            ...item.songs,
            author: item.songs?.albums?.artists?.name || "Unknown Artist",
            album_title: item.songs?.albums?.title || "Unknown Album",
            album_id: item.songs?.albums?.id,
            added_at: item.created_at,
            imageUrl: songImg 
          };
        })
        .filter((song: any) => song.id);

      if (playlist.image_path) {
        const { data: imageData } = supabase.storage
          .from('playlist_images')
          .getPublicUrl(playlist.image_path);
        imageUrl = imageData?.publicUrl || imageUrl;
      }
    } else {
      // Defensive fallback: check if this is actually a generated mix
      const { data: mixData } = await supabase
        .from('generated_playlists')
        .select('id')
        .eq('id', playlistId)
        .maybeSingle();

      if (mixData) {
        shouldRedirectToMix = true;
      }
    }
  } catch (e) {
    // Server fetch error or offline: PlaylistView will hydrate from IndexedDB
  }

  if (shouldRedirectToMix) {
    redirect(`/mix/${playlistId}`);
  }

  return (
    <PlaylistView 
      initialPlaylist={playlist}
      initialSongs={songs}
      initialImageUrl={imageUrl}
      playlistId={playlistId}
    />
  );
}