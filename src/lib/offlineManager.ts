// src/lib/offlineManager.ts
import { 
  offlineDb, 
  type OfflineAlbum, 
  type OfflinePlaylist, 
  type OfflineSong,
  type OfflineSongReference 
} from './offlineDb';
import { 
  removeAudioFromCache, 
  removeImageFromCache,
  isAudioCached 
} from './offlineAudioStorage';

/**
 * Creates or updates an album in the offline database along with its references
 */
export async function saveAlbumToDb(album: OfflineAlbum, userId?: string): Promise<void> {
  const tables: any[] = [
    offlineDb.albums, 
    offlineDb.songs, 
    offlineDb.song_references
  ];
  if (userId && offlineDb.saved_albums) {
    tables.push(offlineDb.saved_albums);
  }

  await offlineDb.transaction('rw', tables, async () => {
    // 1. Save or update Album in catalog
    await offlineDb.albums.put(album);

    // 2. If userId is provided, associate album with the user in saved_albums
    if (userId && offlineDb.saved_albums) {
      await offlineDb.saved_albums.put({
        user_id: userId,
        album_id: album.id,
        downloaded_at: Date.now(),
        last_accessed_at: new Date().toISOString()
      });
    }

    // 3. Save individual songs & register references
    for (const song of album.songs) {
      // Ensure the song has album context attached
      const songWithAlbumContext: OfflineSong = {
        ...song,
        album_id: album.id,
        imageUrl: album.image_url || undefined,
        albums: {
          id: album.id,
          title: album.title,
          image_path: album.image_path,
          image_url: album.image_url || undefined,
          genre: album.genre,
          release_type: album.release_type,
          artists: album.artists ? {
            id: album.artists.id,
            name: album.artists.name
          } : undefined
        },
        downloaded_at: Date.now()
      };

      await offlineDb.songs.put(songWithAlbumContext);

      // Add song reference
      const refId = `${song.id}_album_${album.id}`;
      const ref: OfflineSongReference = {
        id: refId,
        song_id: song.id,
        parent_type: 'album',
        parent_id: album.id,
        created_at: Date.now()
      };
      await offlineDb.song_references.put(ref);
    }
  });
}

/**
 * Creates or updates a playlist in the offline database along with its references
 */
export async function savePlaylistToDb(playlist: OfflinePlaylist, userId?: string): Promise<void> {
  const resolvedUserId = userId || playlist.user_id;
  const tables: any[] = [
    offlineDb.playlists, 
    offlineDb.songs, 
    offlineDb.song_references
  ];
  if (resolvedUserId && offlineDb.liked_songs) {
    tables.push(offlineDb.liked_songs);
  }

  await offlineDb.transaction('rw', tables, async () => {
    // 1. Save or update Playlist (strictly use uploaded image if present, no song cover inheritance)
    const resolvedPlaylist: OfflinePlaylist = {
      ...playlist,
      user_id: resolvedUserId || playlist.user_id,
      image_url: playlist.image_path ? playlist.image_url : undefined
    };
    await offlineDb.playlists.put(resolvedPlaylist);

    // 2. If this is a Liked Songs playlist and we have user_id, populate user-scoped liked_songs table
    const isLiked = resolvedPlaylist.id === 'liked' || resolvedPlaylist.id.startsWith('liked_');
    if (isLiked && resolvedUserId && offlineDb.liked_songs) {
      for (const item of resolvedPlaylist.playlist_songs) {
        const songId = item.songs?.id;
        if (songId) {
          await offlineDb.liked_songs.put({
            user_id: resolvedUserId,
            song_id: songId,
            created_at: item.created_at || new Date().toISOString(),
            song_order: item.song_order
          });
        }
      }
    }

    // 3. Save individual songs & register references
    for (const item of playlist.playlist_songs) {
      const song = item.songs;
      if (!song) continue;

      await offlineDb.songs.put({
        ...song,
        downloaded_at: Date.now()
      });

      // Add song reference
      const refId = `${song.id}_playlist_${resolvedPlaylist.id}`;
      const ref: OfflineSongReference = {
        id: refId,
        song_id: song.id,
        parent_type: 'playlist',
        parent_id: resolvedPlaylist.id,
        created_at: Date.now()
      };
      await offlineDb.song_references.put(ref);
    }
  });
}

