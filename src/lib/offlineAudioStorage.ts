// src/lib/offlineAudioStorage.ts
import { offlineDb } from './offlineDb';

const CACHE_AUDIO_NAME = 'musebuzz-audio-v1';
const CACHE_MEDIA_IMAGES_NAME = 'musebuzz-media-images-v1';
const CACHE_STATIC_NAME = 'musebuzz-static-v3';

/**
 * Downloads and caches an audio MP3 into the Cache API
 */
export async function saveAudioToCache(audioUrl: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('caches' in window)) return false;

  try {
    const audioCache = await caches.open(CACHE_AUDIO_NAME);

    // Check if already in cache
    const existing = await audioCache.match(audioUrl, { ignoreSearch: true, ignoreVary: true });
    if (existing) return true;

    // Fetch and store
    const response = await fetch(audioUrl, {
      method: 'GET',
      headers: { 'Accept': 'audio/*' }
    });

    if (!response.ok) {
      console.error(`[Offline Storage] Failed to fetch audio: ${response.statusText}`);
      return false;
    }

    await audioCache.put(audioUrl, response);
    return true;
  } catch (error) {
    console.error('[Offline Storage] Error caching audio file:', error);
    return false;
  }
}

/**
 * Checks if an audio URL exists in the cache
 */
export async function isAudioCached(audioUrl: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('caches' in window)) return false;

  try {
    const audioCache = await caches.open(CACHE_AUDIO_NAME);
    const match = await audioCache.match(audioUrl, { ignoreSearch: true });
    return !!match;
  } catch {
    return false;
  }
}

/**
 * Removes an audio file from cache
 */
export async function removeAudioFromCache(audioUrl: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('caches' in window)) return false;

  try {
    const audioCache = await caches.open(CACHE_AUDIO_NAME);
    return await audioCache.delete(audioUrl, { ignoreSearch: true });
  } catch (error) {
    console.error('[Offline Storage] Error deleting audio cache:', error);
    return false;
  }
}

/**
 * Caches an album or playlist cover image
 */
export async function saveImageToCache(imageUrl: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('caches' in window) || !imageUrl) return false;

  try {
    const mediaImgCache = await caches.open(CACHE_MEDIA_IMAGES_NAME);
    const existing = await mediaImgCache.match(imageUrl, { ignoreSearch: true, ignoreVary: true });
    if (existing) return true;

    const response = await fetch(imageUrl);
    if (!response.ok) return false;

    await mediaImgCache.put(imageUrl, response);
    return true;
  } catch (error) {
    console.warn('[Offline Storage] Failed to cache image:', error);
    return false;
  }
}

/**
 * Fetches an image and converts it to a base64 Data URL for persistent offline storage in IndexedDB
 */
export async function fetchImageAsDataUrl(imageUrl: string): Promise<string | null> {
  if (typeof window === 'undefined' || !imageUrl) return null;
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn('[Offline Storage] Failed to convert image to data URL:', e);
    return null;
  }
}

/**
 * Removes an image from cache
 */
export async function removeImageFromCache(imageUrl: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('caches' in window) || !imageUrl) return false;

  try {
    let deleted = false;
    if (await caches.has(CACHE_MEDIA_IMAGES_NAME)) {
      const mediaImgCache = await caches.open(CACHE_MEDIA_IMAGES_NAME);
      deleted = await mediaImgCache.delete(imageUrl, { ignoreSearch: true });
    }
    if (await caches.has(CACHE_STATIC_NAME)) {
      const staticCache = await caches.open(CACHE_STATIC_NAME);
      const delStatic = await staticCache.delete(imageUrl, { ignoreSearch: true });
      deleted = deleted || delStatic;
    }
    return deleted;
  } catch {
    return false;
  }
}

/**
 * Formats bytes into B, KB, MB or GB
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export interface StorageEstimate {
  usageBytes: number;
  quotaBytes: number;
  formattedUsage: string;
  formattedQuota: string;
  percentUsed: number;
}

/**
 * Gets storage quota and exact usage of offline storage
 */
