// src/stores/useDownloadStore.ts
import { create } from 'zustand';
import { offlineDb } from '@/lib/offlineDb';

export interface DownloadProgress {
  id: string; // albumId or playlistId
  type: 'album' | 'playlist';
  title: string;
  current: number;
  total: number;
  percent: number;
  status: 'idle' | 'fetching' | 'downloading' | 'paused' | 'completed' | 'error' | 'syncing';
  errorMessage?: string;
}

interface DownloadStore {
  downloading: Record<string, DownloadProgress>;
  downloadedIds: Set<string>;
  downloadedSongIds: Set<string>;
  pausedIds: Set<string>;
  cancelledIds: Set<string>;
  
  setProgress: (id: string, progress: Partial<DownloadProgress>) => void;
  clearProgress: (id: string) => void;
  refreshDownloadedStatus: (userId?: string) => Promise<void>;
  isDownloaded: (id: string) => boolean;
  isSongDownloaded: (songId: string) => boolean;

  addDownloadedSongId: (songId: string) => void;
  removeDownloadedSongId: (songId: string) => void;
  pauseDownload: (id: string) => void;
  resumeDownload: (id: string) => void;
  cancelDownload: (id: string) => void;
  isPaused: (id: string) => boolean;
  isCancelled: (id: string) => boolean;
}