/**
 * Saves liked songs strictly to offlineDb.liked_songs and offlineDb.songs
 * (Mirroring Supabase 1:1; does NOT touch offlineDb.playlists)
 */
export async function saveLikedSongsToDb(
  userId: string,
  items: { created_at?: string; song_order: number; song: OfflineSong }[]
): Promise<void> {
  const tables: any[] = [
    offlineDb.songs,
    offlineDb.song_references,
    offlineDb.liked_songs,
    offlineDb.playlists
  ];

  await offlineDb.transaction('rw', tables, async () => {
    // 1. Purge any previous liked song records & references for this user
    await offlineDb.liked_songs.where('user_id').equals(userId).delete();
    await offlineDb.song_references.where('parent_id').equals(userId).delete();

    // Also remove any legacy pseudo-playlist record from offlineDb.playlists
    await offlineDb.playlists.delete(`liked_${userId}`);
    await offlineDb.playlists.delete('liked');

    // 2. Save each song, record its reference, and register in liked_songs
    for (const item of items) {
      const song = item.song;
      if (!song) continue;

      await offlineDb.songs.put({
        ...song,
        downloaded_at: Date.now()
      });

      const refId = `${song.id}_liked_${userId}`;
      await offlineDb.song_references.put({
        id: refId,
        song_id: song.id,
        parent_type: 'liked',
        parent_id: userId,
        created_at: Date.now()
      });

      await offlineDb.liked_songs.put({
        user_id: userId,
        song_id: song.id,
        created_at: item.created_at || new Date().toISOString(),
        song_order: item.song_order
      });
    }
  });
}

/**
 * Removes all liked songs for a user and cleans up unreferenced audio files
 */
export async function removeLikedSongsFromDb(userId: string): Promise<void> {
  const likedRows = await offlineDb.liked_songs.where('user_id').equals(userId).toArray();
  const songIds = likedRows.map((r) => r.song_id);

  // Also check if any legacy playlist exists with songs
  const legacyPlaylist = (await offlineDb.playlists.get(`liked_${userId}`)) || (await offlineDb.playlists.get('liked'));
  if (legacyPlaylist?.playlist_songs) {
    for (const ps of legacyPlaylist.playlist_songs) {
      if (ps.songs?.id && !songIds.includes(ps.songs.id)) {
        songIds.push(ps.songs.id);
      }
    }
  }

  await offlineDb.transaction('rw', [
    offlineDb.liked_songs,
    offlineDb.song_references,
    offlineDb.playlists
  ], async () => {
    await offlineDb.liked_songs.where('user_id').equals(userId).delete();
    await offlineDb.song_references.where('parent_id').equals(userId).delete();
    await offlineDb.playlists.delete(`liked_${userId}`);
    await offlineDb.playlists.delete('liked');
  });

  // Prune unreferenced songs and cached audio
  for (const songId of songIds) {
    await pruneSongIfUnreferenced(songId);
  }
}

/**
 * Prunes a song if no downloaded playlists or albums reference it anymore
 */
export async function pruneSongIfUnreferenced(songId: string): Promise<boolean> {
  const remainingRefs = await offlineDb.song_references
    .where('song_id')
    .equals(songId)
    .count();

  // If other albums or playlists still reference this song, do NOT delete it!
  if (remainingRefs > 0) {
    return false;
  }

  // No references left: safely delete song and purge audio file from cache
  const song = await offlineDb.songs.get(songId);
  if (song?.audio_url) {
    await removeAudioFromCache(song.audio_url);
  }

  await offlineDb.songs.delete(songId);
  return true;
}

/**
 * Removes an album and cleans up all unreferenced songs and audio.
 * If userId is passed, it only unlinks this album from the user's saved_albums
 * and only purges the audio if no other user has saved the album.
 */