export async function getOfflineStorageEstimate(): Promise<StorageEstimate> {
  if (typeof window === 'undefined') {
    return {
      usageBytes: 0,
      quotaBytes: 0,
      formattedUsage: '0 B',
      formattedQuota: 'Unknown',
      percentUsed: 0
    };
  }

  try {
    const songCount = await offlineDb.songs.count();
    const albumCount = await offlineDb.albums.count();
    const playlistCount = await offlineDb.playlists.count();

    // If no downloaded items exist in offlineDb, downloaded usage is strictly 0 B
    if (songCount === 0 && albumCount === 0 && playlistCount === 0) {
      let quotaBytes = 0;
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        quotaBytes = est.quota || 0;
      }
      return {
        usageBytes: 0,
        quotaBytes,
        formattedUsage: '0 B',
        formattedQuota: formatBytes(quotaBytes),
        percentUsed: 0
      };
    }

    let totalBytes = 0;

    // 1. Audio Cache size (downloaded MP3 audio files)
    if ('caches' in window) {
      if (await caches.has(CACHE_AUDIO_NAME)) {
        const audioCache = await caches.open(CACHE_AUDIO_NAME);
        const requests = await audioCache.keys();
        for (const req of requests) {
          const res = await audioCache.match(req);
          if (res) {
            const cl = res.headers.get('content-length');
            if (cl) {
              totalBytes += parseInt(cl, 10) || 0;
            } else {
              try {
                const blob = await res.clone().blob();
                totalBytes += blob.size;
              } catch {}
            }
          }
        }
      }

      // 2. Media Images Cache size (downloaded covers and artist images)
      if (await caches.has(CACHE_MEDIA_IMAGES_NAME)) {
        const imgCache = await caches.open(CACHE_MEDIA_IMAGES_NAME);
        const requests = await imgCache.keys();
        for (const req of requests) {
          const res = await imgCache.match(req);
          if (res) {
            const cl = res.headers.get('content-length');
            if (cl) {
              totalBytes += parseInt(cl, 10) || 0;
            } else {
              try {
                const blob = await res.clone().blob();
                totalBytes += blob.size;
              } catch {}
            }
          }
        }
      }
    }

    // 3. IndexedDB metadata size (songs, playlists, albums)
    try {
      const [songs, albums, playlists] = await Promise.all([
        offlineDb.songs.toArray(),
        offlineDb.albums.toArray(),
        offlineDb.playlists.toArray()
      ]);
      const jsonStr = JSON.stringify({ songs, albums, playlists });
      totalBytes += new Blob([jsonStr]).size;
    } catch (e) {
      console.warn('[Offline Storage] DB size calculation fallback:', e);
    }

    // Quota from browser
    let quotaBytes = 0;
    if (navigator.storage && navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      quotaBytes = est.quota || 0;
    }

    const percentUsed = quotaBytes > 0 ? Math.round((totalBytes / quotaBytes) * 100) : 0;

    return {
      usageBytes: totalBytes,
      quotaBytes,
      formattedUsage: formatBytes(totalBytes),
      formattedQuota: formatBytes(quotaBytes),
      percentUsed
    };
  } catch (err) {
    console.warn('[Offline Storage] Download storage calculation failed:', err);
    return {
      usageBytes: 0,
      quotaBytes: 0,
      formattedUsage: '0 B',
      formattedQuota: 'Unknown',
      percentUsed: 0
    };
  }
}

/**
 * Completely clears all downloaded music, albums, playlists, and audio cache
 */
export async function clearAllOfflineStorage(): Promise<void> {
  try {
    // 1. Clear IndexedDB tables
    await offlineDb.transaction('rw', [
      offlineDb.playlists,
      offlineDb.albums,
      offlineDb.songs,
      offlineDb.song_references,
      offlineDb.playback_state
    ], async () => {
      await offlineDb.playlists.clear();
      await offlineDb.albums.clear();
      await offlineDb.songs.clear();
      await offlineDb.song_references.clear();
      await offlineDb.playback_state.clear();
    });

    // 2. Clear Downloaded Audio & Downloaded Media Images Caches
    if (typeof window !== 'undefined' && 'caches' in window) {
      await caches.delete(CACHE_AUDIO_NAME);
      await caches.delete(CACHE_MEDIA_IMAGES_NAME);
    }

    console.log('[Offline Storage] All offline data successfully cleared.');
  } catch (error) {
    console.error('[Offline Storage] Error clearing offline data:', error);
    throw error;
  }
}

/**
 * Requests browser persistent storage so browser eviction under low disk space is prevented
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof window !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persisted();
      if (isPersisted) return true;

      const granted = await navigator.storage.persist();
      console.log(`[Offline Storage] Persistent storage granted: ${granted}`);
      return granted;
    } catch (e) {
      console.warn('[Offline Storage] Persistent storage request failed:', e);
    }
  }
  return false;
}

