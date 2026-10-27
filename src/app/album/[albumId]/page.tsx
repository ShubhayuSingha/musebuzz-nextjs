import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import AlbumView from "./AlbumView";
import { withTimeout } from "@/lib/helpers";

export const revalidate = 0;

interface AlbumProps {
  params: Promise<{
    albumId: string;
  }>;
}

export default async function Album(props: AlbumProps) {
  const params = await props.params;
  const { albumId } = params;

  let album: any = null;
  let imageUrl = '/images/album-placeholder.png';
  let releaseYear: number | null = null;

  try {
    const cookieStore = await cookies();
    const supabase = createServerComponentClient({
      cookies: () => cookieStore as any
    });

    const albumQuery = supabase
      .from('albums')
      .select('*, songs(*), artists(*)')
      .eq('id', albumId)
      .single();

    const { data } = await withTimeout(albumQuery, 3000);

    if (data) {
      album = data;
      const { data: imageData } = supabase.storage
        .from('images')
        .getPublicUrl(album.image_path);

      imageUrl = imageData?.publicUrl || imageUrl;
      releaseYear = album.release_date ? new Date(album.release_date).getFullYear() : null;
    }
  } catch (e) {
    // Server fetch error or offline: AlbumView will hydrate from IndexedDB
  }

  return (
    <AlbumView 
      initialAlbum={album}
      initialImageUrl={imageUrl}
      initialReleaseYear={releaseYear}
      albumId={albumId}
    />
  );
}