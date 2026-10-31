'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabaseClient'; 
import { saveContextSettings, loadContextSettings } from '@/lib/playerContextSettings';
import usePlaylistStore from '@/stores/usePlaylistStore'; 
import { offlineDb } from '@/lib/offlineDb'; 
import useDownloadStore from '@/stores/useDownloadStore'; 

/* =========================
   TYPES
========================= */

export interface QueueItem {
  id: string;      
  uid: string;     
}

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
  isPlayingAutoplay: boolean; 
  volume: number;
  prevVolume: number;
  progress_ms: number;

  /* 🟢 NEW: LYRICS SEEK STATE */
  seekRequest: number | null;
  setSeekRequest: (time: number | null) => void;

  /* Buckets */
  sourceContextIds: string[]; 
  bucketA: string[];          
  bucketB: QueueItem[];       
  autoplay: string[];         
  
  isShuffled: boolean;
  shuffledOrder: string[];    

  /* Context Logic */
  activeContext?: PlayerContext;
  lastActiveContextId?: string; 
  repeatMode: 'off' | 'context' | 'one';

  /* Core Actions */
  setId: (id: string, context?: PlayerContext) => void;
  setIds: (ids: string[], context?: PlayerContext, userId?: string) => void;
  playFromContext: (id: string, context: PlayerContext, currentSongIds?: string[]) => void; 
  playAutoplayItem: (id: string) => void; 
  
  /* Restore Action */
  restoreState: (
    ids: string[], 
    priority: QueueItem[], 
    shuffledOrder: string[],
    activeId: string, 
    context: PlayerContext | undefined,
    isShuffled: boolean,
    isPlayingPriority: boolean,
    isPlayingAutoplay: boolean,
    autoplay: string[],
    lastActiveId: string | undefined,
    shouldPlay?: boolean
  ) => void;

  /* Synchronize Queues */
  syncLikedSongs: (songId: string, action: 'add' | 'remove') => void;
  syncPlaylistQueue: (songId: string, playlistId: string, action: 'add' | 'remove') => void;

  /* Queue Management (Bucket B - Priority) */
  setBucketB: (newQueue: QueueItem[]) => void;
  addToQueue: (id: string) => void;
  addManyToQueue: (ids: string[]) => void; // 🟢 ADDED BULK QUEUE FUNCTION
  playQueueItem: (index: number) => void; 
  removeFromPriority: (uid: string) => void;
  reorderQueue: (from: number, to: number) => void;
  clearPriorityQueue: () => void; // 🟢 ADD THIS

  /* Context Management (Bucket A) */
  setContextList: (newOrder: string[]) => void;
  reorderContext: (from: number, to: number) => void;
  removeFromContext: (songId: string) => void;
  prependToContext: (songId: string) => void;

  /* Autoplay Management (Bucket C - AI) */
  setAutoplay: (ids: string[]) => void;
  appendAutoplay: (ids: string[]) => void;
  reorderAutoplay: (from: number, to: number) => void;

  /* Settings */
  isAnnouncerEnabled: boolean;
  toggleAnnouncer: () => void;
  narratorVolume: number;
  setNarratorVolume: (value: number) => void;
  setIsPlaying: (value: boolean) => void;
  setVolume: (value: number) => void;
  setPrevVolume: (value: number) => void;
  setProgressMs: (value: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;

  /* Navigation */
  playNext: () => void;
  playPrevious: () => void;
  getNextSongId: () => string | null;

  reset: () => void;
}

const updateLastAccessed = async (context?: PlayerContext) => {
    if (!context?.id) return;
    const now = new Date().toISOString();

    // 1. ALWAYS update offlineDb so offline sidebar sorting reflects recently played items
    try {
      if (context.type === 'playlist') {
        const pl = await offlineDb.playlists.get(context.id);
        if (pl) {
          await offlineDb.playlists.update(context.id, { last_accessed_at: now });
          usePlaylistStore.getState().refreshPlaylists();
        }
      } else if (context.type === 'album') {
        const alb = await offlineDb.albums.get(context.id);
        if (alb) {
          await offlineDb.albums.update(context.id, { last_accessed_at: now });
          usePlaylistStore.getState().refreshPlaylists();
        }
      }
    } catch {
      // Ignore Dexie errors
    }

    // 2. Also sync to cloud if online
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    try {
      if (context.type === 'playlist') {
          await supabase.from('playlists').update({ last_accessed_at: now }).eq('id', context.id);
          const { data } = await supabase.auth.getUser();
          if (data?.user) {
            await supabase
              .from('user_context_settings')
              .update({ updated_at: now })
              .eq('user_id', data.user.id)
              .eq('context_id', `saved_mix:${context.id}`);
          }
          usePlaylistStore.getState().refreshPlaylists();
      }

      if (context.type === 'album') {
          const { data } = await supabase.auth.getUser();
          if (data?.user) {
              const { error } = await supabase.from('saved_albums').update({ last_accessed_at: now }).eq('album_id', context.id).eq('user_id', data.user.id);
              if (!error) usePlaylistStore.getState().refreshPlaylists();
          }
      }

      if (context.type === 'artist') {
          const { data } = await supabase.auth.getUser();
          if (data?.user) {
              const { error } = await supabase.from('saved_artists').update({ last_accessed_at: now }).eq('artist_id', context.id).eq('user_id', data.user.id);
              if (!error) usePlaylistStore.getState().refreshPlaylists();
          }
      }
    } catch {
      // Offline: ignore network failure silently
    }
};

