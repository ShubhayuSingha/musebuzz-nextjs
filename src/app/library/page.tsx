// src/app/library/page.tsx

import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import LibraryContent, { LibraryItem } from "./components/LibraryContent";

export const revalidate = 0;

export default async function Library() {
  const cookieStore = await cookies();
  const supabase = createServerComponentClient({
    cookies: () => cookieStore as any,
  });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return (
      <div className="rounded-lg h-full w-full overflow-hidden overflow-y-auto px-6 mt-4 text-neutral-400">
        Please log in to view your library.
      </div>
    );
  }

  const userMetaData = session.user.user_metadata;
  const userName = userMetaData?.full_name || userMetaData?.name || 'User';

  // 1. Fetch User Playlists
  const { data: playlists } = await supabase
    .from('playlists')
    .select('id, title, image_path, created_at, last_accessed_at, user_id')
    .eq('user_id', session.user.id);

  // 2. Fetch Saved Albums
  const { data: savedAlbums } = await supabase
    .from('saved_albums')
    .select(`
        created_at,
        last_accessed_at, 
        albums (
            id, 
            title, 
            image_path,
            artists ( id, name )
        )
    `)
    .eq('user_id', session.user.id);

  // 🟢 3. Fetch Saved Artists (NEW)
  const { data: savedArtists } = await supabase
    .from('saved_artists')
    .select(`
        created_at,
        last_accessed_at,
        artists ( id, name, image_path )
    `)
    .eq('user_id', session.user.id);

  // 4. Fetch Liked Songs Count
  const { count: likedCount } = await supabase
    .from('liked_songs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', session.user.id);

  // --- NORMALIZE DATA ---

  // RULE FOR PLAYLISTS
  const normalizedPlaylists = (playlists || []).map((pl: any) => {
    const imagePath = pl.image_path || 'playlist-placeholder.jpg';
    
    const { data } = supabase.storage
        .from('playlist_images')
        .getPublicUrl(imagePath);

    return {
      id: pl.id,
      type: 'playlist' as const,
      title: pl.title,
      author: userName,
      created_at: pl.created_at,
      sort_date: pl.last_accessed_at || pl.created_at, 
      imageUrl: data.publicUrl
    }; 
  });

  // RULE FOR ALBUMS
  const normalizedAlbums = (savedAlbums || []).map((item: any) => {
    const album = item.albums;
    if (!album) return null;

    let imageUrl = '/images/album-placeholder.png'; 

    if (album.image_path) {
      const { data } = supabase.storage
        .from('images')
        .getPublicUrl(album.image_path);
      imageUrl = data.publicUrl;
    }

    return {
      id: album.id,
      type: 'album' as const,
      title: album.title || "Unknown Album",
      author: album.artists?.name || "Unknown Artist",
      artist_id: album.artists?.id,
      created_at: item.created_at,
      sort_date: item.last_accessed_at || item.created_at,
      imageUrl: imageUrl
    };
  }).filter((item) => item !== null);

  // 🟢 RULE FOR ARTISTS (NEW)
  const normalizedArtists = (savedArtists || []).map((item: any) => {
    const artist = item.artists;
    if (!artist) return null;

    let imageUrl = '/images/artist-placeholder.png';

    if (artist.image_path) {
        // Use 'artist_images' bucket
        const { data } = supabase.storage
            .from('artist_images')
            .getPublicUrl(artist.image_path);
        imageUrl = data.publicUrl;
    }

    return {
        id: artist.id,
        type: 'artist' as const,
        title: artist.name,
        author: 'Artist',
        created_at: item.created_at,
        sort_date: item.last_accessed_at || item.created_at,
        imageUrl: imageUrl
    };
  }).filter((item) => item !== null);

  // --- MERGE AND SORT ---
  
  const items = [...normalizedPlaylists, ...normalizedAlbums, ...normalizedArtists]
    .sort((a, b) => {
        const dateA = new Date(a.sort_date).getTime();
        const dateB = new Date(b.sort_date).getTime();
        return dateB - dateA; 
    })
    .map(item => {
        const { sort_date, ...rest } = item; 
        return rest as LibraryItem;
    });

  return (
    <div className="
      rounded-lg 
      h-full 
      w-full 
      overflow-hidden 
      overflow-y-auto
    ">
      <div className="mt-2 mb-7 px-6">        
        <LibraryContent items={items} likedCount={likedCount || 0} />
      </div>
    </div>
  );
}