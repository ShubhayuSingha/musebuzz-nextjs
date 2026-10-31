import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import LibraryContent, { LibraryItem } from "./components/LibraryContent";
import { withTimeout } from "@/lib/helpers";

export const revalidate = 0;

export default async function Library() {
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

  if (!user) {
    return (
      <div className="rounded-lg h-full w-full overflow-hidden overflow-y-auto px-6 mt-4 text-neutral-400">
        Please log in to view your library.
      </div>
    );
  }

  const userMetaData = user.user_metadata;
  const userName = userMetaData?.full_name || userMetaData?.name || 'User';

  // Run library queries concurrently with timeout protection
  const [playlistsRes, savedAlbumsRes, savedArtistsRes, likedCountRes, savedMixesRes] = await withTimeout(
    Promise.all([
      supabase.from('playlists').select('id, title, image_path, created_at, last_accessed_at, user_id').eq('user_id', user.id),
      supabase.from('saved_albums').select(`created_at, last_accessed_at, albums (id, title, image_path, artists ( id, name ))`).eq('user_id', user.id),
      supabase.from('saved_artists').select(`created_at, last_accessed_at, artists ( id, name, image_path )`).eq('user_id', user.id),
      supabase.from('liked_songs').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('user_context_settings').select('context_id, updated_at').eq('user_id', user.id).like('context_id', 'saved_mix:%')
    ]),
    3000
  ).catch(() => [
    { data: [] },
    { data: [] },
    { data: [] },
    { count: 0 },
    { data: [] }
  ]);

  const playlists = playlistsRes?.data;
  const savedAlbums = savedAlbumsRes?.data;
  const savedArtists = savedArtistsRes?.data;
  const likedCount = likedCountRes?.count;
  const savedMixesSettings = savedMixesRes?.data;

  // --- NORMALIZE DATA ---

  // 1. PLAYLISTS
  const normalizedPlaylists = (playlists || []).map((pl: any) => {
    let imageUrl = '/images/playlist-placeholder.jpg';
    if (pl.image_path) {
      const { data } = supabase.storage
        .from('playlist_images')
        .getPublicUrl(pl.image_path);
      imageUrl = data?.publicUrl || imageUrl;
    }

    return {
      id: pl.id,
      type: 'playlist' as const,
      title: pl.title,
      author: userName,
      created_at: pl.created_at,
      sort_date: pl.last_accessed_at || pl.created_at, 
      imageUrl: imageUrl
    }; 
  });

  // 2. ALBUMS
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

  // 3. ARTISTS
  const normalizedArtists = (savedArtists || []).map((item: any) => {
    const artist = item.artists;
    if (!artist) return null;

    let imageUrl = '/images/artist-placeholder.png';

    if (artist.image_path) {
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

  // 4. GENERATED MIXES (SAVED)
  let normalizedMixes: any[] = [];
  const mixIds = (savedMixesSettings || [])
    .map((r: any) => r.context_id?.replace('saved_mix:', ''))
    .filter(Boolean);

  if (mixIds.length > 0) {
    const { data: mixesData } = await withTimeout(
      supabase
        .from('generated_playlists')
        .select('*')
        .in('id', mixIds),
      2500
    ).catch(() => ({ data: [] }));

    if (mixesData && mixesData.length > 0) {
      normalizedMixes = mixesData.map((mix: any) => {
        const meta = (savedMixesSettings || []).find((r: any) => r.context_id === `saved_mix:${mix.id}`);
        return {
          id: mix.id,
          type: 'generated_playlist' as const,
          title: mix.title,
          author: 'MuseBuzz Mix',
          created_at: mix.created_at,
          sort_date: meta?.updated_at || mix.created_at,
          imageUrl: (!mix.image_url || mix.image_url.includes('playlist-placeholder'))
            ? '/images/mix-placeholder.png'
            : mix.image_url,
          song_ids: mix.song_ids
        };
      });
    }
  }

  // --- MERGE AND SORT ---
  const items: LibraryItem[] = [...normalizedPlaylists, ...normalizedAlbums, ...normalizedArtists, ...normalizedMixes]
    .sort((a, b) => {
        const dateA = new Date(a.sort_date).getTime();
        const dateB = new Date(b.sort_date).getTime();
        return dateB - dateA; 
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
