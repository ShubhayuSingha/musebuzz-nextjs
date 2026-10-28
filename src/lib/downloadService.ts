// src/lib/downloadService.ts
import { SupabaseClient } from '@supabase/supabase-js';
import useDownloadStore from '@/stores/useDownloadStore';
import { 
  saveAlbumToDb, 
  savePlaylistToDb, 
  removeAlbumFromDb, 
  removePlaylistFromDb,
  pruneSongIfUnreferenced
} from './offlineManager';
import { 
  saveAudioToCache, 
  saveImageToCache, 
  removeImageFromCache,
  fetchImageAsDataUrl
} from './offlineAudioStorage';
import { offlineDb, type OfflineAlbum, type OfflinePlaylist, type OfflineSong } from './offlineDb';

/**
 * Downloads a complete album from Supabase, caches all audio & images, and stores metadata in IndexedDB
 */
export async function downloadAlbum(supabase: SupabaseClient, albumId: string): Promise<boolean> {
  const store = useDownloadStore.getState();

  try {
    store.setProgress(albumId, {
      id: albumId,
      type: 'album',
      title: 'Loading album...',
      current: 0,
      total: 0,
      percent: 0,
      status: 'fetching'
    });

    // 1. Fetch full album data with nested songs and artists
    const { data: album, error } = await supabase
      .from('albums')
      .select('*, songs(*), artists(*)')
      .eq('id', albumId)
      .single();

    if (error || !album) {
      throw new Error(error?.message || 'Album not found');
    }

    const songsCount = album.songs?.length || 0;
    const albumTitle = album.title || 'Album';

    // 2. Resolve and cache cover image
    let imageUrl: string | undefined = undefined;
    let localDataUrl: string | undefined = undefined;
    if (album.image_path) {
      const { data } = supabase.storage.from('images').getPublicUrl(album.image_path);
      imageUrl = data?.publicUrl;
      if (imageUrl) {
        await saveImageToCache(imageUrl);
        localDataUrl = (await fetchImageAsDataUrl(imageUrl)) || undefined;
      }
    }

    const resolvedImageUrl = localDataUrl || imageUrl;

    // 2b. Cache artist image if available
    let artistImageUrl: string | undefined = undefined;
    if (album.artists?.image_path) {
      const { data: artData } = supabase.storage.from('artist_images').getPublicUrl(album.artists.image_path);
      artistImageUrl = artData?.publicUrl;
      if (artistImageUrl) {
        await saveImageToCache(artistImageUrl);
      }
    }

    store.setProgress(albumId, {
      title: albumTitle,
      current: 0,
      total: songsCount,
      percent: 0,
      status: 'downloading'
    });

    // 3. Prepare songs with resolved audio URLs & download audio files sequentially
    const preparedSongs: OfflineSong[] = [];

    for (let i = 0; i < songsCount; i++) {
      const song = album.songs[i];
      let audioUrl: string | undefined = undefined;

      if (song.song_path) {
        const { data } = supabase.storage.from('songs').getPublicUrl(song.song_path);
        audioUrl = data?.publicUrl;
      }

      // Download audio MP3 into cache
      if (audioUrl) {
        await saveAudioToCache(audioUrl);
      }

      preparedSongs.push({
        id: song.id,
        title: song.title,
        duration_seconds: song.duration_seconds,
        album_id: album.id,
        song_path: song.song_path,
        audio_url: audioUrl,
        imageUrl: resolvedImageUrl,
        lyrics_snippet: song.lyrics_snippet,
        albums: {
          id: album.id,
          title: album.title,
          image_path: album.image_path,
          image_url: resolvedImageUrl,
          genre: album.genre,
          release_type: album.release_type,
          artists: album.artists ? {
            id: album.artists.id,
            name: album.artists.name
          } : undefined
        }
      });

      // Update progress
      const current = i + 1;
      const percent = Math.round((current / songsCount) * 100);
      store.setProgress(albumId, {
        current,
        percent
      });
    }

    // 4. Save full album to IndexedDB
    const offlineAlbum: OfflineAlbum = {
      id: album.id,
      title: album.title,
      image_path: album.image_path,
      image_url: resolvedImageUrl,
      genre: album.genre,
      release_type: album.release_type,
      artist_id: album.artist_id,
      created_at: album.created_at,
      downloaded_at: Date.now(),
      last_accessed_at: album.last_accessed_at || new Date().toISOString(),
      artists: album.artists ? {
        id: album.artists.id,
        name: album.artists.name,
        image_path: album.artists.image_path
      } : undefined,
      songs: preparedSongs
    };

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    await saveAlbumToDb(offlineAlbum, userId);

    store.setProgress(albumId, {
      status: 'completed',
      percent: 100
    });

    await store.refreshDownloadedStatus(userId);

    // Clear progress after short delay
    setTimeout(() => {
      store.clearProgress(albumId);
    }, 2000);

    return true;
  } catch (error: any) {
    console.error(`[Download Service] Failed to download album ${albumId}:`, error);
    store.setProgress(albumId, {
      status: 'error',
      errorMessage: error.message || 'Download failed'
    });
    return false;
  }
}

