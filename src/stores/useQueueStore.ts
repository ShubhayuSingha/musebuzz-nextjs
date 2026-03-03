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
      width: 400,
      activeView: 'queue',
      
      onOpen: (view = 'queue') => set({ 
        isOpen: true, 
        activeView: view 
      }),
      
      onClose: () => set({ 
        isOpen: false 
      }),
      
      toggle: (view = 'queue') => set((state) => {
        if (state.isOpen && state.activeView === view) {
            return { isOpen: false };
        }
        return { isOpen: true, activeView: view };
      }),
      
      setWidth: (width) => set({ width }),
    }),
    {
      name: 'musebuzz-queue-prefs',
      storage: createJSONStorage(() => localStorage),
      // 🟢 UPDATED: Now we save isOpen and activeView along with width
      partialize: (state) => ({ 
        width: state.width,
        isOpen: state.isOpen,
        activeView: state.activeView
      }), 
    }
  )
);

export default useQueueStore;