const useDownloadStore = create<DownloadStore>((set, get) => ({
  downloading: {},
  downloadedIds: new Set(),
  downloadedSongIds: new Set(),
  pausedIds: new Set(),
  cancelledIds: new Set(),

  setProgress: (id, progress) => {
    set((state) => {
      const existing = state.downloading[id] || {
        id,
        type: 'album',
        title: '',
        current: 0,
        total: 0,
        percent: 0,
        status: 'idle'
      };

      return {
        downloading: {
          ...state.downloading,
          [id]: { ...existing, ...progress }
        }
      };
    });
  },

  clearProgress: (id) => {
    set((state) => {
      const next = { ...state.downloading };
      delete next[id];
      const nextPaused = new Set(state.pausedIds);
      nextPaused.delete(id);
      const nextCancelled = new Set(state.cancelledIds);
      nextCancelled.delete(id);
      return { downloading: next, pausedIds: nextPaused, cancelledIds: nextCancelled };
    });
  },

  addDownloadedSongId: (songId: string) => {
    set((state) => {
      if (state.downloadedSongIds.has(songId)) return state;
      const next = new Set(state.downloadedSongIds);
      next.add(songId);
      return { downloadedSongIds: next };
    });
  },

  removeDownloadedSongId: (songId: string) => {
    set((state) => {
      if (!state.downloadedSongIds.has(songId)) return state;
      const next = new Set(state.downloadedSongIds);
      next.delete(songId);
      return { downloadedSongIds: next };
    });
  },

  pauseDownload: (id: string) => {
    set((state) => {
      const nextPaused = new Set(state.pausedIds);
      nextPaused.add(id);
      const existing = state.downloading[id];
      return {
        pausedIds: nextPaused,
        downloading: existing
          ? { ...state.downloading, [id]: { ...existing, status: 'paused' } }
          : state.downloading
      };
    });
  },

  resumeDownload: (id: string) => {
    set((state) => {
      const nextPaused = new Set(state.pausedIds);
      nextPaused.delete(id);
      const nextCancelled = new Set(state.cancelledIds);
      nextCancelled.delete(id);
      const existing = state.downloading[id];
      return {
        pausedIds: nextPaused,
        cancelledIds: nextCancelled,
        downloading: existing
          ? { ...state.downloading, [id]: { ...existing, status: 'downloading' } }
          : state.downloading
      };
    });
  },

  cancelDownload: (id: string) => {
    set((state) => {
      const nextCancelled = new Set(state.cancelledIds);
      nextCancelled.add(id);
      const nextPaused = new Set(state.pausedIds);
      nextPaused.delete(id);
      const nextDownloading = { ...state.downloading };
      delete nextDownloading[id];
      return {
        cancelledIds: nextCancelled,
        pausedIds: nextPaused,
        downloading: nextDownloading
      };
    });
  },

  isPaused: (id: string) => {
    return get().pausedIds.has(id);
  },

  isCancelled: (id: string) => {
    return get().cancelledIds.has(id);
  },

  refreshDownloadedStatus: async (userId?: string) => {
    try {
      let uid = userId;
      if (!uid && typeof window !== 'undefined') {
        try {
          const { supabase } = await import('@/lib/supabaseClient');
          const { data } = await supabase.auth.getSession();
          uid = data?.session?.user?.id;
        } catch {}
      }

      let playlistKeys: string[] = [];
      let albumKeys: string[] = [];

      if (uid) {
        // Multi-tenant: User only sees their own playlists
        const userPlaylists = await offlineDb.playlists
          .where('user_id')
          .equals(uid)
          .primaryKeys();
        
        let rawPlaylists = userPlaylists as string[];
        if (rawPlaylists.length === 0) {
          rawPlaylists = (await offlineDb.playlists.toCollection().primaryKeys()) as string[];
        }

        // Never count user-scoped or raw liked song playlist IDs as generic playlists
        playlistKeys = rawPlaylists.filter(
          (k) => k !== 'liked' && !k.startsWith('liked_')
        );

        // User only sees albums saved by them in saved_albums
        if (offlineDb.saved_albums) {
          const userSavedAlbums = await offlineDb.saved_albums
            .where('user_id')
            .equals(uid)
            .toArray();
          albumKeys = userSavedAlbums.map((sa) => sa.album_id);
          if (albumKeys.length === 0) {
            const totalSaved = await offlineDb.saved_albums.count();
            if (totalSaved === 0) {
              albumKeys = (await offlineDb.albums.toCollection().primaryKeys()) as string[];
            }
          }
        } else {
          albumKeys = (await offlineDb.albums.toCollection().primaryKeys()) as string[];
        }

        // Check if user has liked songs actually downloaded via song_references (not just cached like-state in liked_songs)
        let hasLikedSongs = false;
        if (offlineDb.song_references) {
          const userLikedRefs = await offlineDb.song_references
            .where('parent_type')
            .equals('liked')
            .filter((r) => r.parent_id === uid)
            .count();
          if (userLikedRefs > 0) {
            hasLikedSongs = true;
          } else {
            // General check across all liked references if user id was not recorded
            const totalLikedRefs = await offlineDb.song_references
              .where('parent_type')
              .equals('liked')
              .count();
            if (totalLikedRefs > 0) hasLikedSongs = true;
          }
        }
        if (!hasLikedSongs) {
          const userLiked = (await offlineDb.playlists.get(`liked_${uid}`)) || (await offlineDb.playlists.get('liked'));
          if (userLiked && (!userLiked.user_id || userLiked.user_id === uid) && userLiked.playlist_songs?.length > 0) {
            hasLikedSongs = true;
          }
        }
        if (hasLikedSongs) {
          playlistKeys.push('liked');
        }
      } else {
        // Unauthenticated or fallback
        const [allPlaylists, allAlbums] = await Promise.all([
          offlineDb.playlists.toCollection().primaryKeys(),
          offlineDb.albums.toCollection().primaryKeys()
        ]);
        
        const filteredPlaylists = (allPlaylists as string[]).filter(
          (k) => k !== 'liked' && !k.startsWith('liked_')
        );
        let hasLiked = (allPlaylists as string[]).some(
          (k) => k === 'liked' || k.startsWith('liked_')
        );
        if (!hasLiked && offlineDb.song_references) {
          const c = await offlineDb.song_references.where('parent_type').equals('liked').count();
          if (c > 0) hasLiked = true;
        }
        if (hasLiked) {
          filteredPlaylists.push('liked');
        }
        playlistKeys = filteredPlaylists;
        albumKeys = allAlbums as string[];
      }

      const [allSongKeys] = await Promise.all([
        offlineDb.songs.toCollection().primaryKeys()
      ]);

      const ids = new Set<string>([...playlistKeys, ...albumKeys]);
      const songIds = new Set<string>(allSongKeys as string[]);

      const prevIds = get().downloadedIds;
      const prevSongIds = get().downloadedSongIds;

      const areSetsEqual = (a: Set<string>, b: Set<string>) => {
        if (a.size !== b.size) return false;
        for (const item of a) if (!b.has(item)) return false;
        return true;
      };

      const idsEqual = areSetsEqual(prevIds, ids);
      const songIdsEqual = areSetsEqual(prevSongIds, songIds);

      if (!idsEqual || !songIdsEqual) {
        set({
          downloadedIds: idsEqual ? prevIds : ids,
          downloadedSongIds: songIdsEqual ? prevSongIds : songIds
        });
      }
    } catch (e) {
      console.warn('[Download Store] Could not refresh downloaded status:', e);
    }
  },

  isDownloaded: (id) => {
    return get().downloadedIds.has(id);
  },

  isSongDownloaded: (songId) => {
    return get().downloadedSongIds.has(songId);
  }
}));

export default useDownloadStore;
