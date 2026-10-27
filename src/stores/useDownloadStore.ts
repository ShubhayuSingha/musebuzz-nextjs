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
  refreshDownloadedStatus: () => Promise<void>;
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

  refreshDownloadedStatus: async () => {
    try {
      const [playlists, albums] = await Promise.all([
        offlineDb.playlists.toCollection().primaryKeys(),
        offlineDb.albums.toCollection().primaryKeys()
      ]);

      const ids = new Set<string>([...playlists, ...albums]);
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
