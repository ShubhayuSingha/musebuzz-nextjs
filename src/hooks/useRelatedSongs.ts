import { useEffect, useState } from "react";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { Song } from "@/types";
import { toast } from "react-hot-toast";

const useRelatedSongs = (currentSongId?: string) => {
  const supabase = useSupabaseClient();
  const [relatedSongs, setRelatedSongs] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchRelated = async () => {
      // 1. Don't run if no song is playing
      if (!currentSongId) return;

      setIsLoading(true);

      try {
        // 2. Get the vector (brain) of the CURRENT song
        // We need this first to know "what" we are comparing against
        const { data: songData, error: songError } = await supabase
          .from("songs")
          .select("embedding")
          .eq("id", currentSongId)
          .single();

        if (songError || !songData?.embedding) {
          console.error("No embedding found for this song");
          setIsLoading(false);
          return;
        }

        // 3. Call the "Librarian" (our SQL function)
        const { data: relatedData, error: relatedError } = await supabase.rpc(
          "match_songs",
          {
            query_embedding: songData.embedding, // Pass the current song's vector
            match_threshold: 0.5,                // Similarity sensitivity (0.5 is a good balance)
            match_count: 5,                      // How many to fetch
            playing_song_id: currentSongId       // Exclude the song we are hearing right now
          }
        );

        if (relatedError) {
          console.error("RPC Error:", relatedError);
        } else {
          setRelatedSongs(relatedData || []);
        }

      } catch (error) {
        console.error("Error fetching related songs:", error);
        toast.error("Could not load recommendations");
      } finally {
        setIsLoading(false);
      }
    };

    fetchRelated();
  }, [currentSongId, supabase]);

  return { relatedSongs, isLoading };
};

export default useRelatedSongs;