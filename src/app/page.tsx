// src/app/page.tsx
    
import supabaseServer from "@/lib/supabaseServer";
import AlbumItem from "@/components/AlbumItem"; // Assuming AlbumItem is ready

export default async function Home() {
  const supabase = supabaseServer();
  
  const { data: albums } = await supabase
    .from('albums')
    .select('*, artists(*)')
    .order('created_at', { ascending: false });

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold">Welcome to MuseBuzz</h1>
      <p className="mt-4 text-zinc-400">
        Discover new music every day.
      </p>

      <div className="mt-8">
        <h2 className="text-2xl font-semibold">Newest Albums</h2>
        <div
          // THIS IS THE UPDATED LINE
          className="
            grid 
            grid-cols-[repeat(auto-fill,180px)]
            gap-4 
            mt-4
          "
        >
          {albums?.map((album) => (
            <AlbumItem key={album.id} album={album} />
          ))}
        </div>
      </div>
    </div>
  );
}