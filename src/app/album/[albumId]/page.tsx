import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import AlbumContent from "./AlbumContent";
import AlbumHeader from "./AlbumHeader"; // 🟢 Import

export const revalidate = 0;

interface AlbumProps {
  params: Promise<{
    albumId: string;
  }>;
}

export default async function Album(props: AlbumProps) {
  const params = await props.params;
  const { albumId } = params;

  const cookieStore = await cookies();
  
  const supabase = createServerComponentClient({
    cookies: () => cookieStore as any
  });

  const { data: album } = await supabase
    .from('albums')
    .select('*, songs(*), artists(*)')
    .eq('id', albumId)
    .single();

  if (!album) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-neutral-400">
        Album not found.
      </div>
    )
  }

  const { data: imageData } = supabase
    .storage
    .from('images')
    .getPublicUrl(album.image_path);

  // Format Year
  const releaseYear = album.release_date ? new Date(album.release_date).getFullYear() : null;

  return (
    // 🟢 Added bg-black for consistency
    <div className="h-full w-full overflow-hidden overflow-y-auto bg-black">
      
      {/* 🟢 NEW HEADER COMPONENT */}
      <AlbumHeader 
        album={album}
        imageUrl={imageData.publicUrl}
        songsCount={album.songs.length}
        releaseYear={releaseYear}
      />

      <div className="flex flex-col gap-y-2 p-6 w-full">
        <AlbumContent 
          songs={album.songs} 
          albumName={album.title}
          albumId={album.id} 
        />
      </div>
    </div>
  );
}