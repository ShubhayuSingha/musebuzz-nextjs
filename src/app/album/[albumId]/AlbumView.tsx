'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { HiMusicalNote, HiSignalSlash } from 'react-icons/hi2';
import { offlineDb, type OfflineAlbum } from '@/lib/offlineDb';
import useOfflineModeStore from '@/stores/useOfflineModeStore';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import AlbumHeader from './AlbumHeader';
import AlbumContent from './AlbumContent';

interface AlbumViewProps {
  initialAlbum: any | null;
  initialImageUrl: string;
  initialReleaseYear: number | null;
  albumId: string;
}

export default function AlbumView({
  initialAlbum,
  initialImageUrl,
  initialReleaseYear,
  albumId,
}: AlbumViewProps) {
  const supabase = useSupabaseClient();
  const [album, setAlbum] = useState<any>(initialAlbum);
  const [imageUrl, setImageUrl] = useState<string>(initialImageUrl);
  const [releaseYear, setReleaseYear] = useState<number | null>(initialReleaseYear);
  const [isLoading, setIsLoading] = useState(!initialAlbum);

  const { isOnline, isOfflineMode } = useOfflineModeStore();

  useEffect(() => {
    const isDeviceOffline = !isOnline || isOfflineMode || (typeof navigator !== 'undefined' && !navigator.onLine);

    if (initialAlbum && !isDeviceOffline) {
      setAlbum(initialAlbum);
      setImageUrl(initialImageUrl);
      setReleaseYear(initialReleaseYear);
      setIsLoading(false);
      return;
    }

    const loadAlbumData = async () => {
      try {
        const offlineAlbum: OfflineAlbum | undefined = await offlineDb.albums.get(albumId);

        if (offlineAlbum) {
          setAlbum(offlineAlbum);
          setImageUrl(offlineAlbum.image_url || '/images/album-placeholder.png');
          const year = offlineAlbum.created_at ? new Date(offlineAlbum.created_at).getFullYear() : null;
          setReleaseYear(year);
          setIsLoading(false);
          return;
        }

        // If not in offline DB and device is online, fetch directly on client
        if (!isDeviceOffline) {
          setIsLoading(true);
          const { data, error } = await supabase
            .from('albums')
            .select('*, songs(*), artists(*)')
            .eq('id', albumId)
            .single();

          if (!error && data) {
            let imgUrl = '/images/album-placeholder.png';
            if (data.image_path) {
              const { data: imgData } = supabase.storage
                .from('images')
                .getPublicUrl(data.image_path);
              imgUrl = imgData?.publicUrl || imgUrl;
            }
            const year = data.release_date ? new Date(data.release_date).getFullYear() : null;
            setAlbum(data);
            setImageUrl(imgUrl);
            setReleaseYear(year);
            setIsLoading(false);
            return;
          }
        }
      } catch (err) {
        console.error('[AlbumView] Failed to load album:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadAlbumData();
  }, [initialAlbum, initialImageUrl, initialReleaseYear, albumId, isOnline, isOfflineMode, supabase]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-400 gap-y-3">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">Loading album...</p>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center mb-4">
          <HiSignalSlash className="w-8 h-8 text-zinc-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Album Not Available Offline</h2>
        <p className="text-zinc-400 max-w-sm text-sm mb-6">
          This album has not been downloaded to your device yet. Connect to the internet to listen or browse your offline library.
        </p>
        <Link
          href="/library"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition-transform active:scale-95"
        >
          <HiMusicalNote className="w-4 h-4" />
          Go to Library
        </Link>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-hidden overflow-y-auto bg-black">
      <AlbumHeader 
        album={album}
        imageUrl={imageUrl}
        songsCount={album.songs?.length || 0}
        releaseYear={releaseYear}
      />

      <div className="flex flex-col gap-y-2 p-6 w-full">
        <AlbumContent 
          songs={album.songs || []} 
          albumName={album.title}
          albumId={album.id} 
          artistId={album.artists?.id}
        />
      </div>
    </div>
  );
}