const usePlayerStore = create<PlayerStore>()(
  persist(
    (set, get) => ({
      ids: [],
      activeId: undefined,
      activeIdSignature: 0,
      isPlayingPriority: false,
      isPlayingAutoplay: false, 
      isPlaying: false,
      volume: 0.3,
      prevVolume: 0.3,
      progress_ms: 0,

      // 🟢 LYRICS SEEK STATE
      seekRequest: null,
      setSeekRequest: (time) => set({ seekRequest: time }),

      sourceContextIds: [],
      bucketA: [], 
      bucketB: [], 
      autoplay: [], 
      
      shuffledOrder: [],
      isShuffled: false,
      activeContext: undefined,
      lastActiveContextId: undefined,
      repeatMode: 'off',
      isAnnouncerEnabled: false,
      toggleAnnouncer: () => set((state) => ({ isAnnouncerEnabled: !state.isAnnouncerEnabled })),
      narratorVolume: 0.85,
      setNarratorVolume: (value) => set({ narratorVolume: Math.max(0, Math.min(1, value)) }),

      setId: (id, context) => {
        const state = get();
        // If we are playing AI, any context click resets AI.
        const isSameContext = (state.activeContext?.id === context?.id) && !state.isPlayingAutoplay;

        set({
          activeId: id,
          activeIdSignature: state.activeIdSignature + 1,
          isPlaying: true,
          isPlayingPriority: false, 
          isPlayingAutoplay: false, 
          autoplay: isSameContext ? state.autoplay : [],
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
          autoplay: [],  // New Context = Hard Reset
          isShuffled: false,
          activeContext: context,
          isPlaying: true,
          isPlayingPriority: false, 
          isPlayingAutoplay: false, 
          lastActiveContextId: keepActive || ids[0],
        });

        if (context) updateLastAccessed(context);

        if (userId && context) {
            loadContextSettings(userId, context).then((settings) => {
                if (!settings) return;
                const updates: Partial<PlayerStore> = { repeatMode: settings.repeat_mode };

                if (settings.shuffle_mode) {
                    const currentState = get();
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

      playAutoplayItem: (id) => {
        const state = get();
        set({
            activeId: id,
            activeIdSignature: state.activeIdSignature + 1,
            isPlaying: true,
            isPlayingPriority: false,
            isPlayingAutoplay: true, 
        });
      },

      restoreState: (ids, priority, shuffledOrder, activeId, context, isShuffled, isPlayingPriority, isPlayingAutoplay, autoplay, lastActiveId, shouldPlay?: boolean) => {
         let restoredIsPlaying = false;
         if (typeof shouldPlay === 'boolean') {
           restoredIsPlaying = shouldPlay;
         } else if (typeof window !== 'undefined') {
           try {
             const wasPlayingLocal = localStorage.getItem('musebuzz_was_playing');
             const lastSeekStr = localStorage.getItem('musebuzz_last_seek');
             if (wasPlayingLocal === 'true' && lastSeekStr) {
               const parsed = JSON.parse(lastSeekStr);
               // Restore playback if was actively playing within the last 15 minutes
               if (parsed.songId === activeId && Date.now() - (parsed.updatedAt || 0) < 900000) {
                 restoredIsPlaying = true;
               }
             }
           } catch {}
         }

         set({
            ids: ids,
            sourceContextIds: ids,
            bucketB: priority,
            autoplay: autoplay || [], 
            isShuffled: isShuffled,
            shuffledOrder: shuffledOrder,
            bucketA: isShuffled && shuffledOrder.length > 0 ? shuffledOrder : ids,
            activeId: activeId,
            activeContext: context,
            isPlayingPriority: isPlayingPriority,
            isPlayingAutoplay: isPlayingAutoplay || false,
            lastActiveContextId: lastActiveId,    
            isPlaying: restoredIsPlaying, 
            activeIdSignature: 0 
         });
      },

      playFromContext: (id, context, currentSongIds) => {
        const state = get();
        updateLastAccessed(context);

        const { isShuffled, bucketA, activeId, isPlayingPriority, lastActiveContextId } = state;
        const isSameContext =
          (state.activeContext?.id === context?.id ||
            (state.activeContext?.type === 'liked' && context?.type === 'liked')) &&
          !state.isPlayingAutoplay;

        // Base context IDs: if caller passed currentSongIds, use them to synchronize context state
        const effectiveBaseIds =
          currentSongIds && currentSongIds.length > 0
            ? currentSongIds
            : bucketA.includes(id)
            ? bucketA
            : [...bucketA, id];

        if (!isShuffled) {
          set({
            ids: effectiveBaseIds,
            sourceContextIds: effectiveBaseIds,
            bucketA: effectiveBaseIds,
            shuffledOrder: [],
            activeId: id,
            activeIdSignature: state.activeIdSignature + 1,
            isPlaying: true,
            isPlayingPriority: false,
            isPlayingAutoplay: false,
            autoplay: isSameContext ? state.autoplay : [],
            lastActiveContextId: id,
            activeContext: context,
          });
          return;
        }

        // Shuffle Mode:
        // Filter out any songs no longer present in effectiveBaseIds (e.g. unliked songs)
        const validShuffled = state.shuffledOrder.filter((itemId) => effectiveBaseIds.includes(itemId));
        // Add any missing songs from effectiveBaseIds
        for (const sId of effectiveBaseIds) {
          if (!validShuffled.includes(sId)) {
            validShuffled.push(sId);
          }
        }

        // Place the clicked song at the active position so playback starts immediately and remaining tracks follow
        const listWithoutTarget = validShuffled.filter((itemId) => itemId !== id);
        const newShuffledOrder = [id, ...listWithoutTarget];

        set({
          ids: effectiveBaseIds,
          sourceContextIds: effectiveBaseIds,
          bucketA: newShuffledOrder,
          shuffledOrder: newShuffledOrder,
          activeId: id,
          activeIdSignature: state.activeIdSignature + 1,
          isPlaying: true,
          isPlayingPriority: false,
          isPlayingAutoplay: false,
          autoplay: isSameContext ? state.autoplay : [],
          lastActiveContextId: id,
          activeContext: context,
        });
      },

      setBucketB: (newQueue) => set({ bucketB: newQueue }),
      addToQueue: (id) => {
        const newItem: QueueItem = { id, uid: uuidv4() };
        set((state) => ({ bucketB: [...state.bucketB, newItem] }));
      },
      // 🟢 IMPLEMENTED BULK QUEUE
      addManyToQueue: (ids) => {
        const newItems: QueueItem[] = ids.map(id => ({ id, uid: uuidv4() }));
        set((state) => ({ bucketB: [...state.bucketB, ...newItems] }));
      },
      clearPriorityQueue: () => set({ bucketB: [] }),
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
          isPlayingAutoplay: false, 
        });
      },
      removeFromPriority: (uid) => set((state) => ({ bucketB: state.bucketB.filter((i) => i.uid !== uid) })),
      reorderQueue: (from, to) => {
        set((state) => {
          const copy = [...state.bucketB];
          const [moved] = copy.splice(from, 1);
          copy.splice(to, 0, moved);
          return { bucketB: copy };
        });
      },

      setContextList: (newOrder) => {
        const { isShuffled } = get();
        set(isShuffled ? { shuffledOrder: newOrder, bucketA: newOrder } : { bucketA: newOrder });
      },
      reorderContext: (from, to) => {
        set((state) => {
          const list = state.isShuffled ? [...state.shuffledOrder] : [...state.bucketA];
          const [moved] = list.splice(from, 1);
          list.splice(to, 0, moved);
          return state.isShuffled ? { shuffledOrder: list, bucketA: list } : { bucketA: list };
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
            set({ bucketA: [songId, ...bucketA], shuffledOrder: [songId, ...shuffledOrder] });
        } else {
            set({ bucketA: [songId, ...bucketA] });
        }
      },

      setAutoplay: (ids) => set({ autoplay: ids }),
      appendAutoplay: (ids) => set((state) => ({ autoplay: [...state.autoplay, ...ids] })),
      reorderAutoplay: (from, to) => {
        set((state) => {
          const copy = [...state.autoplay];
          const [moved] = copy.splice(from, 1);
          copy.splice(to, 0, moved);
          return { autoplay: copy };
        });
      },

      syncLikedSongs: (songId, action) => {
        const state = get();
        const isLikedContext =
          state.activeContext?.type === 'liked' ||
          state.activeContext?.id === 'liked-songs' ||
          state.activeContext?.id === 'liked';
        if (!isLikedContext) return;
        const { bucketA, activeId, isShuffled, shuffledOrder, sourceContextIds, ids } = state;
        const currentList = [...bucketA]; 
        if (action === 'remove') {
            const newList = currentList.filter(id => id !== songId);
            set({ 
                ids: (ids || []).filter(id => id !== songId),
                bucketA: newList,
                shuffledOrder: isShuffled ? (shuffledOrder || []).filter(id => id !== songId) : [],
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
                ids: [songId, ...(ids || [])],
                bucketA: currentList,
                shuffledOrder: isShuffled ? currentList : [],
                sourceContextIds: newSource
            });
        }
      },
      syncPlaylistQueue: (songId, playlistId, action) => {
        const state = get();
        if (state.activeContext?.id !== playlistId) return;
        const { bucketA, activeId, isShuffled, shuffledOrder, sourceContextIds, ids } = state;
        const currentList = [...bucketA]; 
        if (action === 'remove') {
            const newList = currentList.filter(id => id !== songId);
            set({ 
                ids: (ids || []).filter(id => id !== songId),
                bucketA: newList,
                shuffledOrder: isShuffled ? (shuffledOrder || []).filter(id => id !== songId) : [],
                sourceContextIds: sourceContextIds.filter(id => id !== songId) 
            });
            return;
        }
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
                ids: [...(ids || []), songId],
                bucketA: currentList,
                shuffledOrder: isShuffled ? currentList : [],
                sourceContextIds: newSource
            });
        }
      },

      toggleShuffle: () => {
        const state = get();
        const next = !state.isShuffled;

        if (!next) {
          set({
            isShuffled: false,
            shuffledOrder: [],
            bucketA: state.sourceContextIds,
            // 🟢 AUTOPLAY IGNORED (Preserved)
            autoplay: state.autoplay 
          });
        } else {
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
                // 🟢 AUTOPLAY IGNORED (Preserved)
                autoplay: state.autoplay
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
                // 🟢 AUTOPLAY IGNORED (Preserved)
                autoplay: state.autoplay
              });
          }
        }
        
        const context = state.activeContext;
        if (context?.id && (typeof navigator === 'undefined' || navigator.onLine)) {
          supabase.auth.getUser().then(({ data }) => {
            if (!data?.user) return;
            saveContextSettings(data.user.id, context, {
              shuffle_mode: next,
              repeat_mode: state.repeatMode,
            });
          }).catch(() => {});
        }
      },

      toggleRepeat: () => {
        set((state) => {
          const modes: PlayerStore['repeatMode'][] = ['off', 'context', 'one'];
          const next = modes[(modes.indexOf(state.repeatMode) + 1) % modes.length];

          const context = state.activeContext;
          if (context?.id && (typeof navigator === 'undefined' || navigator.onLine)) {
            supabase.auth.getUser().then(({ data }) => {
              if (!data?.user) return;
              saveContextSettings(data.user.id, context, {
                shuffle_mode: state.isShuffled,
                repeat_mode: next,
              });
            }).catch(() => {});
          }
          return { repeatMode: next };
        });
      },

playNext: () => {
        const { bucketA, bucketB, autoplay, activeId, activeIdSignature, lastActiveContextId, isPlayingPriority, isPlayingAutoplay, repeatMode } = get();

        const isOffline = (typeof navigator !== 'undefined' && !navigator.onLine) ||
                          (typeof window !== 'undefined' && (window as any).__musebuzzIsOffline);
        const downloadedSongIds = useDownloadStore.getState().downloadedSongIds;
        const isOfflineWithDownloads = isOffline && downloadedSongIds.size > 0;

        // 1. Priority Queue
        if (bucketB.length > 0) {
            let nextIndex = 0;
            if (isOfflineWithDownloads) {
                nextIndex = bucketB.findIndex((item) => downloadedSongIds.has(item.id));
            }

            if (nextIndex !== -1) {
                const next = bucketB[nextIndex];
                const rest = bucketB.filter((_, idx) => idx !== nextIndex);
                set({
                    activeId: next.id,
                    activeIdSignature: activeIdSignature + 1,
                    bucketB: rest, 
                    isPlayingPriority: true,
                    isPlayingAutoplay: false, 
                    isPlaying: true
                });
                return;
            }
        }

        // 2. Autoplay (never active when offline)
        if (isPlayingAutoplay && !isOffline) {
             const currentIdx = activeId ? autoplay.indexOf(activeId) : -1;
             const nextIdx = currentIdx + 1;
             if (nextIdx < autoplay.length) {
                 set({
                     activeId: autoplay[nextIdx],
                     activeIdSignature: activeIdSignature + 1,
                     isPlaying: true
                 });
             }
             return; 
        }

        // 3. Context
        if (bucketA.length > 0) {
             const refId = isPlayingPriority ? lastActiveContextId : activeId;
             const currentIdx = refId ? bucketA.indexOf(refId) : -1;
             let nextIdx = -1;

             if (isOfflineWithDownloads) {
                 // Scan forward for next downloaded track
                 for (let i = currentIdx + 1; i < bucketA.length; i++) {
                     if (downloadedSongIds.has(bucketA[i])) {
                         nextIdx = i;
                         break;
                     }
                 }
                 // If repeatMode is context and none found after, loop back from beginning
                 if (nextIdx === -1 && repeatMode === 'context') {
                     for (let i = 0; i <= currentIdx; i++) {
                         if (downloadedSongIds.has(bucketA[i])) {
                             nextIdx = i;
                             break;
                         }
                     }
                 }
             } else {
                 let candidate = currentIdx + 1;
                 if (candidate >= bucketA.length) {
                     if (repeatMode === 'off') {
                         if (autoplay.length > 0 && !isOffline) {
                             set({
                                 activeId: autoplay[0],
                                 activeIdSignature: activeIdSignature + 1,
                                 isPlayingPriority: false,
                                 isPlayingAutoplay: true, 
                                 isPlaying: true
                             });
                             return;
                         } else {
                             set({ isPlaying: false, isPlayingPriority: false });
                             return;
                         }
                     }
                     if (repeatMode === 'context') {
                         candidate = 0; 
                     }
                 }
                 nextIdx = candidate;
             }

             if (nextIdx !== -1 && nextIdx < bucketA.length) {
                 const nextId = bucketA[nextIdx];
                 set({
                     activeId: nextId,
                     activeIdSignature: activeIdSignature + 1,
                     lastActiveContextId: nextId, 
                     isPlayingPriority: false, 
                     isPlayingAutoplay: false,
                     isPlaying: true
                 });
             } else {
                 set({ isPlaying: false, isPlayingPriority: false });
             }
        }
      },

playPrevious: () => {
        const { bucketA, autoplay, activeId, activeIdSignature, lastActiveContextId, isPlayingPriority, isPlayingAutoplay } = get();

        const isOffline = (typeof navigator !== 'undefined' && !navigator.onLine) ||
                          (typeof window !== 'undefined' && (window as any).__musebuzzIsOffline);
        const downloadedSongIds = useDownloadStore.getState().downloadedSongIds;
        const isOfflineWithDownloads = isOffline && downloadedSongIds.size > 0;

        if (isPlayingPriority && lastActiveContextId) {
            set({
                activeId: lastActiveContextId,
                activeIdSignature: activeIdSignature + 1,
                isPlayingPriority: false, 
                isPlaying: true
            });
            return;
        }

        if (isPlayingAutoplay && !isOffline) {
            const currentIdx = activeId ? autoplay.indexOf(activeId) : -1;
            if (currentIdx > 0) {
                set({
                    activeId: autoplay[currentIdx - 1],
                    activeIdSignature: activeIdSignature + 1,
                    isPlaying: true
                });
            } else {
                if (bucketA.length > 0) {
                    const lastContextId = bucketA[bucketA.length - 1];
                    set({
                        activeId: lastContextId,
                        activeIdSignature: activeIdSignature + 1,
                        lastActiveContextId: lastContextId,
                        isPlayingAutoplay: false, 
                        isPlaying: true
                    });
                }
            }
            return;
        }

        if (!bucketA.length) return;
        const currentIdx = activeId ? bucketA.indexOf(activeId) : -1;
        let prevIdx = -1;

        if (isOfflineWithDownloads) {
            // Scan backwards for previous downloaded track
            for (let i = currentIdx - 1; i >= 0; i--) {
                if (downloadedSongIds.has(bucketA[i])) {
                    prevIdx = i;
                    break;
                }
            }
        } else {
            prevIdx = currentIdx > 0 ? currentIdx - 1 : 0;
        }

        if (prevIdx !== -1) {
            const prevId = bucketA[prevIdx];
            set({
                activeId: prevId,
                activeIdSignature: activeIdSignature + 1,
                lastActiveContextId: prevId,
                isPlayingPriority: false,
                isPlayingAutoplay: false,
                isPlaying: true
            });
        }
      },

      getNextSongId: (): string | null => {
        const { bucketA, bucketB, autoplay, activeId, lastActiveContextId, isPlayingPriority, isPlayingAutoplay, repeatMode } = get();
        if (repeatMode === 'one') return null;

        const isOffline = (typeof navigator !== 'undefined' && !navigator.onLine) ||
                          (typeof window !== 'undefined' && (window as any).__musebuzzIsOffline);
        const downloadedSongIds = useDownloadStore.getState().downloadedSongIds;
        const isOfflineWithDownloads = isOffline && downloadedSongIds.size > 0;

        // 1. Priority Queue
        if (bucketB.length > 0) {
          let nextIndex = 0;
          if (isOfflineWithDownloads) {
            nextIndex = bucketB.findIndex((item) => downloadedSongIds.has(item.id));
          }
          if (nextIndex !== -1) {
            return bucketB[nextIndex].id;
          }
        }

        // 2. Autoplay (Bucket C)
        if (isPlayingAutoplay && !isOffline) {
          const currentIdx = activeId ? autoplay.indexOf(activeId) : -1;
          const nextIdx = currentIdx + 1;
          if (nextIdx < autoplay.length) {
            return autoplay[nextIdx];
          }
          return null;
        }

        // 3. Context (Bucket A)
        if (bucketA.length > 0) {
          const refId = isPlayingPriority ? lastActiveContextId : activeId;
          const currentIdx = refId ? bucketA.indexOf(refId) : -1;

          if (isOfflineWithDownloads) {
            for (let i = currentIdx + 1; i < bucketA.length; i++) {
              if (downloadedSongIds.has(bucketA[i])) return bucketA[i];
            }
            if (repeatMode === 'context') {
              for (let i = 0; i <= currentIdx; i++) {
                if (downloadedSongIds.has(bucketA[i])) return bucketA[i];
              }
            }
            return null;
          } else {
            let candidate = currentIdx + 1;
            if (candidate >= bucketA.length) {
              if (repeatMode === 'off') {
                if (autoplay.length > 0 && !isOffline) return autoplay[0];
                return null;
              } else if (repeatMode === 'context') {
                candidate = 0;
              }
            }
            return bucketA[candidate] || null;
          }
        }

        return null;
      },

      setIsPlaying: (value) => set({ isPlaying: value }),
      setVolume: (value) => set({ volume: value }),
      setPrevVolume: (value) => set({ prevVolume: value }),
      setProgressMs: (value) => set({ progress_ms: value }),
      reset: () =>
        set({
          ids: [],
          sourceContextIds: [],
          bucketA: [],
          shuffledOrder: [],
          bucketB: [],
          autoplay: [],
          activeId: undefined,
          isPlaying: false,
          activeContext: undefined,
          lastActiveContextId: undefined,
          isPlayingPriority: false,
          isPlayingAutoplay: false,
          isShuffled: false,
          progress_ms: 0,
        }),
    }),
    {
      name: 'musebuzz-player-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // UI preferences
        volume: state.volume,
        prevVolume: state.prevVolume,
        repeatMode: state.repeatMode,
        isShuffled: state.isShuffled,
        isAnnouncerEnabled: state.isAnnouncerEnabled,
        narratorVolume: state.narratorVolume,
        // Queue state — allows the player bar to appear immediately on reload
        activeId: state.activeId,
        activeContext: state.activeContext,
        lastActiveContextId: state.lastActiveContextId,
        bucketA: state.bucketA,
        bucketB: state.bucketB,
        autoplay: state.autoplay,
        shuffledOrder: state.shuffledOrder,
        sourceContextIds: state.sourceContextIds,
        ids: state.ids,
        isPlayingPriority: state.isPlayingPriority,
        isPlayingAutoplay: state.isPlayingAutoplay,
        progress_ms: state.progress_ms,
        // Always restore as paused — user must press play
        isPlaying: false,
      }),
    }
  )
);

export default usePlayerStore;