// src/stores/useQueueStore.ts

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface QueueStore {
  isOpen: boolean;
  width: number; // 👈 This was missing
  onOpen: () => void;
  onClose: () => void;
  toggle: () => void;
  setWidth: (width: number) => void; // 👈 This was missing
}

const useQueueStore = create<QueueStore>()(
  persist(
    (set) => ({
      isOpen: false,
      width: 400, // Default width
      onOpen: () => set({ isOpen: true }),
      onClose: () => set({ isOpen: false }),
      toggle: () => set((state) => ({ isOpen: !state.isOpen })),
      setWidth: (width) => set({ width }),
    }),
    {
      name: 'musebuzz-queue-prefs', // Saves to localStorage
      storage: createJSONStorage(() => localStorage),
      // Only save the width (we usually don't want to keep the queue open on refresh)
      partialize: (state) => ({ width: state.width } as any), 
    }
  )
);

export default useQueueStore;