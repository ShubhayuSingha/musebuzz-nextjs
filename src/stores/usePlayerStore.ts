// src/stores/usePlayerStore.ts

'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabaseClient';
import { saveContextSettings, loadContextSettings } from '@/lib/playerContextSettings';

/* =========================
   TYPES
========================= */

export interface QueueItem {
  id: string;      
  uid: string;     
}

export interface PlayerContext {
  type: 'album' | 'playlist' | 'liked';
  title: string;
  id?: string;
}

interface PlayerStore {
  /* Playback State */
  activeId?: string;
  activeIdSignature: number; 
  isPlaying: boolean;
  isPlayingPriority: boolean; 
  volume: number;
  prevVolume: number;

  /* Buckets */
  sourceContextIds: string[]; 
  bucketA: string[];          
  bucketB: QueueItem[];       
  
  isShuffled: boolean;
  shuffledOrder: string[];    

  /* Context Logic */
  activeContext?: PlayerContext;
  lastActiveContextId?: string; 
  repeatMode: 'off' | 'context' | 'one';

  /* Core Actions */
  setId: (id: string, context?: PlayerContext) => void;
  setIds: (ids: string[], context?: PlayerContext, userId?: string) => void;
  playFromContext: (id: string, context: PlayerContext) => void; 

  /* 🟢 NEW: Synchronize Liked Songs Queue */
  syncLikedSongs: (songId: string, action: 'add' | 'remove') => void;

  /* Queue Management */
  setBucketB: (newQueue: QueueItem[]) => void;
  addToQueue: (id: string) => void;
  playQueueItem: (index: number) => void; 
  removeFromPriority: (uid: string) => void;
  reorderQueue: (from: number, to: number) => void;

  /* Context Management */
  setContextList: (newOrder: string[]) => void;
  reorderContext: (from: number, to: number) => void;
  removeFromContext: (songId: string) => void;
  prependToContext: (songId: string) => void;

