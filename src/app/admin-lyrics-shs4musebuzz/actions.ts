'use server';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zniinqiqnwndnowzzjyt.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function getAdminClient() {
  if (!serviceKey) {
    throw new Error('Supabase Service Role Key is missing. Check .env.local');
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Server action using Admin Service Role Key to update song lyrics
 * Bypasses client-side Row-Level Security (RLS) restrictions
 */
export async function updateSongLyrics(songId: string, lyricsSnippetJson: string) {
  try {
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from('songs')
      .update({ lyrics_snippet: lyricsSnippetJson })
      .eq('id', songId)
      .select('id, title, lyrics_snippet');

    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error(`Song not found or update not permitted for id: ${songId}`);
    }

    return { success: true, song: data[0] };
  } catch (err: any) {
    console.error('[updateSongLyrics] Error:', err);
    return { success: false, error: err?.message || 'Failed to update song lyrics' };
  }
}

