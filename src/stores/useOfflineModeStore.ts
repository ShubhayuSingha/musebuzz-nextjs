// src/stores/useOfflineModeStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import usePlayerStore from '@/stores/usePlayerStore';

interface OfflineModeStore {
  isOnline: boolean;
  isOfflineMode: boolean;
  setIsOnline: (isOnline: boolean) => void;
  setOfflineMode: (enabled: boolean) => void;
  toggleOfflineMode: () => void;
}

// Purge AI autoplay queue immediately when transitioning into offline
const purgeAutoplayIfOffline = (isOffline: boolean) => {
  if (typeof window !== 'undefined') {
    (window as any).__musebuzzIsOffline = isOffline;
  }
  if (isOffline) {
    const player = usePlayerStore.getState();
    player.setAutoplay([]);
    if (player.isPlayingAutoplay) {
      usePlayerStore.setState({ isPlayingAutoplay: false, isPlaying: false });
    }
  }
};

if (typeof window !== 'undefined') {
  (window as any).__musebuzzIsOffline = !navigator.onLine;
}

export const useOfflineModeStore = create<OfflineModeStore>()(
  persist(
    (set, get) => ({
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      isOfflineMode: false,

      setIsOnline: (isOnline) => {
        set({ isOnline });
        const isOffline = !isOnline || get().isOfflineMode;
        purgeAutoplayIfOffline(isOffline);
      },

      setOfflineMode: (enabled) => {
        set({ isOfflineMode: enabled });
        const isOffline = enabled || !get().isOnline;
        purgeAutoplayIfOffline(isOffline);
      },

      toggleOfflineMode: () => {
        const nextMode = !get().isOfflineMode;
        set({ isOfflineMode: nextMode });
        const isOffline = nextMode || !get().isOnline;
        purgeAutoplayIfOffline(isOffline);
      },
    }),
    {
      name: 'musebuzz-offline-mode',
      partialize: (state) => ({
        isOfflineMode: state.isOfflineMode,
      }),
    }
  )
);

export default useOfflineModeStore;
