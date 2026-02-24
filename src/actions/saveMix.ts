'use server'

import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 
}

export async function saveMixToLibrary(mixId: string) {
  const cookieStore = await cookies();
  const supabase = createServerComponentClient({ cookies: () => cookieStore as any });
  
  // 1. Auth Check
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
      return { success: false, error: "Unauthorized" };
  }
  const user_id = session.user.id;

  // 2. Fetch the Generated Mix Source
  const { data: mix, error: mixError } = await supabase
    .from('generated_playlists')
    .select('*')
    .eq('id', mixId)
    .single();

  if (mixError || !mix) {
      return { success: false, error: "Mix not found" };
  }

  // 3. Duplicate Name Logic (Windows/Mac Style)
  // Find all playlists that start with this title
  const { data: existing } = await supabase
    .from('playlists')
    .select('title')
    .eq('user_id', user_id)
    .ilike('title', `${escapeRegExp(mix.title)}%`);

  let finalTitle = mix.title;

  if (existing && existing.length > 0) {
    // Regex to match "Title" or "Title (N)"
    const regex = new RegExp(`^${escapeRegExp(mix.title)}(?: \\((\\d+)\\))?$`, 'i');
    let maxNum = 0;
    let exactMatchFound = false;
    
    existing.forEach(p => {
        // title might be null, though schema says NO for generated, playlists allow null. Safe check:
        const currentTitle = p.title || ""; 
        const match = currentTitle.match(regex);
        if (match) {
            if (currentTitle.toLowerCase() === mix.title.toLowerCase()) exactMatchFound = true;
            const num = match[1] ? parseInt(match[1]) : 0;
            if (num > maxNum) maxNum = num;
        }
    });
    
    // If we found "Title" or "Title (1)", the next one should be "Title (2)" (or max + 1)
    if (exactMatchFound || maxNum > 0) {
        finalTitle = `${mix.title} (${maxNum + 1})`;
    }
  }

  // 4. Create the Custom Playlist
  const { data: newPlaylist, error: insertError } = await supabase
    .from('playlists')
    .insert({
        title: finalTitle,
        description: `Saved from ${mix.title}`,
        user_id: user_id,
        image_path: null, // Will use default placeholder
        type: 'personal'
    })
    .select()
    .single();

  if (insertError) {
      return { success: false, error: insertError.message };
  }

  // 5. Bulk Insert Songs
  if (mix.song_ids && mix.song_ids.length > 0) {
      const playlistSongs = mix.song_ids.map((songId: string, index: number) => ({
          playlist_id: newPlaylist.id,
          song_id: songId,
          song_order: index
      }));
      
      const { error: songsError } = await supabase
          .from('playlist_songs')
          .insert(playlistSongs);
          
      if (songsError) {
          // Optional: Delete the playlist if songs failed to insert?
          // For now, let's just return the error.
          return { success: false, error: "Failed to add songs" };
      }
  }

  return { success: true, title: finalTitle };
}