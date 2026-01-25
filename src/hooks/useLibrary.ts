// src/hooks/useLibrary.ts

import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";
import { toast } from "react-hot-toast";
import { useCallback } from "react"; 

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

    // 🟢 NEW FUNCTION: Updates 'last_accessed_at' to bring artist to top of sidebar
    const updateArtistAccess = async (artistId: string) => {
        if (!user) return;
        
        await supabase
            .from('saved_artists')
            .update({ last_accessed_at: new Date().toISOString() })
            .eq('user_id', user.id)
            .eq('artist_id', artistId);
    };

    return { 
        addAlbum, 
        removeAlbum, 
        checkIsSaved, 
        followArtist, 
        unfollowArtist, 
        checkIsArtistSaved,
        updateArtistAccess // 🟢 Exporting new function
    };
};

export default useLibrary;