export async function removeAlbumFromDb(albumId: string, userId?: string): Promise<void> {
  const album = await offlineDb.albums.get(albumId);
  if (!album) return;

  // 1. If userId is provided, remove user link from saved_albums
  if (userId && offlineDb.saved_albums) {
    try {
      await offlineDb.saved_albums.delete([userId, albumId]);
    } catch {}

    // Check if any other user still has this album saved
    const otherUsersCount = await offlineDb.saved_albums
      .where('album_id')
      .equals(albumId)
      .count();

    // If another user still has this album downloaded, keep the album & songs intact!
    if (otherUsersCount > 0) {
      return;
    }
  }

  const songIds = album.songs.map(s => s.id);

  await offlineDb.transaction('rw', [
    offlineDb.albums, 
    offlineDb.songs, 
    offlineDb.song_references
  ], async () => {
    // 1. Delete the album record
    await offlineDb.albums.delete(albumId);

    // 2. Delete all references belonging to this album
    await offlineDb.song_references
      .where('parent_id')
      .equals(albumId)
      .delete();
  });

  // 3. Prune songs whose reference count reached 0
  for (const songId of songIds) {
    await pruneSongIfUnreferenced(songId);
  }

  // 4. Clean up album cover if cached
  if (album.image_url) {
    await removeImageFromCache(album.image_url);
  }
}

/**
 * Removes a playlist and cleans up all unreferenced songs and audio
 */
export async function removePlaylistFromDb(playlistId: string, userId?: string): Promise<void> {
  const isLiked = playlistId === 'liked' || playlistId.startsWith('liked_');
  if (isLiked) {
    await removeLikedSongsFromDb(userId || '');
    return;
  }

  const playlist = await offlineDb.playlists.get(playlistId);
  if (!playlist) return;

  const songIds = playlist.playlist_songs.map(item => item.songs?.id).filter(Boolean) as string[];

  await offlineDb.transaction('rw', [
    offlineDb.playlists, 
    offlineDb.songs, 
    offlineDb.song_references
  ], async () => {
    // 1. Delete playlist record
    await offlineDb.playlists.delete(playlistId);

    // 2. Delete all references belonging to this playlist
    await offlineDb.song_references
      .where('parent_id')
      .equals(playlistId)
      .delete();
  });

  // 3. Prune songs whose reference count reached 0
  for (const songId of songIds) {
    await pruneSongIfUnreferenced(songId);
  }

  // 4. Clean up playlist cover image if cached
  if (playlist.image_url) {
    await removeImageFromCache(playlist.image_url);
  }
}

/**
 * Check if a specific playlist is completely downloaded
 */
export async function isPlaylistDownloaded(playlistId: string): Promise<boolean> {
  const playlist = await offlineDb.playlists.get(playlistId);
  return !!playlist;
}

/**
 * Check if a specific album is completely downloaded
 */
export async function isAlbumDownloaded(albumId: string): Promise<boolean> {
  const album = await offlineDb.albums.get(albumId);
  return !!album;
}

/**
 * Check if a specific song is downloaded and available offline
 */
export async function isSongDownloaded(songId: string): Promise<boolean> {
  const song = await offlineDb.songs.get(songId);
  if (!song) return false;
  if (!song.audio_url) return true;
  return await isAudioCached(song.audio_url);
}

/**
 * Get count of references for a song (for debugging/inspection)
 */
export async function getSongReferenceCount(songId: string): Promise<number> {
  return await offlineDb.song_references.where('song_id').equals(songId).count();
}

/**
 * Retrieves all offline playlists
 */
export async function getAllOfflinePlaylists(): Promise<OfflinePlaylist[]> {
  return await offlineDb.playlists.orderBy('downloaded_at').reverse().toArray();
}

/**
 * Retrieves all offline albums
 */
export async function getAllOfflineAlbums(): Promise<OfflineAlbum[]> {
  return await offlineDb.albums.orderBy('downloaded_at').reverse().toArray();
}

/**
 * Retrieves an offline song by ID (used by useSongById)
 */
export async function getOfflineSongById(songId: string): Promise<OfflineSong | undefined> {
  return await offlineDb.songs.get(songId);
}
