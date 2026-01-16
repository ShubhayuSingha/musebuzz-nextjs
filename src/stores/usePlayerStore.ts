import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { QueueItem } from '@/types'; 
import { v4 as uuidv4 } from 'uuid'; 

export interface PlayerContext {
  type: 'album' | 'playlist' | 'liked';
  title: string;
}

interface PlayerStore {
  // --- STATE ---
  activeId?: string;
  activeIdSignature: number; 
  
  // 1. NEW STATE: Explicitly track if we are playing a Priority Item
  isPlayingPriority: boolean; 

  isPlaying: boolean;
  volume: number;
  prevVolume: number; 

  bucketA: string[];          
  bucketB: QueueItem[];       

  activeContext?: PlayerContext; 
  lastActiveContextId?: string; 

  shuffledOrder: string[];    
  isShuffled: boolean;
  repeatMode: 'off' | 'context' | 'one';

  // --- ACTIONS ---
  setId: (id: string, context?: PlayerContext) => void;
  setIds: (ids: string[], context?: PlayerContext) => void; 
  addToQueue: (id: string) => void; 
  playQueueItem: (index: number) => void; 
  
  setIsPlaying: (value: boolean) => void;
  setVolume: (value: number) => void;
  setPrevVolume: (value: number) => void;
  
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  playNext: () => void;
  playPrevious: () => void;
  reset: () => void;
}

