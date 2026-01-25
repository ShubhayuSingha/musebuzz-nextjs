// src/hooks/useLibrary.ts

import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";
import { toast } from "react-hot-toast";
import { useCallback } from "react"; 

const useLibrary = () => {
    const supabase = useSupabaseClient();
    const user = useUser();

    // Helper to add an album
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
            // Check for duplicate key error (already saved)
            if (error.code === '23505') {
                toast("Album already in library");
            } else {
                toast.error(error.message);
            }
        } else {
            toast.success('Added to Library');
        }
    };

    // Helper to remove an album
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

    // Helper to check if ONE album is saved (useful for Context Menu toggles)
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

    return { addAlbum, removeAlbum, checkIsSaved };
};

export default useLibrary;