import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import ArtistContent from "./components/ArtistContent";
import ArtistHeader from "./components/ArtistHeader";

export const revalidate = 0;

interface ArtistPageProps {
  params: Promise<{
    artistId: string;
  }>;
}

export default async function ArtistPage(props: ArtistPageProps) {
  const params = await props.params;
  const { artistId } = params;
  
  const cookieStore = await cookies();
  const supabase = createServerComponentClient({
    cookies: () => cookieStore as any
  });

  // 1. Fetch Artist Details
  const { data: artist, error: artistError } = await supabase
    .from('artists')
    .select('*')
    .eq('id', artistId)
    .single();

  if (artistError || !artist) {
    return notFound();
  }

  // 2. Fetch ALL Songs
  const { data: songsData } = await supabase
    .from('songs')
    .select('*, albums!inner(id, title, image_path, artist_id)')
    .eq('albums.artist_id', artistId);

  // 3. Fetch Albums
  const { data: albumsData } = await supabase
    .from('albums')
    .select('*')
    .eq('artist_id', artistId)
    .order('created_at', { ascending: false });

  // --- Normalization ---
  
  // Prepare Songs
  let songs = (songsData || []).map((song: any) => {
     const imgPath = song.albums?.image_path;
     let imageUrl = '/images/music-placeholder.png';
     if (imgPath) {
        const { data } = supabase.storage.from('images').getPublicUrl(imgPath);
        imageUrl = data.publicUrl;
     }

     return {
        ...song,
        author: artist.name,
        imageUrl: imageUrl,
        album_id: song.albums?.id
     };
  });

  // Sort Songs
  songs.sort((a, b) => {
      const albumA = a.albums?.title?.toLowerCase() || '';
      const albumB = b.albums?.title?.toLowerCase() || '';
      if (albumA < albumB) return -1;
      if (albumA > albumB) return 1;

      const songA = a.title.toLowerCase();
      const songB = b.title.toLowerCase();
      if (songA < songB) return -1;
      if (songA > songB) return 1;

      return 0;
  });

  // Prepare Albums
  const albums = (albumsData || []).map((album: any) => {
     const imgPath = album.image_path;
     let imageUrl = '/images/album-placeholder.png';
     if (imgPath) {
        const { data } = supabase.storage.from('images').getPublicUrl(imgPath);
        imageUrl = data.publicUrl;
     }

     return {
        ...album,
        author: artist.name,
        imageUrl: imageUrl,
        type: 'album'
     };
  });

  // Artist Image
  const artistImgPath = artist.image_path;
  let artistImageUrl = '/images/artist-placeholder.png';
  if (artistImgPath) {
     const { data } = supabase.storage.from('artist_images').getPublicUrl(artistImgPath);
     artistImageUrl = data.publicUrl;
  }

  return (
    // 🟢 CHANGE: Removed 'rounded-lg' to fix the corner clipping issue
    <div className="bg-black h-full w-full overflow-hidden overflow-y-auto">
        
        <ArtistHeader 
            artist={artist}
            imageUrl={artistImageUrl}
            songsCount={songs.length}
            albumsCount={albums.length}
        />

        <ArtistContent 
            artistName={artist.name}
            artistId={artist.id}
            songs={songs}
            albums={albums}
        />
    </div>
  );
}