const usePlayerStore = create<PlayerStore>()(
  persist(
    (set, get) => ({
      activeId: undefined,
      activeIdSignature: 0, 
      isPlayingPriority: false, // Init false
      lastActiveContextId: undefined,
      isPlaying: false,
      volume: 0.3,
      prevVolume: 0.3,

      bucketA: [],
      bucketB: [],
      activeContext: undefined, 
      shuffledOrder: [],
      isShuffled: false,
      repeatMode: 'off',

      setId: (id: string, context?: PlayerContext) => {
        const state = get();
        const isInContext = state.bucketA.includes(id);

        set({ 
          activeId: id,
          activeIdSignature: state.activeIdSignature + 1,
          isPlaying: true,
          // If we manually set an ID, we are usually NOT in priority mode 
          // (unless specifically handled, but usually this resets to context or standalone)
          isPlayingPriority: false, 
          ...(context ? { activeContext: context } : {}),
          ...(isInContext ? { lastActiveContextId: id } : {}) 
        });
      },
      
      setIds: (ids: string[], context?: PlayerContext) => {
        const state = get();
        const currentIdInNewList = state.activeId && ids.includes(state.activeId) 
          ? state.activeId 
          : undefined;

        set({ 
          bucketA: ids, 
          activeContext: context,
          bucketB: [],       
          shuffledOrder: [], 
          isShuffled: false,
          isPlaying: true,
          isPlayingPriority: false, // Reset priority mode
          lastActiveContextId: currentIdInNewList 
        });
      },

      playQueueItem: (index: number) => {
        const { bucketB, activeIdSignature } = get();
        const itemToPlay = bucketB[index];
        
        if (!itemToPlay) return;

        const newQueue = [...bucketB];
        newQueue.splice(index, 1);

        set({
          activeId: itemToPlay.id,
          activeIdSignature: activeIdSignature + 1,
          bucketB: newQueue,
          isPlaying: true,
          isPlayingPriority: true // Mark as Priority Mode
        });
      },

      setIsPlaying: (value: boolean) => set({ isPlaying: value }),
      setVolume: (value: number) => set({ volume: value }),
      setPrevVolume: (value: number) => set({ prevVolume: value }),

      reset: () => set({ 
        bucketA: [], bucketB: [], activeId: undefined, isPlaying: false, activeContext: undefined, lastActiveContextId: undefined, isPlayingPriority: false
      }),

      addToQueue: (id: string) => {
        const newItem: QueueItem = {
          id: id,
          uid: uuidv4() 
        };
        set((state) => ({
          bucketB: [...state.bucketB, newItem]
        }));
      },

      toggleShuffle: () => {
        set((state) => {
          const newShuffleState = !state.isShuffled;
          let newShuffledOrder: string[] = [];

          if (newShuffleState) {
            const allIds = [...state.bucketA];
            const otherIds = allIds.filter(id => id !== state.activeId);
            for (let i = otherIds.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [otherIds[i], otherIds[j]] = [otherIds[j], otherIds[i]];
            }
            if (state.activeId) {
              newShuffledOrder = [state.activeId, ...otherIds];
            } else {
              newShuffledOrder = otherIds;
            }
          }
          return { isShuffled: newShuffleState, shuffledOrder: newShuffledOrder };
        });
      },

      toggleRepeat: () => {
        set((state) => {
          const modes = ['off', 'context', 'one'];
          const nextIndex = (modes.indexOf(state.repeatMode) + 1) % modes.length;
          return { repeatMode: modes[nextIndex] as 'off' | 'context' | 'one' };
        });
      },

      playNext: () => {
        const { 
          activeId, bucketA, bucketB, 
          shuffledOrder, isShuffled, repeatMode,
          lastActiveContextId, activeIdSignature 
        } = get();

        // 1. Priority Queue
        if (bucketB.length > 0) {
          const nextItem = bucketB[0];
          const remainingQueue = bucketB.slice(1);
          set({ 
            activeId: nextItem.id, 
            activeIdSignature: activeIdSignature + 1,
            bucketB: remainingQueue,
            isPlayingPriority: true // Enforce Priority Mode
          });
          return;
        }

        // 2. Context Logic
        const currentList = isShuffled ? shuffledOrder : bucketA;
        let currentIndex = currentList.findIndex((id) => id === activeId);

        // Resume Point Logic
        if (currentIndex === -1 && lastActiveContextId) {
           currentIndex = currentList.findIndex((id) => id === lastActiveContextId);
        }

        let nextIndex = currentIndex + 1;

        // Handle End of List
        if (nextIndex >= currentList.length) {
          if (repeatMode === 'off') {
            if (currentList.length > 0) {
                set({ 
                    activeId: currentList[0],
                    activeIdSignature: activeIdSignature + 1,
                    isPlaying: false,
                    isPlayingPriority: false // End of list reset
                });
            } else {
                set({ isPlaying: false, isPlayingPriority: false });
            }
            return;
          }
          nextIndex = 0; 
        }

        const nextSongId = currentList[nextIndex];

        set({ 
          activeId: nextSongId,
          activeIdSignature: activeIdSignature + 1,
          lastActiveContextId: nextSongId,
          isPlayingPriority: false // We are back in Context mode
        });
      },

      playPrevious: () => {
        const { 
          activeId, bucketA, shuffledOrder, isShuffled, 
          lastActiveContextId, activeIdSignature, isPlayingPriority 
        } = get();
        
        // FIX: The core logic change.
        // If we are flagged as playing a Priority song, ALWAYS try to go back to the Resume Point first.
        // This overrides the index lookup, preventing the ID collision bug.
        if (isPlayingPriority) {
           if (lastActiveContextId) {
              set({ 
                 activeId: lastActiveContextId,
                 activeIdSignature: activeIdSignature + 1,
                 isPlayingPriority: false // We have exited priority mode
              });
              return;
           }
        }

        const currentList = isShuffled ? shuffledOrder : bucketA;
        let currentIndex = currentList.findIndex((id) => id === activeId);

        // Backup check: If not flagged as priority, but ID not found in album (External song)
        if (currentIndex === -1 && lastActiveContextId) {
             set({ 
                activeId: lastActiveContextId,
                activeIdSignature: activeIdSignature + 1,
                isPlayingPriority: false
             });
             return;
        }

        let prevIndex = currentIndex - 1;

        if (prevIndex < 0) {
          prevIndex = currentList.length - 1;
        }

        const prevSongId = currentList[prevIndex];

        set({ 
          activeId: prevSongId,
          activeIdSignature: activeIdSignature + 1,
          lastActiveContextId: prevSongId,
          isPlayingPriority: false
        });
      }
    }),
    {
      name: 'musebuzz-player-storage', 
      storage: createJSONStorage(() => localStorage), 
      partialize: (state) => ({ 
        volume: state.volume,
        prevVolume: state.prevVolume
      }),
    }
  )
);

export default usePlayerStore;