import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface QueueStore {
  isOpen: boolean;
  width: number;
  activeView: 'queue' | 'lyrics'; 
  onOpen: (view?: 'queue' | 'lyrics') => void;
  onClose: () => void;
  toggle: (view?: 'queue' | 'lyrics') => void;
  setWidth: (width: number) => void;
}

const useQueueStore = create<QueueStore>()(
  persist(
    (set) => ({
      isOpen: false,
      width: 400, // Default width
      activeView: 'queue',
      
      onOpen: (view = 'queue') => set({ 
        isOpen: true, 
        activeView: view 
      }),
      
      onClose: () => set({ 
        isOpen: false 
      }),
      
      toggle: (view = 'queue') => set((state) => {
        // If clicking the exact same button while it's already open, close it
        if (state.isOpen && state.activeView === view) {
            return { isOpen: false };
        }
        // Otherwise, open the panel and set it to the requested view
        return { isOpen: true, activeView: view };
      }),
      
      setWidth: (width) => set({ width }),
    }),
    {
      name: 'musebuzz-queue-prefs',
      storage: createJSONStorage(() => localStorage),
      // We only persist the width so it remembers their drag preference.
      // We don't persist activeView so it defaults cleanly on refresh.
      partialize: (state) => ({ width: state.width } as any), 
    }
  )
);

export default useQueueStore;