// src/lib/downloadService.ts
import { SupabaseClient } from '@supabase/supabase-js';
import useDownloadStore from '@/stores/useDownloadStore';
import { 
  saveAlbumToDb, 
  savePlaylistToDb, 
  saveLikedSongsToDb,
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
 * Precaches the page shell (HTML + RSC payload) into CacheStorage so navigating offline loads instantly
 */
async function precachePageShell(routePath: string) {
  if (typeof window === 'undefined' || !('caches' in window) || !navigator.onLine) return;
  try {
    const pagesCache = await caches.open('musebuzz-pages-v3');
    const rscCache = await caches.open('musebuzz-rsc-v3');

    // 1. HTML shell
    fetch(routePath).then((res) => {
      if (res.status === 200) pagesCache.put(routePath, res);
    }).catch(() => {});

    // 2. RSC payload
    fetch(routePath, { headers: { RSC: '1' } }).then((res) => {
      if (res.status === 200) {
        rscCache.put(routePath, res.clone());
        rscCache.put(`${routePath}?_rsc=offline`, res);
      }
    }).catch(() => {});
  } catch {}
}

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

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    // 3. Prepare songs with resolved audio URLs & download audio files sequentially
    const preparedSongs: OfflineSong[] = [];

    for (let i = 0; i < songsCount; i++) {
      if (store.isCancelled(albumId)) {
        return false;
      }

      if (store.isPaused(albumId)) {
        if (preparedSongs.length > 0) {
          const offlineAlbumDraft: OfflineAlbum = {
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
          await saveAlbumToDb(offlineAlbumDraft, userId);
          await store.refreshDownloadedStatus(userId);
        }
        return false;
      }

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

      const preparedSong: OfflineSong = {
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
      };

      preparedSongs.push(preparedSong);

      // Save song to offlineDb.songs and record reference immediately
      await offlineDb.songs.put(preparedSong);
      await offlineDb.song_references.put({
        id: `${song.id}_album_${album.id}`,
        song_id: song.id,
        parent_type: 'album',
        parent_id: album.id,
        created_at: Date.now()
      });

      // Real-time green badge
      store.addDownloadedSongId(song.id);

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

    await saveAlbumToDb(offlineAlbum, userId);
    precachePageShell(`/album/${albumId}`);

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
export async function downloadLikedSongs(supabase: SupabaseClient, silent = false): Promise<boolean> {
  const store = useDownloadStore.getState();
  const likedPlaylistId = 'liked';

  try {
    if (!silent) {
      store.setProgress(likedPlaylistId, {
        id: likedPlaylistId,
        type: 'playlist',
        title: 'Liked Songs',
        current: 0,
        total: 0,
        percent: 0,
        status: 'fetching'
      });
    }

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

    if (!silent) {
      store.setProgress(likedPlaylistId, {
        title: 'Liked Songs',
        current: 0,
        total: totalSongs,
        percent: 0,
        status: 'downloading'
      });
    }

    // 2. Prepare songs with resolved audio URLs & download audio files sequentially
    const preparedPlaylistSongs = [];

    for (let i = 0; i < totalSongs; i++) {
      if (store.isCancelled(likedPlaylistId)) {
        return false;
      }

      if (store.isPaused(likedPlaylistId)) {
        if (preparedPlaylistSongs.length > 0) {
          await saveLikedSongsToDb(user.id, preparedPlaylistSongs.map(p => ({
            created_at: p.created_at,
            song_order: p.song_order,
            song: p.songs
          })));
          await store.refreshDownloadedStatus(user.id);
        }
        return false;
      }

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

        const resolvedSongImage = songDataUrl || songImageUrl || '/images/album-placeholder.png';

        const offlineSongData = {
          ...song,
          audio_url: audioUrl,
          imageUrl: resolvedSongImage,
          albums: {
            ...song.albums,
            image_url: resolvedSongImage
          },
          downloaded_at: Date.now()
        };

        preparedPlaylistSongs.push({
          created_at: item.created_at,
          song_order: i,
          songs: offlineSongData
        });

        // Save song to offlineDb.songs & record reference immediately
        await offlineDb.songs.put(offlineSongData);
        await offlineDb.song_references.put({
          id: `${song.id}_liked_${user.id}`,
          song_id: song.id,
          parent_type: 'liked',
          parent_id: user.id,
          created_at: Date.now()
        });

        // Save row to offlineDb.liked_songs
        await offlineDb.liked_songs.put({
          user_id: user.id,
          song_id: song.id,
          created_at: item.created_at,
          song_order: i
        });

        // Real-time green badge
        store.addDownloadedSongId(song.id);
      }

      // Update progress
      const current = i + 1;
      const percent = Math.round((current / Math.max(totalSongs, 1)) * 100);
      if (!silent) {
        store.setProgress(likedPlaylistId, {
          current,
          percent
        });
      }
    }

    // 3. Save liked songs strictly to offlineDb.liked_songs & offlineDb.songs (mirroring Supabase)
    await saveLikedSongsToDb(user.id, preparedPlaylistSongs.map(p => ({
      created_at: p.created_at,
      song_order: p.song_order,
      song: p.songs
    })));
    precachePageShell('/liked');

    if (!silent) {
      store.setProgress(likedPlaylistId, {
        status: 'completed',
        percent: 100
      });

      setTimeout(() => {
        store.clearProgress(likedPlaylistId);
      }, 2000);
    }

    await store.refreshDownloadedStatus(user.id);

    return true;
  } catch (error: any) {
    console.error(`[Download Service] Failed to download liked songs:`, error);
    if (!silent) {
      store.setProgress(likedPlaylistId, {
        status: 'error',
        errorMessage: error.message || 'Download failed'
      });
    }
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
    let playlist: any = null;
    const { data: normalPlaylist, error } = await supabase
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
      .maybeSingle();

    if (normalPlaylist) {
      playlist = normalPlaylist;
    } else {
      // Check if this is a generated playlist / mix
      const { data: mixData } = await supabase
        .from('generated_playlists')
        .select('*')
        .eq('id', playlistId)
        .maybeSingle();

      if (mixData) {
        let mixSongs: any[] = [];
        if (mixData.song_ids && mixData.song_ids.length > 0) {
          const { data: sData } = await supabase
            .from('songs')
            .select(`
              *, 
              albums(
                id, 
                title, 
                image_path,
                genre,
                release_type,
                artists(id, name, image_path)
              )
            `)
            .in('id', mixData.song_ids);

          if (sData) {
            mixSongs = mixData.song_ids
              .map((id: string, index: number) => {
                const s = sData.find((x: any) => x.id === id);
                if (!s) return null;
                return {
                  created_at: mixData.created_at,
                  song_order: index,
                  songs: s
                };
              })
              .filter(Boolean);
          }
        }

        playlist = {
          id: mixData.id,
          title: mixData.title,
          image_path: null,
          image_url: mixData.image_url || '/images/mix-placeholder.png',
          user_id: mixData.user_id,
          created_at: mixData.created_at,
          last_accessed_at: new Date().toISOString(),
          playlist_songs: mixSongs,
          is_mix: true
        };
      }
    }

    if (!playlist) {
      throw new Error(error?.message || 'Playlist or mix not found');
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
    } else if (playlist.image_url) {
      imageUrl = playlist.image_url.includes('playlist-placeholder') ? '/images/mix-placeholder.png' : playlist.image_url;
      if (imageUrl && !imageUrl.startsWith('/images/')) {
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
    const { data: authUserData } = await supabase.auth.getUser();
    const currentUserId = authUserData?.user?.id || playlist.user_id;

    for (let i = 0; i < totalSongs; i++) {
      if (store.isCancelled(playlistId)) {
        return false;
      }

      if (store.isPaused(playlistId)) {
        if (preparedPlaylistSongs.length > 0) {
          const offlinePlaylistDraft: OfflinePlaylist = {
            id: playlist.id,
            title: playlist.title,
            image_path: playlist.image_path || null,
            image_url: resolvedPlaylistImageUrl || null,
            user_id: currentUserId,
            created_at: playlist.created_at,
            downloaded_at: Date.now(),
            last_accessed_at: playlist.last_accessed_at || new Date().toISOString(),
            playlist_songs: preparedPlaylistSongs,
            is_mix: Boolean((playlist as any).is_mix)
          };
          await savePlaylistToDb(offlinePlaylistDraft, currentUserId);
          await store.refreshDownloadedStatus(currentUserId);
        }
        return false;
      }

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

        const resolvedSongImage = songDataUrl || songImageUrl || '/images/album-placeholder.png';

        const offlineSongData = {
          ...song,
          audio_url: audioUrl,
          imageUrl: resolvedSongImage,
          albums: {
            ...song.albums,
            image_url: resolvedSongImage
          },
          downloaded_at: Date.now()
        };

        preparedPlaylistSongs.push({
          created_at: item.created_at,
          song_order: item.song_order,
          songs: offlineSongData
        });

        // Save immediately into offlineDb & record reference
        await offlineDb.songs.put(offlineSongData);
        await offlineDb.song_references.put({
          id: `${song.id}_playlist_${playlist.id}`,
          song_id: song.id,
          parent_type: 'playlist',
          parent_id: playlist.id,
          created_at: Date.now()
        });

        // Real-time green badge
        store.addDownloadedSongId(song.id);
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
    const offlinePlaylist: OfflinePlaylist = {
      id: playlist.id,
      title: playlist.title,
      image_path: playlist.image_path || null,
      image_url: resolvedPlaylistImageUrl || null,
      user_id: currentUserId,
      created_at: playlist.created_at,
      downloaded_at: Date.now(),
      last_accessed_at: playlist.last_accessed_at || new Date().toISOString(),
      playlist_songs: preparedPlaylistSongs,
      is_mix: Boolean((playlist as any).is_mix)
    };

    await savePlaylistToDb(offlinePlaylist, currentUserId);
    precachePageShell((playlist as any).is_mix ? `/mix/${playlistId}` : `/playlist/${playlistId}`);

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
export async function syncPlaylist(supabase: SupabaseClient, playlistId: string, silent = false): Promise<boolean> {
  if (playlistId === 'liked') {
    return downloadLikedSongs(supabase, silent);
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
    if (!silent) {
      store.setProgress(playlistId, {
        id: playlistId,
        type: 'playlist',
        title: localPlaylist.title,
        status: 'syncing',
        percent: 0
      });
    }

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
      if (!silent) store.clearProgress(playlistId);
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
      if (!silent) store.clearProgress(playlistId);
      return true;
    }

    console.log(`[Sync Engine] Auto-syncing playlist "${localPlaylist.title}": +${newItems.length} added, -${removedIds.length} removed.`);

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
      if (song?.albums?.image_path) {
        const { data: imgData } = supabase.storage.from('images').getPublicUrl(song.albums.image_path);
        if (imgData?.publicUrl) {
          await saveImageToCache(imgData.publicUrl);
        }
      }
      if (song) {
        await offlineDb.songs.put(song);
        await offlineDb.song_references.put({
          id: `${song.id}_playlist_${playlistId}`,
          song_id: song.id,
          parent_type: 'playlist',
          parent_id: playlistId,
          created_at: Date.now()
        });
        store.addDownloadedSongId(song.id);
      }
    }

    // 4. Remove references for deleted songs
    for (const songId of removedIds) {
      await offlineDb.song_references
        .where('id')
        .equals(`${songId}_playlist_${playlistId}`)
        .delete();
      const didPrune = await pruneSongIfUnreferenced(songId);
      if (didPrune) {
        store.removeDownloadedSongId(songId);
      }
    }

    // 5. Update local playlist document with fresh songs, preserving exact Supabase order and dates
    const updatedPlaylistSongs = cloudSongs
      .slice()
      .sort((a: any, b: any) => (a.song_order ?? 0) - (b.song_order ?? 0))
      .map((item: any) => {
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
    precachePageShell(`/playlist/${playlistId}`);

    if (!silent) {
      store.setProgress(playlistId, {
        status: 'completed',
        percent: 100
      });

      setTimeout(() => {
        store.clearProgress(playlistId);
      }, 2000);
    }

    return true;
  } catch (error) {
    console.error(`[Sync Engine] Error syncing playlist ${playlistId}:`, error);
    if (!silent) store.clearProgress(playlistId);
    return false;
  }
}

/**
 * Automatically syncs a single liked song (add or remove) to offline storage
 * preserving the exact Supabase created_at timestamp and song ordering.
 */
export async function autoSyncLikedSong(
  supabase: SupabaseClient,
  userId: string,
  songId: string,
  action: 'add' | 'remove'
): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  try {
    if (action === 'remove') {
      await offlineDb.liked_songs.delete([userId, songId]);
      await offlineDb.song_references.where('id').equals(`${songId}_liked_${userId}`).delete();
      const didPrune = await pruneSongIfUnreferenced(songId);
      if (didPrune) {
        useDownloadStore.getState().removeDownloadedSongId(songId);
      }
      useDownloadStore.getState().refreshDownloadedStatus(userId);
      return;
    }

    // Action === 'add'
    const { data: songData } = await supabase
      .from('songs')
      .select(`
        *,
        albums(
          id,
          title,
          image_path,
          genre,
          release_type,
          artists(id, name, image_path)
        )
      `)
      .eq('id', songId)
      .single();

    if (!songData) return;

    // Fetch the exact created_at timestamp from Supabase liked_songs
    const { data: likedRow } = await supabase
      .from('liked_songs')
      .select('created_at')
      .eq('user_id', userId)
      .eq('song_id', songId)
      .single();

    // Cache audio
    let audioUrl: string | undefined = undefined;
    if (songData.song_path) {
      const { data } = supabase.storage.from('songs').getPublicUrl(songData.song_path);
      audioUrl = data?.publicUrl;
      if (audioUrl) {
        await saveAudioToCache(audioUrl);
      }
    }

    // Cache image
    let resolvedImage: string = '/images/album-placeholder.png';
    if (songData.albums?.image_path) {
      const { data } = supabase.storage.from('images').getPublicUrl(songData.albums.image_path);
      if (data?.publicUrl) {
        await saveImageToCache(data.publicUrl);
        resolvedImage = (await fetchImageAsDataUrl(data.publicUrl)) || data.publicUrl || '/images/album-placeholder.png';
      }
    }

    // Save song to offlineDb.songs
    await offlineDb.songs.put({
      ...songData,
      audio_url: audioUrl,
      imageUrl: resolvedImage,
      albums: {
        ...songData.albums,
        image_url: resolvedImage
      },
      downloaded_at: Date.now()
    });

    // Save reference
    await offlineDb.song_references.put({
      id: `${songId}_liked_${userId}`,
      song_id: songId,
      parent_type: 'liked',
      parent_id: userId,
      created_at: Date.now()
    });

    // Shift existing liked songs order by 1 so the newly liked song takes index 0
    const existingLiked = await offlineDb.liked_songs.where('user_id').equals(userId).toArray();
    for (const item of existingLiked) {
      if (item.song_id !== songId) {
        await offlineDb.liked_songs.update([userId, item.song_id], {
          song_order: (item.song_order ?? 0) + 1
        });
      }
    }

    // Save with the actual Supabase created_at timestamp
    await offlineDb.liked_songs.put({
      user_id: userId,
      song_id: songId,
      created_at: likedRow?.created_at || new Date().toISOString(),
      song_order: 0
    });

    useDownloadStore.getState().addDownloadedSongId(songId);
    useDownloadStore.getState().refreshDownloadedStatus(userId);
  } catch (err) {
    console.warn('[Download Service] Auto-sync liked song failed:', err);
  }
}

/**
 * Safely resolves current user id without making network requests (works 100% offline)
 */
async function resolveUserIdForDeletion(supabase?: SupabaseClient): Promise<string | undefined> {
  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user?.id) return data.session.user.id;
    } catch {}
  }
  try {
    if (offlineDb.liked_songs) {
      const firstLiked = await offlineDb.liked_songs.toCollection().first();
      if (firstLiked?.user_id) return firstLiked.user_id;
    }
  } catch {}
  try {
    if (offlineDb.saved_albums) {
      const firstSaved = await offlineDb.saved_albums.toCollection().first();
      if (firstSaved?.user_id) return firstSaved.user_id;
    }
  } catch {}
  return undefined;
}

/**
 * Removes an album download from device
 */
export async function deleteAlbumDownload(albumId: string, supabase?: SupabaseClient): Promise<void> {
  const store = useDownloadStore.getState();
  const userId = await resolveUserIdForDeletion(supabase);
  await removeAlbumFromDb(albumId, userId);
  await store.refreshDownloadedStatus(userId);
}

/**
 * Removes a playlist download from device
 */
export async function deletePlaylistDownload(playlistId: string, supabase?: SupabaseClient): Promise<void> {
  const store = useDownloadStore.getState();
  const userId = await resolveUserIdForDeletion(supabase);
  await removePlaylistFromDb(playlistId, userId);
  await store.refreshDownloadedStatus(userId);
}
