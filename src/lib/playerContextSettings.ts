// src/lib/playerContextSettings.ts

import { supabase } from '@/lib/supabaseClient';
import { PlayerContext } from '@/stores/usePlayerStore';

type ContextSettings = {
  shuffle_mode: boolean;
  repeat_mode: 'off' | 'context' | 'one';
};

/**
 * Build a canonical, globally-unique context id
 * Examples:
 *  album:<albumId>
 *  playlist:<playlistId>
 *  playlist:liked-songs
 */
export function getCanonicalContextId(context?: PlayerContext) {
  if (!context?.id) return null;
  return `${context.type}:${context.id}`;
}

/**
 * Load saved settings for a user + context
 */
export async function loadContextSettings(
  userId: string,
  context: PlayerContext
): Promise<ContextSettings | null> {
  const contextId = getCanonicalContextId(context);
  if (!contextId) return null;

  const { data, error } = await supabase
    .from('user_context_settings')
    .select('shuffle_mode, repeat_mode')
    .eq('user_id', userId)
    .eq('context_id', contextId)
    .single();

  if (error || !data) return null;
  return data as ContextSettings;
}

/**
 * Save (upsert) settings for a user + context
 */
export async function saveContextSettings(
  userId: string,
  context: PlayerContext,
  settings: ContextSettings
) {
  const contextId = getCanonicalContextId(context);
  if (!contextId) return;

  await supabase
    .from('user_context_settings')
    .upsert(
      {
        user_id: userId,
        context_id: contextId,
        shuffle_mode: settings.shuffle_mode,
        repeat_mode: settings.repeat_mode,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,context_id' }
    );
}
