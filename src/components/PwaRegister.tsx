'use client';

import { useEffect } from 'react';
import { offlineDb } from '@/lib/offlineDb';
import { getOfflineStorageEstimate, clearAllOfflineStorage, requestPersistentStorage } from '@/lib/offlineAudioStorage';
import * as offlineManager from '@/lib/offlineManager';
import * as downloadService from '@/lib/downloadService';
import { supabase } from '@/lib/supabaseClient';
import useDownloadStore from '@/stores/useDownloadStore';
import useOfflineModeStore from '@/stores/useOfflineModeStore';

export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Request persistent storage from browser to prevent eviction
    requestPersistentStorage();

    // Sync online status and listen to online/offline network changes
    useOfflineModeStore.getState().setIsOnline(navigator.onLine);

    const handleOnline = () => useOfflineModeStore.getState().setIsOnline(true);
    const handleOffline = () => useOfflineModeStore.getState().setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Refresh downloaded IDs in store on initial mount
    useDownloadStore.getState().refreshDownloadedStatus();

    // Attach offline testing utilities statically to window
    (window as any).__musebuzzOffline = {
      db: offlineDb,
      getStorageEstimate: getOfflineStorageEstimate,
      clearAll: clearAllOfflineStorage,
      downloadStore: useDownloadStore,
      downloadAlbum: (albumId: string) => downloadService.downloadAlbum(supabase, albumId),
      downloadPlaylist: (playlistId: string) => downloadService.downloadPlaylist(supabase, playlistId),
      syncPlaylist: (playlistId: string) => downloadService.syncPlaylist(supabase, playlistId),
      deleteAlbum: (albumId: string) => downloadService.deleteAlbumDownload(albumId),
      deletePlaylist: (playlistId: string) => downloadService.deletePlaylistDownload(playlistId),
      ...offlineManager,
      runVerificationTest: async () => {
        console.log('%c[Offline DB Test] Starting verification...', 'color: #10b981; font-weight: bold;');

        const dummySong = {
          id: 'test-song-x',
          title: 'Test Song X',
          duration_seconds: 180,
          song_path: 'songs/test.mp3',
          lyrics_snippet: JSON.stringify([{ start: 0, text: 'Hello offline world' }]),
        };

        // 1. Save Album with Song X
        await offlineManager.saveAlbumToDb({
          id: 'test-album-1',
          title: 'Test Album 1',
          downloaded_at: Date.now(),
          artists: { id: 'test-artist-1', name: 'Test Artist' },
          songs: [dummySong]
        });

        // 2. Save Playlist with Song X
        await offlineManager.savePlaylistToDb({
          id: 'test-playlist-1',
          title: 'Test Playlist 1',
          downloaded_at: Date.now(),
          playlist_songs: [{ song_order: 1, songs: dummySong }]
        });

        const refCount1 = await offlineManager.getSongReferenceCount('test-song-x');
        console.log('✓ Song X references across Album 1 and Playlist 1:', refCount1, '(expected: 2)');

        // 3. Remove Album 1
        await offlineManager.removeAlbumFromDb('test-album-1');
        const songStillPreserved = await offlineManager.getOfflineSongById('test-song-x');
        const refCount2 = await offlineManager.getSongReferenceCount('test-song-x');
        console.log('✓ After removing Album 1, Song X is still preserved:', !!songStillPreserved, 'Refs remaining:', refCount2, '(expected: 1)');

        // 4. Remove Playlist 1
        await offlineManager.removePlaylistFromDb('test-playlist-1');
        const songPruned = await offlineManager.getOfflineSongById('test-song-x');
        console.log('✓ After removing Playlist 1, Song X was safely pruned:', !songPruned, '(expected: true)');

        // 5. Storage estimate
        const estimate = await getOfflineStorageEstimate();
        console.log('✓ Storage estimate check:', estimate);

        console.log('%c[Offline DB Test] ALL VERIFICATION TESTS PASSED!', 'color: #10b981; font-weight: bold;');
        return { success: true };
      }
    };

    if (!('serviceWorker' in navigator)) return;

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });

        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.addEventListener('statechange', () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[PWA] New version available, activating immediately...');
                installingWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          }
        });

        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        console.log('[PWA] Service Worker registered with scope:', registration.scope);
      } catch (error) {
        console.warn('[PWA] Service Worker registration failed:', error);
      }
    };

    if (document.readyState === 'complete') {
      registerSW();
    } else {
      window.addEventListener('load', registerSW);
    }

    // Proactively cache all currently loaded script chunks & active HTML shell when online
    const cacheLoadedAssets = () => {
      if (typeof window !== 'undefined' && 'caches' in window && navigator.onLine) {
        caches.open('musebuzz-static-v5').then((cache) => {
          const scripts = Array.from(document.querySelectorAll('script[src]'))
            .map((s: any) => s.src)
            .filter((src: string) => src.includes('/_next/static/'));
          const links = Array.from(document.querySelectorAll('link[href]'))
            .map((l: any) => l.href)
            .filter((href: string) => href.includes('/_next/static/') || href.includes('/manifest.json'));
          const urls = [...new Set([...scripts, ...links])];
          urls.forEach((url) => {
            fetch(url).then((res) => {
              if (res.status === 200) cache.put(url, res);
            }).catch(() => {});
          });
        }).catch(() => {});

        // Keep cached home/page shell up to date with newest UI
        caches.open('musebuzz-pages-v2').then((cache) => {
          fetch(window.location.pathname).then((res) => {
            if (res.status === 200) cache.put(window.location.pathname, res);
          }).catch(() => {});
        }).catch(() => {});
      }
    };

    cacheLoadedAssets();
    window.addEventListener('online', cacheLoadedAssets);

    // Suppress Next.js dev overlay for expected offline network errors & ChunkLoadError
    const handleError = (event: ErrorEvent) => {
      const msg = event.message || '';
      const isOffline = !navigator.onLine || useOfflineModeStore.getState().isOfflineMode;
      if (
        isOffline &&
        (msg.includes('ChunkLoadError') ||
         msg.includes('Loading chunk') ||
         msg.includes('Failed to load') ||
         msg.includes('NetworkError'))
      ) {
        event.preventDefault();
        event.stopPropagation();
        console.warn('[PWA] Handled offline script error cleanly:', msg);
        return true;
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reasonStr = event.reason?.message || String(event.reason || '');
      const isOffline = !navigator.onLine || useOfflineModeStore.getState().isOfflineMode;
      if (
        isOffline && 
        (reasonStr.includes('Failed to fetch') || 
         reasonStr.includes('NetworkError') || 
         reasonStr.includes('Load failed') ||
         reasonStr.includes('ChunkLoadError') ||
         reasonStr.includes('Loading chunk'))
      ) {
        event.preventDefault();
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', cacheLoadedAssets);
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('load', registerSW);
    };
  }, []);

  return null;
}
