'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabaseClient'; 
import { saveContextSettings, loadContextSettings } from '@/lib/playerContextSettings';
import usePlaylistStore from '@/stores/usePlaylistStore'; 

/* =========================
   TYPES
========================= */

export interface QueueItem {
  id: string;      
  uid: string;     
}

// 🟢 UPDATE: Added 'artist' to the type union
export interface PlayerContext {
  type: 'album' | 'playlist' | 'liked' | 'artist';
  title: string;
  id?: string;
}

interface PlayerStore {
  /* Sync Helper */
  ids: string[];

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
  
  /* Restore Action */
  restoreState: (
    ids: string[], 
    priority: QueueItem[], 
    shuffledOrder: string[],
    activeId: string, 
    context: PlayerContext | undefined,
    isShuffled: boolean,
    isPlayingPriority: boolean,
    lastActiveId: string | undefined
  ) => void;

  /* Synchronize Queues */
  syncLikedSongs: (songId: string, action: 'add' | 'remove') => void;
  syncPlaylistQueue: (songId: string, playlistId: string, action: 'add' | 'remove') => void;

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
   HELPER: Update Last Accessed
========================= */
const updateLastAccessed = async (context?: PlayerContext) => {
    if (!context?.id) return;
    
    const now = new Date().toISOString();

    // 1. Handle Playlist Update
    if (context.type === 'playlist') {
        const { error } = await supabase
            .from('playlists')
            .update({ last_accessed_at: now })
            .eq('id', context.id);

        if (!error) {
            usePlaylistStore.getState().refreshPlaylists();
        }
    }

    // 2. Handle Album Update
    if (context.type === 'album') {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { error } = await supabase
                .from('saved_albums')
                .update({ last_accessed_at: now })
                .eq('album_id', context.id)
                .eq('user_id', user.id);

            if (!error) {
                usePlaylistStore.getState().refreshPlaylists();
            }
        }
    }
};

/* =========================
   STORE
========================= */

const usePlayerStore = create<PlayerStore>()(
  persist(
    (set, get) => ({
      /* ---------- INITIAL STATE ---------- */
      ids: [],
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

        if (context) updateLastAccessed(context);
      },

      setIds: (ids, context, userId) => {
        const state = get();
        const keepActive = state.activeId && ids.includes(state.activeId) ? state.activeId : undefined;

        set({
          ids: ids,
          sourceContextIds: ids,
          bucketA: ids, 
          shuffledOrder: [],
          isShuffled: false,
          activeContext: context,
          isPlaying: true,
          isPlayingPriority: false, 
          lastActiveContextId: keepActive || ids[0],
        });

        if (context) updateLastAccessed(context);

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

      /* Restore Function */
      restoreState: (ids, priority, shuffledOrder, activeId, context, isShuffled, isPlayingPriority, lastActiveId) => {
         set({
            ids: ids,
            sourceContextIds: ids,
            bucketB: priority,
            isShuffled: isShuffled,
            shuffledOrder: shuffledOrder,
            bucketA: isShuffled && shuffledOrder.length > 0 ? shuffledOrder : ids,
            activeId: activeId,
            activeContext: context,
            isPlayingPriority: isPlayingPriority,
            lastActiveContextId: lastActiveId,    
            isPlaying: false, 
            activeIdSignature: 0 
         });
      },

      playFromContext: (id, context) => {
        const state = get();
        updateLastAccessed(context);

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

      /* Sync Liked Songs */
      syncLikedSongs: (songId, action) => {
        const state = get();
        if (state.activeContext?.id !== 'liked-songs') return;

        const { bucketA, activeId, isShuffled, shuffledOrder, sourceContextIds } = state;
        const currentList = [...bucketA]; 

        if (action === 'remove') {
            const newList = currentList.filter(id => id !== songId);
            set({ 
                bucketA: newList,
                shuffledOrder: isShuffled ? newList : [],
                sourceContextIds: sourceContextIds.filter(id => id !== songId) 
            });
            return;
        }

        if (action === 'add') {
            if (currentList.includes(songId)) return;
            const newSource = [songId, ...sourceContextIds];

            const activeIndex = activeId ? currentList.indexOf(activeId) : -1;
            const min = activeIndex + 1;
            const max = currentList.length;
            const randomIndex = Math.floor(Math.random() * (max - min + 1)) + min;

            currentList.splice(randomIndex, 0, songId);

            set({
                bucketA: currentList,
                shuffledOrder: isShuffled ? currentList : [],
                sourceContextIds: newSource
            });
        }
      },

      /* Sync Custom Playlists */
      syncPlaylistQueue: (songId, playlistId, action) => {
        const state = get();
        if (state.activeContext?.id !== playlistId) return;

        const { bucketA, activeId, isShuffled, shuffledOrder, sourceContextIds } = state;
        const currentList = [...bucketA]; 

        // A. REMOVE
        if (action === 'remove') {
            const newList = currentList.filter(id => id !== songId);
            set({ 
                bucketA: newList,
                shuffledOrder: isShuffled ? newList : [],
                sourceContextIds: sourceContextIds.filter(id => id !== songId) 
            });
            return;
        }

        // B. ADD
        if (action === 'add') {
            if (currentList.includes(songId)) return;
            const newSource = [...sourceContextIds, songId];

            const activeIndex = activeId ? currentList.indexOf(activeId) : -1;
            
            if (isShuffled) {
                const min = activeIndex + 1;
                const max = currentList.length;
                const randomIndex = Math.floor(Math.random() * (max - min + 1)) + min;
                currentList.splice(randomIndex, 0, songId);
            } else {
                currentList.push(songId);
            }

            set({
                bucketA: currentList,
                shuffledOrder: isShuffled ? currentList : [],
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
          // TURNING OFF
          set({
            isShuffled: false,
            shuffledOrder: [],
            bucketA: state.sourceContextIds,
          });
        } else {
          // TURNING ON
          const source = [...state.sourceContextIds];
          if (!source.length) return;

          if (state.isPlayingPriority) {
              const bookmarkId = state.lastActiveContextId;
              const rest = bookmarkId ? source.filter(id => id !== bookmarkId) : [...source];
              
              for (let i = rest.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [rest[i], rest[j]] = [rest[j], rest[i]];
              }

              const newOrder = bookmarkId ? [bookmarkId, ...rest] : rest;

              set({
                isShuffled: true,
                shuffledOrder: newOrder,
                bucketA: newOrder,
              });

          } else {
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
        const { bucketA, bucketB, activeId, activeIdSignature, lastActiveContextId, isPlayingPriority, repeatMode } = get();

        // 1. Check Priority Queue (Bucket B)
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

        // 2. Determine Anchor (Priority -> Context jump, or Context -> Context step)
        const refId = isPlayingPriority ? lastActiveContextId : activeId;
        const currentIdx = refId ? bucketA.indexOf(refId) : -1;
        
        let nextIdx = currentIdx + 1;

        // 3. Handle End of List
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
        const { bucketA, activeId, activeIdSignature, lastActiveContextId, isPlayingPriority } = get();

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
          ids: [],
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