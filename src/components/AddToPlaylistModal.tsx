// src/components/AddToPlaylistModal

'use client';

import React, { useEffect, useState } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';

import useAddToPlaylistModal from '@/stores/useAddToPlaylistModal';
import usePlayerStore from '@/stores/usePlayerStore'; // 🟢 Import Player Store
import Modal from './Modal'; 
import Button from './Button'; 

interface Playlist {
  id: string;
  title: string;
  user_id: string;
}

const AddToPlaylistModal = () => {
  const { isOpen, onClose, songId } = useAddToPlaylistModal();
  const supabaseClient = useSupabaseClient();
  const router = useRouter();
  const user = useUser();
  
  // 🟢 Initialize Player Store
  const player = usePlayerStore();

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 1. Fetch user's playlists when modal opens
  useEffect(() => {
    if (isOpen && user) {
      const fetchPlaylists = async () => {
        const { data, error } = await supabaseClient
          .from('playlists')
          .select('*')
          .eq('user_id', user.id)
          .eq('type', 'personal')
          .order('title', { ascending: true }); // 🟢 FIX: Sort Alphabetically

        if (data) setPlaylists(data);
        if (error) toast.error(error.message);
      };
      
      fetchPlaylists();
    }
  }, [isOpen, user, supabaseClient]);

  // 2. Handle adding the song
  const handleAdd = async (playlistId: string) => {
    if (!songId) return;
    setIsLoading(true);

    // Get current song count to set the new order
    const { count } = await supabaseClient
      .from('playlist_songs')
      .select('*', { count: 'exact', head: true })
      .eq('playlist_id', playlistId);
      
    const nextOrder = (count || 0) + 1;

    // Check if song already exists
    const { data: existing } = await supabaseClient
        .from('playlist_songs')
        .select('*')
        .eq('playlist_id', playlistId)
        .eq('song_id', songId)
        .single();

    if (existing) {
        setIsLoading(false);
        return toast.error("Song already in this playlist");
    }

    const { error } = await supabaseClient
      .from('playlist_songs')
      .insert({
        playlist_id: playlistId,
        song_id: songId,
        song_order: nextOrder
      });

    if (error) {
      toast.error(error.message);
    } else {
      // 🟢 SMART QUEUE: Add to active queue if playing this playlist
      player.syncPlaylistQueue(songId, playlistId, 'add');

      toast.success('Added to playlist');
      onClose();
      router.refresh(); 
    }
    
    setIsLoading(false);
  };

  const handleCreateNew = () => {
     onClose();
     toast('Use the sidebar to create a new playlist first!');
  };

  return (
    <Modal
      title="Add to Playlist"
      description="Select a playlist to add this song to."
      isOpen={isOpen}
      onChange={(open) => {
        if (!open) onClose();
      }}
    >
      <div className="flex flex-col gap-y-4">
        {playlists.length === 0 ? (
           <div className="text-center text-neutral-400 py-4">
              No playlists found.
              <Button onClick={handleCreateNew} className="mt-4">
                 Create New
              </Button>
           </div>
        ) : (
           <div className="flex flex-col gap-y-2 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
              {playlists.map((playlist) => (
                 <button
                    key={playlist.id}
                    disabled={isLoading}
                    onClick={() => handleAdd(playlist.id)}
                    className="
                       group flex items-center gap-x-3 w-full p-3 
                       rounded-md hover:bg-neutral-800 transition 
                       text-left disabled:opacity-50
                    "
                 >
                    {/* Simple Playlist Icon/Image */}
                    <div className="h-10 w-10 rounded-md bg-neutral-700 flex items-center justify-center overflow-hidden">
                        <div className="bg-gradient-to-br from-purple-700 to-blue-900 w-full h-full" />
                    </div>
                    
                    <div className="flex flex-col overflow-hidden">
                       <p className="font-medium truncate text-white group-hover:text-green-500 transition">
                          {playlist.title}
                       </p>
                    </div>
                 </button>
              ))}
           </div>
        )}
      </div>
    </Modal>
  );
};

export default AddToPlaylistModal;