  /* Settings */
  setIsPlaying: (value: boolean) => void;
  setVolume: (value: number) => void;
  setPrevVolume: (value: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;

  /* Navigation */
  playNext: () => void;
  playPrevious: () => void;

  reset: () => void;
}

/* =========================
   STORE
========================= */

const usePlayerStore = create<PlayerStore>()(
  persist(
    (set, get) => ({
      /* ---------- INITIAL STATE ---------- */
      activeId: undefined,
      activeIdSignature: 0,
      isPlayingPriority: false,
      isPlaying: false,
      volume: 0.3,
      prevVolume: 0.3,

      sourceContextIds: [],
      bucketA: [],
      shuffledOrder: [],
      bucketB: [], 

      isShuffled: false,
      activeContext: undefined,
      lastActiveContextId: undefined,
      repeatMode: 'off',

      /* ---------- CORE SETTERS ---------- */

      setId: (id, context) => {
        const state = get();
        set({
          activeId: id,
          activeIdSignature: state.activeIdSignature + 1,
          isPlaying: true,
          isPlayingPriority: false, 
          ...(context ? { activeContext: context } : {}),
          lastActiveContextId: id, 
        });
      },

      setIds: (ids, context, userId) => {
        const state = get();
        const keepActive = state.activeId && ids.includes(state.activeId) ? state.activeId : undefined;

        set({
          sourceContextIds: ids,
          bucketA: ids, 
          shuffledOrder: [],
          isShuffled: false,
          activeContext: context,
          isPlaying: true,
          isPlayingPriority: false, 
          lastActiveContextId: keepActive || ids[0],
        });

        if (userId && context) {
            loadContextSettings(userId, context).then((settings) => {
                if (!settings) return;
                const currentState = get();
                const updates: Partial<PlayerStore> = { repeatMode: settings.repeat_mode };

                if (settings.shuffle_mode) {
                    const activeId = currentState.activeId || ids[0];
                    const source = [...ids];
                    const rest = source.filter(id => id !== activeId);

                    for (let i = rest.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [rest[i], rest[j]] = [rest[j], rest[i]];
                    }

                    const newOrder = [activeId, ...rest];

                    updates.isShuffled = true;
                    updates.shuffledOrder = newOrder;
                    updates.bucketA = newOrder;
                }
                set(updates);
            });
        }
      },

      playFromContext: (id, context) => {
        const state = get();
        const { isShuffled, bucketA, activeId, isPlayingPriority, lastActiveContextId } = state;

        if (!isShuffled) {
            state.setId(id, context);
            return;
        }

        const anchorId = isPlayingPriority ? lastActiveContextId : activeId;

        if (!anchorId || !bucketA.includes(anchorId)) {
            state.setId(id, context);
            return;
        }

        const list = [...bucketA];
        const listWithoutTarget = list.filter(itemId => itemId !== id);
        const anchorIndex = listWithoutTarget.indexOf(anchorId);
        
        // Inject immediately after anchor
        listWithoutTarget.splice(anchorIndex + 1, 0, id);

        set({
            bucketA: listWithoutTarget,
            shuffledOrder: listWithoutTarget, 
            activeId: id,
            activeIdSignature: state.activeIdSignature + 1,
            isPlaying: true,
            isPlayingPriority: false, 
            lastActiveContextId: id,
            activeContext: context 
        });
      },

      /* 🟢 NEW: Synchronize Liked Songs Queue */
      syncLikedSongs: (songId, action) => {
        const state = get();

        // 1. Only run this if we are currently listening to "Liked Songs"
        //    (Checks for ID: 'liked-songs' which we set in LikedContent.tsx)
        if (state.activeContext?.id !== 'liked-songs') return;

        const { bucketA, activeId, isShuffled, shuffledOrder, sourceContextIds } = state;
        const currentList = [...bucketA]; // Determine which list to update

        // A. REMOVE LOGIC
        if (action === 'remove') {
            const newList = currentList.filter(id => id !== songId);
            set({ 
                bucketA: newList,
                shuffledOrder: isShuffled ? newList : [],
                sourceContextIds: sourceContextIds.filter(id => id !== songId) // Keep source in sync
            });
            return;
        }

        // B. ADD LOGIC
        if (action === 'add') {
            // Prevent duplicates
            if (currentList.includes(songId)) return;

            // Update Source (Always add to top for linear history)
            const newSource = [songId, ...sourceContextIds];

            // Update Queue (Bucket A)
            const activeIndex = activeId ? currentList.indexOf(activeId) : -1;
            
            // Logic: Insert randomly between (currentIndex + 1) and (End of List)
            // Range logic: min = activeIndex + 1, max = length
            const min = activeIndex + 1;
            const max = currentList.length;
            
            // Random index calculation
            const randomIndex = Math.floor(Math.random() * (max - min + 1)) + min;

            currentList.splice(randomIndex, 0, songId);

            set({
                bucketA: currentList,
                shuffledOrder: isShuffled ? currentList : [], // If shuffled, bucketA is the source of truth
                sourceContextIds: newSource
            });
        }
      },

      /* ---------- QUEUE MANAGEMENT (BUCKET B) ---------- */

      setBucketB: (newQueue) => set({ bucketB: newQueue }),

      addToQueue: (id) => {
        const newItem: QueueItem = { id, uid: uuidv4() };
        set((state) => ({ bucketB: [...state.bucketB, newItem] }));
      },

      playQueueItem: (index) => {
        const { bucketB, activeIdSignature } = get();
        const item = bucketB[index];
        if (!item) return;

        const nextPriorityQueue = bucketB.slice(index + 1);

        set({
          activeId: item.id,
          activeIdSignature: activeIdSignature + 1,
          bucketB: nextPriorityQueue, 
          isPlaying: true,
          isPlayingPriority: true, 
        });
      },

      removeFromPriority: (uid) =>
        set((state) => ({
          bucketB: state.bucketB.filter((i) => i.uid !== uid),
        })),

      reorderQueue: (from, to) => {
        set((state) => {
          const copy = [...state.bucketB];
          const [moved] = copy.splice(from, 1);
          copy.splice(to, 0, moved);
          return { bucketB: copy };
        });
      },

      /* ---------- CONTEXT MANAGEMENT (BUCKET A) ---------- */

      setContextList: (newOrder) => {
        const { isShuffled } = get();
        set(isShuffled ? { shuffledOrder: newOrder, bucketA: newOrder } : { bucketA: newOrder });
      },

      reorderContext: (from, to) => {
        set((state) => {
          const list = state.isShuffled ? [...state.shuffledOrder] : [...state.bucketA];
          const [moved] = list.splice(from, 1);
          list.splice(to, 0, moved);

          return state.isShuffled
            ? { shuffledOrder: list, bucketA: list } 
            : { bucketA: list };
        });
      },

      removeFromContext: (songId) => {
        const { isShuffled, bucketA, shuffledOrder } = get();
        set({
            bucketA: bucketA.filter(id => id !== songId),
            shuffledOrder: isShuffled ? shuffledOrder.filter(id => id !== songId) : []
        });
      },

      prependToContext: (songId) => {
        const { isShuffled, bucketA, shuffledOrder } = get();
        if (isShuffled) {
            set({ 
                bucketA: [songId, ...bucketA],
                shuffledOrder: [songId, ...shuffledOrder]
            });
        } else {
            set({ bucketA: [songId, ...bucketA] });
        }
      },

      /* ---------- PLAYBACK MODES ---------- */

      toggleShuffle: () => {
        const state = get();
        const next = !state.isShuffled;

        if (!next) {
          set({
            isShuffled: false,
            shuffledOrder: [],
            bucketA: state.sourceContextIds,
          });
        } else {
          const source = [...state.sourceContextIds];
          if (!source.length) return;

          const activeId = state.activeId;
          const rest = activeId ? source.filter((id) => id !== activeId) : [...source];

          for (let i = rest.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [rest[i], rest[j]] = [rest[j], rest[i]];
          }

          const newOrder = activeId ? [activeId, ...rest] : rest;

          set({
            isShuffled: true,
            shuffledOrder: newOrder,
            bucketA: newOrder, 
          });
        }

        const context = state.activeContext;
        if (context?.id) {
          supabase.auth.getUser().then(({ data }) => {
            if (!data.user) return;
            saveContextSettings(data.user.id, context, {
              shuffle_mode: next,
              repeat_mode: state.repeatMode,
            });
          });
        }
      },

      toggleRepeat: () => {
        set((state) => {
          const modes: PlayerStore['repeatMode'][] = ['off', 'context', 'one'];
          const next = modes[(modes.indexOf(state.repeatMode) + 1) % modes.length];

          const context = state.activeContext;
          if (context?.id) {
            supabase.auth.getUser().then(({ data }) => {
              if (!data.user) return;
              saveContextSettings(data.user.id, context, {
                shuffle_mode: state.isShuffled,
                repeat_mode: next,
              });
            });
          }
          return { repeatMode: next };
        });
      },

      /* ---------- NAVIGATION Logic ---------- */

      playNext: () => {
        const {
          bucketA,
          bucketB,
          activeId,
          activeIdSignature,
          lastActiveContextId,
          isPlayingPriority,
          repeatMode
        } = get();

        if (bucketB.length > 0) {
            const [next, ...rest] = bucketB;
            set({
                activeId: next.id,
                activeIdSignature: activeIdSignature + 1,
                bucketB: rest, 
                isPlayingPriority: true,
                isPlaying: true
            });
            return;
        }

        if (!bucketA.length) return;

        const refId = isPlayingPriority ? lastActiveContextId : activeId;
        const currentIdx = refId ? bucketA.indexOf(refId) : -1;
        
        let nextIdx = currentIdx + 1;

        if (nextIdx >= bucketA.length) {
            if (repeatMode === 'off') {
                set({ isPlaying: false, isPlayingPriority: false });
                return;
            }
            if (repeatMode === 'context') {
                nextIdx = 0; 
            }
        }

        const nextId = bucketA[nextIdx];
        set({
            activeId: nextId,
            activeIdSignature: activeIdSignature + 1,
            lastActiveContextId: nextId, 
            isPlayingPriority: false, 
            isPlaying: true
        });
      },

      playPrevious: () => {
        const {
          bucketA,
          activeId,
          activeIdSignature,
          lastActiveContextId,
          isPlayingPriority
        } = get();

        if (isPlayingPriority && lastActiveContextId) {
            set({
                activeId: lastActiveContextId,
                activeIdSignature: activeIdSignature + 1,
                isPlayingPriority: false, 
                isPlaying: true
            });
            return;
        }

        if (!bucketA.length) return;

        let idx = activeId ? bucketA.indexOf(activeId) : -1;
        let prevIdx = idx - 1;
        if (prevIdx < 0) prevIdx = 0;

        const prevId = bucketA[prevIdx];

        set({
            activeId: prevId,
            activeIdSignature: activeIdSignature + 1,
            lastActiveContextId: prevId,
            isPlayingPriority: false,
            isPlaying: true
        });
      },

      /* ---------- MISC ---------- */

      setIsPlaying: (value) => set({ isPlaying: value }),
      setVolume: (value) => set({ volume: value }),
      setPrevVolume: (value) => set({ prevVolume: value }),

      reset: () =>
        set({
          sourceContextIds: [],
          bucketA: [],
          shuffledOrder: [],
          bucketB: [],
          activeId: undefined,
          isPlaying: false,
          activeContext: undefined,
          lastActiveContextId: undefined,
          isPlayingPriority: false,
          isShuffled: false,
        }),
    }),
    {
      name: 'musebuzz-player-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        volume: state.volume,
        prevVolume: state.prevVolume,
      }),
    }
  )
);

export default usePlayerStore;