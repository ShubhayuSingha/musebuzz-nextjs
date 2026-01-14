// src/stores/usePlayerStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface PlayerStore {
  ids: string[];
  activeId?: string;
  setId: (id: string) => void;
  setIds: (ids: string[]) => void;
  reset: () => void;
  volume: number;
  setVolume: (volume: number) => void;
  // 1. ADD PREVIOUS VOLUME VARIABLES
  prevVolume: number;
  setPrevVolume: (volume: number) => void;
}

const usePlayerStore = create<PlayerStore>()(
  persist(
    (set) => ({
      ids: [],
      activeId: undefined,
      volume: 0.3,
      // 2. INITIALIZE PREVIOUS VOLUME
      prevVolume: 0.3, // Match default volume

      setId: (id: string) => set({ activeId: id }),
      setIds: (ids: string[]) => set({ ids: ids }),
      reset: () => set({ ids: [], activeId: undefined }),
      setVolume: (volume: number) => set({ volume: volume }),
      // 3. ADD SETTER ACTION
      setPrevVolume: (volume: number) => set({ prevVolume: volume }),
    }),
    {
      name: 'musebuzz-player-storage', 
      storage: createJSONStorage(() => localStorage), 
      // 4. PERSIST 'prevVolume' TOO
      // If we don't do this, refreshing the page while muted will make the app forget the old volume.
      partialize: (state) => ({ 
        volume: state.volume,
        prevVolume: state.prevVolume
      }),
    }
  )
);

export default usePlayerStore;