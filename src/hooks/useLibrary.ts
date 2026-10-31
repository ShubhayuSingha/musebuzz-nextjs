// src/hooks/useLibrary.ts

import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";
import { toast } from "react-hot-toast";
import { useCallback } from "react"; 

import { offlineDb } from "@/lib/offlineDb";
import useOfflineModeStore from "@/stores/useOfflineModeStore";

const useLibrary = () => {
    const supabase = useSupabaseClient();
    const user = useUser();

    /* =========================
       ALBUMS
    ========================= */

    const addAlbum = async (albumId: string) => {
        if (!user) {
            toast.error("Please log in");
            return;
        }
        
        const { error } = await supabase
            .from('saved_albums')
            .insert({
                user_id: user.id,
                album_id: albumId
            });

        if (error) {
            if (error.code === '23505') {
                toast("Album already in library");
            } else {
                toast.error(error.message);
            }
        } else {
            toast.success('Added to Library');
        }
    };

    const removeAlbum = async (albumId: string) => {
        if (!user) return;

        const { error } = await supabase
            .from('saved_albums')
            .delete()
            .eq('user_id', user.id)
            .eq('album_id', albumId);

        if (error) {
            toast.error(error.message);
        } else {
            toast.success('Removed from Library');
        }
    };

    const checkIsSaved = useCallback(async (albumId: string) => {
        if (!user) return false;

        const { isOnline, isOfflineMode } = useOfflineModeStore.getState();
        const isOffline = !isOnline || isOfflineMode;

        // OFFLINE CHECK
        if (isOffline) {
            try {
                if (offlineDb.saved_albums) {
                    const saved = await offlineDb.saved_albums
                        .where('[user_id+album_id]')
                        .equals([user.id, albumId])
                        .first();
                    if (saved) return true;
                }
                const alb = await offlineDb.albums.get(albumId);
                return !!alb;
            } catch (err) {
                console.warn('[useLibrary] Error checking offline saved status:', err);
                return false;
            }
        }

        // ONLINE CHECK
        const { data } = await supabase
            .from('saved_albums')
            .select('album_id')
            .eq('user_id', user.id)
            .eq('album_id', albumId)
            .maybeSingle();

        return !!data;
    }, [user, supabase]);

    /* =========================
       ARTISTS
    ========================= */

    const followArtist = async (artistId: string) => {
        if (!user) {
            toast.error("Please log in");
            return;
        }

        const { error } = await supabase
            .from('saved_artists')
            .insert({
                user_id: user.id,
                artist_id: artistId
            });

        if (error) {
            if (error.code === '23505') {
                toast("Already following artist");
            } else {
                toast.error(error.message);
            }
        } else {
            toast.success('Followed Artist');
        }
    };

    const unfollowArtist = async (artistId: string) => {
        if (!user) return;

        const { error } = await supabase
            .from('saved_artists')
            .delete()
            .eq('user_id', user.id)
            .eq('artist_id', artistId);

        if (error) {
            toast.error(error.message);
        } else {
            toast.success('Unfollowed Artist');
        }
    };

    const checkIsArtistSaved = useCallback(async (artistId: string) => {
        if (!user) return false;
        const { data } = await supabase
            .from('saved_artists')
            .select('artist_id')
            .eq('user_id', user.id)
            .eq('artist_id', artistId)
            .maybeSingle();
        return !!data;
    }, [user, supabase]);

    const updateArtistAccess = async (artistId: string) => {
        if (!user || typeof navigator === 'undefined' || !navigator.onLine) return;
        
        try {
            await supabase
                .from('saved_artists')
                .update({ last_accessed_at: new Date().toISOString() })
                .eq('user_id', user.id)
                .eq('artist_id', artistId);
        } catch {
            // Silently ignore offline error
        }
    };

    /* =========================
       GENERATED MIXES
    ========================= */

    const addMix = async (mixId: string) => {
        if (!user) {
            toast.error("Please log in to save mixes");
            return;
        }

        const { error } = await supabase
            .from('user_context_settings')
            .upsert({
                user_id: user.id,
                context_id: `saved_mix:${mixId}`,
                updated_at: new Date().toISOString()
            });

        if (error) {
            toast.error(error.message);
        } else {
            toast.success('Added Mix to Library');
        }
    };

    const removeMix = async (mixId: string) => {
        if (!user) return;

        const { error } = await supabase
            .from('user_context_settings')
            .delete()
            .eq('user_id', user.id)
            .eq('context_id', `saved_mix:${mixId}`);

        if (error) {
            toast.error(error.message);
        } else {
            toast.success('Removed Mix from Library');
        }
    };

    const checkIsMixSaved = useCallback(async (mixId: string) => {
        if (!user) return false;

        const { isOnline, isOfflineMode } = useOfflineModeStore.getState();
        const isOffline = !isOnline || isOfflineMode;

        if (isOffline) {
            try {
                const offlinePl = await offlineDb.playlists.get(mixId);
                return !!offlinePl;
            } catch {
                return false;
            }
        }

        const { data } = await supabase
            .from('user_context_settings')
            .select('context_id')
            .eq('user_id', user.id)
            .eq('context_id', `saved_mix:${mixId}`)
            .maybeSingle();

        return !!data;
    }, [user, supabase]);

    return { 
        addAlbum, 
        removeAlbum, 
        checkIsSaved, 
        followArtist, 
        unfollowArtist, 
        checkIsArtistSaved,
        updateArtistAccess,
        addMix,
        removeMix,
        checkIsMixSaved
    };
};

export default useLibrary;
