// src/stores/usePlayerStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { QueueItem } from '@/types'; 
import { v4 as uuidv4 } from 'uuid'; 

// 1. NEW INTERFACE: Defines the "Context" (Where did these songs come from?)
export interface PlayerContext {
  type: 'album' | 'playlist' | 'liked';
  title: string;
}

interface PlayerStore {
  // --- STATE ---
  activeId?: string;
  isPlaying: boolean;
  volume: number;
  prevVolume: number; 

  // The Two Buckets
  bucketA: string[];          
  bucketB: QueueItem[];       

  // 2. NEW STATE: The Active Context info
  activeContext?: PlayerContext; 
  
  // Shuffle & Repeat
  shuffledOrder: string[];    
  isShuffled: boolean;
  repeatMode: 'off' | 'context' | 'one';

  // --- ACTIONS ---
  // UPDATED ACTION: setId now accepts an optional context to track source
  setId: (id: string, context?: PlayerContext) => void;
  // 3. UPDATED ACTION: Accepts optional 'context'
  setIds: (ids: string[], context?: PlayerContext) => void; 
  
  addToQueue: (id: string) => void; 
  
  // Controls
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
      // INITIAL STATE
      activeId: undefined,
      isPlaying: false,
      volume: 0.3,
      prevVolume: 0.3,

      bucketA: [],
      bucketB: [],
      activeContext: undefined, // Start empty
      shuffledOrder: [],
      isShuffled: false,
      repeatMode: 'off',

      // --- BASIC SETTERS ---
      // UPDATED: Now supports context so clicking a song in a list updates the 'where'
      setId: (id: string, context?: PlayerContext) => set({ 
        activeId: id, 
        isPlaying: true,
        ...(context ? { activeContext: context } : {}) 
      }),
      
      // 4. UPDATED IMPLEMENTATION: Save the context!
      setIds: (ids: string[], context?: PlayerContext) => set({ 
        bucketA: ids, 
        activeContext: context, // Save "Album: Divide" etc.
        bucketB: [],       
        shuffledOrder: [], 
        isShuffled: false,
        isPlaying: true
      }),

      setIsPlaying: (value: boolean) => set({ isPlaying: value }),
      setVolume: (value: number) => set({ volume: value }),
      setPrevVolume: (value: number) => set({ prevVolume: value }),

      reset: () => set({ 
        bucketA: [], bucketB: [], activeId: undefined, isPlaying: false, activeContext: undefined 
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
            // 1. Create a copy of the original list
            const allIds = [...state.bucketA];
            
            // 2. Remove the current song from the shuffle pool
            const otherIds = allIds.filter(id => id !== state.activeId);
            
            // 3. Shuffle the "other" songs (Fisher-Yates)
            for (let i = otherIds.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [otherIds[i], otherIds[j]] = [otherIds[j], otherIds[i]];
            }

            // 4. Construct the final list: [Current Song, ...Shuffled Others]
            if (state.activeId) {
              newShuffledOrder = [state.activeId, ...otherIds];
            } else {
              newShuffledOrder = otherIds;
            }
          }

          return {
            isShuffled: newShuffleState,
            shuffledOrder: newShuffledOrder
          };
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
          shuffledOrder, isShuffled, repeatMode 
        } = get();

        if (bucketB.length > 0) {
          const nextItem = bucketB[0];
          const remainingQueue = bucketB.slice(1);
          set({ activeId: nextItem.id, bucketB: remainingQueue });
          return;
        }

        const currentList = isShuffled ? shuffledOrder : bucketA;
        const currentIndex = currentList.findIndex((id) => id === activeId);

        let nextIndex = currentIndex + 1;

        if (nextIndex >= currentList.length) {
          if (repeatMode === 'off') {
            set({ isPlaying: false }); 
            return;
          }
          nextIndex = 0; 
        }

        set({ activeId: currentList[nextIndex] });
      },

      playPrevious: () => {
        const { activeId, bucketA, shuffledOrder, isShuffled } = get();
        
        const currentList = isShuffled ? shuffledOrder : bucketA;
        const currentIndex = currentList.findIndex((id) => id === activeId);

        let prevIndex = currentIndex - 1;

        if (prevIndex < 0) {
          prevIndex = currentList.length - 1;
        }

        set({ activeId: currentList[prevIndex] });
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