/**
 * Downloads all Liked Songs for the current user, caches all audio & images, and stores metadata in IndexedDB
 */
export async function downloadLikedSongs(supabase: SupabaseClient): Promise<boolean> {
  const store = useDownloadStore.getState();
  const likedPlaylistId = 'liked';

  try {
    store.setProgress(likedPlaylistId, {
      id: likedPlaylistId,
      type: 'playlist',
      title: 'Liked Songs',
      current: 0,
      total: 0,
      percent: 0,
      status: 'fetching'
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // 1. Fetch user's liked songs with song and album details
    const { data: likedItems, error } = await supabase
      .from('liked_songs')
      .select(`
        created_at,
        songs(
          *,
          albums(
            id,
            title,
            image_path,
            genre,
            release_type,
            artists(id, name, image_path)
          )
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error || !likedItems) {
      throw new Error(error?.message || 'Failed to fetch liked songs');
    }

    const totalSongs = likedItems.length;

    store.setProgress(likedPlaylistId, {
      title: 'Liked Songs',
      current: 0,
      total: totalSongs,
      percent: 0,
      status: 'downloading'
    });

    // 2. Prepare songs with resolved audio URLs & download audio files sequentially
    const preparedPlaylistSongs = [];

    for (let i = 0; i < totalSongs; i++) {
      const item = likedItems[i];
      const song = item.songs as any;

      if (song) {
        let audioUrl: string | undefined = undefined;
        if (song.song_path) {
          const { data } = supabase.storage.from('songs').getPublicUrl(song.song_path);
          audioUrl = data?.publicUrl;
        }

        // Cache audio MP3
        if (audioUrl) {
          await saveAudioToCache(audioUrl);
        }

        let songImageUrl: string | undefined = undefined;
        let songDataUrl: string | undefined = undefined;
        // Cache album cover for this song if present
        if (song.albums?.image_path) {
          const { data } = supabase.storage.from('images').getPublicUrl(song.albums.image_path);
          if (data?.publicUrl) {
            songImageUrl = data.publicUrl;
            await saveImageToCache(data.publicUrl);
            songDataUrl = (await fetchImageAsDataUrl(data.publicUrl)) || undefined;
          }
        }

        // Cache artist image if present
        if (song.albums?.artists?.image_path) {
          const { data: artData } = supabase.storage.from('artist_images').getPublicUrl(song.albums.artists.image_path);
          if (artData?.publicUrl) {
            await saveImageToCache(artData.publicUrl);
          }
        }

        const resolvedSongImage = songDataUrl || songImageUrl;

        preparedPlaylistSongs.push({
          created_at: item.created_at,
          song_order: i,
          songs: {
            ...song,
            audio_url: audioUrl,
            imageUrl: resolvedSongImage,
            albums: {
              ...song.albums,
              image_url: resolvedSongImage
            },
            downloaded_at: Date.now()
          }
        });
      }

      // Update progress
      const current = i + 1;
      const percent = Math.round((current / Math.max(totalSongs, 1)) * 100);
      store.setProgress(likedPlaylistId, {
        current,
        percent
      });
    }

    // 3. Save full liked songs playlist to IndexedDB (scoped to current user)
    const userLikedKey = `liked_${user.id}`;
    const offlinePlaylist: OfflinePlaylist = {
      id: userLikedKey,
      title: 'Liked Songs',
      image_path: null,
      image_url: null,
      user_id: user.id,
      created_at: new Date().toISOString(),
      downloaded_at: Date.now(),
      last_accessed_at: new Date().toISOString(),
      playlist_songs: preparedPlaylistSongs
    };

    await savePlaylistToDb(offlinePlaylist, user.id);

    store.setProgress(likedPlaylistId, {
      status: 'completed',
      percent: 100
    });

    await store.refreshDownloadedStatus(user.id);

    setTimeout(() => {
      store.clearProgress(likedPlaylistId);
    }, 2000);

    return true;
  } catch (error: any) {
    console.error(`[Download Service] Failed to download liked songs:`, error);
    store.setProgress(likedPlaylistId, {
      status: 'error',
      errorMessage: error.message || 'Download failed'
    });
    return false;
  }
}

/**
 * Downloads a complete playlist from Supabase, caches all audio & images, and stores metadata in IndexedDB
 */
export async function downloadPlaylist(supabase: SupabaseClient, playlistId: string): Promise<boolean> {
  if (playlistId === 'liked') {
    return downloadLikedSongs(supabase);
  }

  const store = useDownloadStore.getState();

  try {
    store.setProgress(playlistId, {
      id: playlistId,
      type: 'playlist',
      title: 'Loading playlist...',
      current: 0,
      total: 0,
      percent: 0,
      status: 'fetching'
    });

    // 1. Fetch full playlist with nested playlist_songs, songs, albums, and artists
    const { data: playlist, error } = await supabase
      .from('playlists')
      .select(`
        *, 
        playlist_songs(
          created_at, 
          song_order, 
          songs(
            *, 
            albums(
              id, 
              title, 
              image_path,
              genre,
              release_type,
              artists(id, name, image_path)
            )
          )
        )
      `)
      .eq('id', playlistId)
      .single();

    if (error || !playlist) {
      throw new Error(error?.message || 'Playlist not found');
    }

    const playlistSongs = playlist.playlist_songs || [];
    const totalSongs = playlistSongs.length;
    const playlistTitle = playlist.title || 'Playlist';

    // 2. Cache playlist cover image
    let imageUrl: string | undefined = undefined;
    let localDataUrl: string | undefined = undefined;
    if (playlist.image_path) {
      const { data } = supabase.storage.from('playlist_images').getPublicUrl(playlist.image_path);
      imageUrl = data?.publicUrl;
      if (imageUrl) {
        await saveImageToCache(imageUrl);
        localDataUrl = (await fetchImageAsDataUrl(imageUrl)) || undefined;
      }
    }

    const resolvedPlaylistImageUrl = localDataUrl || imageUrl;

    store.setProgress(playlistId, {
      title: playlistTitle,
      current: 0,
      total: totalSongs,
      percent: 0,
      status: 'downloading'
    });

    // 3. Download audio files sequentially
    const preparedPlaylistSongs = [];

    for (let i = 0; i < totalSongs; i++) {
      const item = playlistSongs[i];
      const song = item.songs;

      if (song) {
        let audioUrl: string | undefined = undefined;
        if (song.song_path) {
          const { data } = supabase.storage.from('songs').getPublicUrl(song.song_path);
          audioUrl = data?.publicUrl;
        }

        // Cache audio MP3
        if (audioUrl) {
          await saveAudioToCache(audioUrl);
        }

        let songImageUrl: string | undefined = undefined;
        let songDataUrl: string | undefined = undefined;
        // Cache album cover for this song if present
        if (song.albums?.image_path) {
          const { data } = supabase.storage.from('images').getPublicUrl(song.albums.image_path);
          if (data?.publicUrl) {
            songImageUrl = data.publicUrl;
            await saveImageToCache(data.publicUrl);
            songDataUrl = (await fetchImageAsDataUrl(data.publicUrl)) || undefined;
          }
        }

        // Cache artist image if present
        if (song.albums?.artists?.image_path) {
          const { data: artData } = supabase.storage.from('artist_images').getPublicUrl(song.albums.artists.image_path);
          if (artData?.publicUrl) {
            await saveImageToCache(artData.publicUrl);
          }
        }

        const resolvedSongImage = songDataUrl || songImageUrl;

        preparedPlaylistSongs.push({
          created_at: item.created_at,
          song_order: item.song_order,
          songs: {
            ...song,
            audio_url: audioUrl,
            imageUrl: resolvedSongImage,
            albums: {
              ...song.albums,
              image_url: resolvedSongImage
            },
            downloaded_at: Date.now()
          }
        });
      }

      // Update progress
      const current = i + 1;
      const percent = Math.round((current / totalSongs) * 100);
      store.setProgress(playlistId, {
        current,
        percent
      });
    }

    // 4. Save full playlist to IndexedDB
    const { data: authUserData } = await supabase.auth.getUser();
    const currentUserId = authUserData?.user?.id || playlist.user_id;

    const offlinePlaylist: OfflinePlaylist = {
      id: playlist.id,
      title: playlist.title,
      image_path: playlist.image_path || null,
      image_url: resolvedPlaylistImageUrl || null,
      user_id: currentUserId,
      created_at: playlist.created_at,
      downloaded_at: Date.now(),
      last_accessed_at: playlist.last_accessed_at || new Date().toISOString(),
      playlist_songs: preparedPlaylistSongs
    };

    await savePlaylistToDb(offlinePlaylist, currentUserId);

    store.setProgress(playlistId, {
      status: 'completed',
      percent: 100
    });

    await store.refreshDownloadedStatus(currentUserId);

    setTimeout(() => {
      store.clearProgress(playlistId);
    }, 2000);

    return true;
  } catch (error: any) {
    console.error(`[Download Service] Failed to download playlist ${playlistId}:`, error);
    store.setProgress(playlistId, {
      status: 'error',
      errorMessage: error.message || 'Download failed'
    });
    return false;
  }
}

/**
 * Checks for differences between local offline playlist and Supabase cloud playlist,
 * and syncs newly added or removed songs automatically.
 */
export async function syncPlaylist(supabase: SupabaseClient, playlistId: string): Promise<boolean> {
  if (playlistId === 'liked') {
    return downloadLikedSongs(supabase);
  }

  const store = useDownloadStore.getState();

  // If currently offline, skip sync
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false;
  }

  // Check if playlist is downloaded locally
  const localPlaylist = await offlineDb.playlists.get(playlistId);
  if (!localPlaylist) return false;

  try {
    store.setProgress(playlistId, {
      id: playlistId,
      type: 'playlist',
      title: localPlaylist.title,
      status: 'syncing',
      percent: 0
    });

    // Fetch fresh cloud playlist
    const { data: cloudPlaylist, error } = await supabase
      .from('playlists')
      .select(`
        *, 
        playlist_songs(
          created_at, 
          song_order, 
          songs(
            *, 
            albums(
              id, 
              title, 
              image_path,
              genre,
              release_type,
              artists(id, name)
            )
          )
        )
      `)
      .eq('id', playlistId)
      .single();

    if (error || !cloudPlaylist) {
      store.clearProgress(playlistId);
      return false;
    }

    const cloudSongs = cloudPlaylist.playlist_songs || [];
    const localSongIds = new Set(
      localPlaylist.playlist_songs.map((item: any) => item.songs?.id).filter(Boolean)
    );
    const cloudSongIds = new Set(
      cloudSongs.map((item: any) => item.songs?.id).filter(Boolean)
    );

    // 1. Identify newly added songs
    const newItems = cloudSongs.filter((item: any) => item.songs && !localSongIds.has(item.songs.id));

    // 2. Identify removed songs
    const removedIds = [...localSongIds].filter(id => !cloudSongIds.has(id));

    // If no changes, complete immediately
    if (newItems.length === 0 && removedIds.length === 0) {
      store.clearProgress(playlistId);
      return true;
    }

    console.log(`[Sync Engine] Syncing playlist "${localPlaylist.title}": +${newItems.length} added, -${removedIds.length} removed.`);

    // 3. Download newly added songs
    for (const item of newItems) {
      const song = item.songs;
      if (song?.song_path) {
        const { data } = supabase.storage.from('songs').getPublicUrl(song.song_path);
        const audioUrl = data?.publicUrl;
        if (audioUrl) {
          await saveAudioToCache(audioUrl);
          song.audio_url = audioUrl;
        }
      }
    }

    // 4. Remove references for deleted songs
    for (const songId of removedIds) {
      await offlineDb.song_references
        .where('id')
        .equals(`${songId}_playlist_${playlistId}`)
        .delete();
      await pruneSongIfUnreferenced(songId);
    }

    // 5. Update local playlist document with fresh songs
    const updatedPlaylistSongs = cloudSongs.map((item: any) => {
      const song = item.songs;
      let audioUrl = song?.audio_url;
      if (!audioUrl && song?.song_path) {
        const { data } = supabase.storage.from('songs').getPublicUrl(song.song_path);
        audioUrl = data?.publicUrl;
      }
      return {
        created_at: item.created_at,
        song_order: item.song_order,
        songs: {
          ...song,
          audio_url: audioUrl,
          downloaded_at: Date.now()
        }
      };
    });

    await savePlaylistToDb({
      ...localPlaylist,
      title: cloudPlaylist.title,
      playlist_songs: updatedPlaylistSongs,
      downloaded_at: Date.now()
    });

    store.setProgress(playlistId, {
      status: 'completed',
      percent: 100
    });

    setTimeout(() => {
      store.clearProgress(playlistId);
    }, 2000);

    return true;
  } catch (error) {
    console.error(`[Sync Engine] Error syncing playlist ${playlistId}:`, error);
    store.clearProgress(playlistId);
    return false;
  }
}

/**
 * Removes an album download from device
 */
export async function deleteAlbumDownload(albumId: string, supabase?: SupabaseClient): Promise<void> {
  const store = useDownloadStore.getState();
  let userId: string | undefined = undefined;
  if (supabase) {
    try {
      const { data } = await supabase.auth.getUser();
      userId = data?.user?.id;
    } catch {}
  }
  await removeAlbumFromDb(albumId, userId);
  await store.refreshDownloadedStatus(userId);
}

/**
 * Removes a playlist download from device
 */
export async function deletePlaylistDownload(playlistId: string, supabase?: SupabaseClient): Promise<void> {
  const store = useDownloadStore.getState();
  let userId: string | undefined = undefined;
  if (supabase) {
    try {
      const { data } = await supabase.auth.getUser();
      userId = data?.user?.id;
    } catch {}
  }
  await removePlaylistFromDb(playlistId, userId);
  await store.refreshDownloadedStatus(userId);
}
