// src/stores/usePlayerStore.ts
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
  isPlayingPriority: boolean; 
  isPlaying: boolean;
  volume: number;
  prevVolume: number; 

  bucketA: string[];          // Context Queue (Album/Playlist)
  bucketB: QueueItem[];       // Priority Queue (User added)

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
  
  // LOGIC: Seamless Drag & Drop
  updateQueueFromUnified: (unifiedList: any[]) => void;
  
  // LOGIC: Removal Actions
  removeFromContext: (songId: string) => void;
  removeFromPriority: (uid: string) => void; // New action for removing from Priority
  
  // LOGIC: New Like (Prepends to list or inserts randomly if shuffled)
  prependToContext: (songId: string) => void;

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
      // --- INITIAL STATE ---
      activeId: undefined,
      activeIdSignature: 0, 
      isPlayingPriority: false, 
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

      // --- ACTIONS ---

      setId: (id: string, context?: PlayerContext) => {
        const state = get();
        const isInContext = state.bucketA.includes(id);

        set({ 
          activeId: id,
          activeIdSignature: state.activeIdSignature + 1,
          isPlaying: true,
          isPlayingPriority: false, 
          ...(context ? { activeContext: context } : {}),
          // Update history reference if we are playing from the context
          ...(isInContext ? { lastActiveContextId: id } : {}) 
        });
      },
      
      setIds: (ids: string[], context?: PlayerContext) => {
        const state = get();
        
        // If the current song exists in the NEW list, keep track of it
        const currentIdInNewList = state.activeId && ids.includes(state.activeId) 
          ? state.activeId 
          : undefined;

        set({ 
          bucketA: ids, 
          activeContext: context,
          // CRITICAL: We DO NOT clear bucketB here. Priority persists across context switches.
          bucketB: state.bucketB,        
          
          shuffledOrder: [], 
          isShuffled: false,
          isPlaying: true,
          isPlayingPriority: false, 
          lastActiveContextId: currentIdInNewList 
        });
      },

      playQueueItem: (index: number) => {
        const { bucketB, activeIdSignature } = get();
        const itemToPlay = bucketB[index];
        if (!itemToPlay) return;

        const newQueue = [...bucketB];
        // Remove from priority queue immediately (It is "consumed")
        newQueue.splice(index, 1);

        set({
          activeId: itemToPlay.id,
          activeIdSignature: activeIdSignature + 1,
          bucketB: newQueue,
          isPlaying: true,
          isPlayingPriority: true 
        });
      },

      updateQueueFromUnified: (unifiedList: any[]) => {
        const { isShuffled, bucketA, activeId, lastActiveContextId, shuffledOrder } = get();

        // 1. Find the Divider
        const dividerIndex = unifiedList.findIndex(item => item.isDivider);
        
        let newBucketB: QueueItem[] = [];
        let newUpcomingIds: string[] = [];

        // Edge Case: If divider is missing (e.g. context became empty), assume all items are Priority
        if (dividerIndex === -1) {
             newBucketB = unifiedList.map(item => ({
                id: item.id,
                uid: item.uid && !item.uid.startsWith('ctx-') ? item.uid : uuidv4() 
             }));
        } else {
             // Split the list
             newBucketB = unifiedList.slice(0, dividerIndex).map(item => ({
                id: item.id,
                uid: item.uid && !item.uid.startsWith('ctx-') ? item.uid : uuidv4() 
             }));
             newUpcomingIds = unifiedList.slice(dividerIndex + 1).map(item => item.id);
        }

        // 4. Merge Context (History + Current + New Upcoming)
        const currentList = isShuffled ? shuffledOrder : bucketA;
        const currentRefId = activeId || lastActiveContextId;
        const splitIndex = currentList.findIndex(id => id === currentRefId);
        
        // Keep history intact (0 to current index)
        const historyAndCurrent = splitIndex !== -1 ? currentList.slice(0, splitIndex + 1) : [];
        
        const finalContextList = [...historyAndCurrent, ...newUpcomingIds];

        if (isShuffled) {
           set({ bucketB: newBucketB, shuffledOrder: finalContextList });
        } else {
           set({ bucketB: newBucketB, bucketA: finalContextList });
        }
      },

      removeFromContext: (songId: string) => {
         const { activeContext, bucketA, shuffledOrder, isShuffled } = get();
         
         const isLikedContext = 
            activeContext?.type === 'liked' || 
            (activeContext?.type === 'playlist' && activeContext?.title === 'Liked Songs');

         if (isLikedContext) {
             const newBucketA = bucketA.filter(id => id !== songId);
             
             let changes: any = { bucketA: newBucketA };

             if (isShuffled) {
                 const newShuffledOrder = shuffledOrder.filter(id => id !== songId);
                 changes.shuffledOrder = newShuffledOrder;
             }

             set(changes);
         }
      },

      removeFromPriority: (uid: string) => {
        const { bucketB } = get();
        // Filter out the specific item by its Unique ID
        const newBucketB = bucketB.filter((item) => item.uid !== uid);
        set({ bucketB: newBucketB });
      },

      prependToContext: (songId: string) => {
        const { activeContext, bucketA, shuffledOrder, isShuffled } = get();

        const isLikedContext = 
            activeContext?.type === 'liked' || 
            (activeContext?.type === 'playlist' && activeContext?.title === 'Liked Songs');

        if (isLikedContext) {
            // 1. Always add to TOP of Main Bucket
            const newBucketA = [songId, ...bucketA];
            
            let changes: any = { bucketA: newBucketA };

            // 2. Handle Shuffle: Insert at random position
            if (isShuffled) {
                 const newShuffledOrder = [...shuffledOrder];
                 const randomIndex = Math.floor(Math.random() * (newShuffledOrder.length + 1));
                 newShuffledOrder.splice(randomIndex, 0, songId);
                 
                 changes.shuffledOrder = newShuffledOrder;
            }

            set(changes);
        }
      },

      setIsPlaying: (value: boolean) => set({ isPlaying: value }),
      setVolume: (value: number) => set({ volume: value }),
      setPrevVolume: (value: number) => set({ prevVolume: value }),

      reset: () => set({ 
        bucketA: [], bucketB: [], activeId: undefined, isPlaying: false, activeContext: undefined, lastActiveContextId: undefined, isPlayingPriority: false
      }),

      addToQueue: (id: string) => {
        const newItem: QueueItem = { id: id, uid: uuidv4() };
        set((state) => ({ bucketB: [...state.bucketB, newItem] }));
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
        const { activeId, bucketA, bucketB, shuffledOrder, isShuffled, repeatMode, lastActiveContextId, activeIdSignature, isPlayingPriority } = get();

        // 1. Play Priority first
        if (bucketB.length > 0) {
          const nextItem = bucketB[0];
          const remainingQueue = bucketB.slice(1);
          set({ activeId: nextItem.id, activeIdSignature: activeIdSignature + 1, bucketB: remainingQueue, isPlayingPriority: true });
          return;
        }

        // 2. Play Context (Album/Playlist)
        const currentList = isShuffled ? shuffledOrder : bucketA;
        let currentIndex = -1;

        // FIX: Resume from history if we were in Priority Mode
        if (isPlayingPriority && lastActiveContextId) {
             currentIndex = currentList.findIndex((id) => id === lastActiveContextId);
        } else {
             currentIndex = currentList.findIndex((id) => id === activeId);
             // Fallback if activeId is missing
             if (currentIndex === -1 && lastActiveContextId) {
                currentIndex = currentList.findIndex((id) => id === lastActiveContextId);
             }
        }

        let nextIndex = currentIndex + 1;

        // 3. End of Playlist Handling
        if (nextIndex >= currentList.length) {
          // If Repeat is OFF: Go to start and PAUSE
          if (repeatMode === 'off') {
            if (currentList.length > 0) {
                set({ 
                    activeId: currentList[0], // Reset to Song 1
                    activeIdSignature: activeIdSignature + 1,
                    lastActiveContextId: currentList[0],
                    isPlaying: false, // PAUSE
                    isPlayingPriority: false 
                });
            } else {
                set({ isPlaying: false, isPlayingPriority: false });
            }
            return;
          }
          // If Repeat is ON: Loop to 0 and CONTINUE PLAYING
          nextIndex = 0; 
        }

        const nextSongId = currentList[nextIndex];
        
        set({ 
            activeId: nextSongId, 
            activeIdSignature: activeIdSignature + 1, 
            lastActiveContextId: nextSongId, 
            isPlayingPriority: false,
            isPlaying: true // Ensure playback continues
        });
      },

      playPrevious: () => {
        const { activeId, bucketA, shuffledOrder, isShuffled, lastActiveContextId, activeIdSignature, isPlayingPriority } = get();
        
        // If playing priority, go back to last context song
        if (isPlayingPriority) {
           if (lastActiveContextId) {
              set({ activeId: lastActiveContextId, activeIdSignature: activeIdSignature + 1, isPlayingPriority: false });
              return;
           }
        }

        const currentList = isShuffled ? shuffledOrder : bucketA;
        let currentIndex = currentList.findIndex((id) => id === activeId);

        if (currentIndex === -1 && lastActiveContextId) {
             set({ activeId: lastActiveContextId, activeIdSignature: activeIdSignature + 1, isPlayingPriority: false });
             return;
        }

        let prevIndex = currentIndex - 1;
        if (prevIndex < 0) {
          prevIndex = currentList.length > 0 ? currentList.length - 1 : 0;
        }

        const prevSongId = currentList[prevIndex];
        set({ activeId: prevSongId, activeIdSignature: activeIdSignature + 1, lastActiveContextId: prevSongId, isPlayingPriority: false });
      }
    }),
    {
      name: 'musebuzz-player-storage', 
      storage: createJSONStorage(() => localStorage), 
      partialize: (state) => ({ volume: state.volume, prevVolume: state.prevVolume }),
    }
  )
);

export default usePlayerStore;