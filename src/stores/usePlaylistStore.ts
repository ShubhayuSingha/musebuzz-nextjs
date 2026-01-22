// src/stores/usePlaylistStore.ts
import { create } from 'zustand';

interface PlaylistStore {
  version: number; // A simple number we increment to signal "change"
  refreshPlaylists: () => void;
}

const usePlaylistStore = create<PlaylistStore>((set) => ({
  version: 0,
  refreshPlaylists: () => set((state) => ({ version: state.version + 1 })),
}));

export default usePlaylistStore;