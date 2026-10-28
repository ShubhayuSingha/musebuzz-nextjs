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
  status: 'idle' | 'fetching' | 'downloading' | 'completed' | 'error' | 'syncing';
  errorMessage?: string;
}

interface DownloadStore {
  downloading: Record<string, DownloadProgress>;
  downloadedIds: Set<string>;
  setProgress: (id: string, progress: Partial<DownloadProgress>) => void;
  clearProgress: (id: string) => void;
  refreshDownloadedStatus: (userId?: string) => Promise<void>;
  isDownloaded: (id: string) => boolean;
}

const useDownloadStore = create<DownloadStore>((set, get) => ({
  downloading: {},
  downloadedIds: new Set(),

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
      return { downloading: next };
    });
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
        playlistKeys = userPlaylists as string[];

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

        // Check if user has liked songs downloaded
        const userLiked = (await offlineDb.playlists.get(`liked_${uid}`)) || (await offlineDb.playlists.get('liked'));
        if (userLiked && (!userLiked.user_id || userLiked.user_id === uid)) {
          playlistKeys.push('liked');
        }
      } else {
        // Unauthenticated or fallback
        const [allPlaylists, allAlbums] = await Promise.all([
          offlineDb.playlists.toCollection().primaryKeys(),
          offlineDb.albums.toCollection().primaryKeys()
        ]);
        playlistKeys = allPlaylists as string[];
        albumKeys = allAlbums as string[];
      }

      const ids = new Set<string>([...playlistKeys, ...albumKeys]);
      set({ downloadedIds: ids });
    } catch (e) {
      console.warn('[Download Store] Could not refresh downloaded status:', e);
    }
  },

  isDownloaded: (id) => {
    return get().downloadedIds.has(id);
  }
}));

export default useDownloadStore;
