// src/hooks/useNetworkProbe.ts
'use client';

import { useEffect, useRef } from 'react';
import useOfflineModeStore from '@/stores/useOfflineModeStore';

/**
 * Checks real end-to-end internet connectivity by issuing a 0-byte HEAD probe
 * to a globally distributed CDN endpoint with no-cors and cache: no-store.
 * This completely bypasses Windows virtual network adapters (VirtualBox, VPNs)
 * which trick navigator.onLine into always returning true.
 */
export async function checkConnectivity(timeoutMs = 3500): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Probe 1: Google 204 endpoint (fast, 0 bytes, no-cors)
    await fetch(`https://www.gstatic.com/generate_204?_=${Date.now()}`, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timer);
    return true;
  } catch {
    clearTimeout(timer);

    // Probe 2 fallback: Cloudflare CDN trace
    try {
      const fallbackCtrl = new AbortController();
      const fallbackTimer = setTimeout(() => fallbackCtrl.abort(), 2000);
      await fetch(`https://1.1.1.1/cdn-cgi/trace?_=${Date.now()}`, {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-store',
        signal: fallbackCtrl.signal,
      });
      clearTimeout(fallbackTimer);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Hook to continuously monitor physical internet availability.
 * Pings at low frequency (15s online, 5s offline, on focus, and on network events).
 * Updates useOfflineModeStore.setIsOnline.
 */
export function useNetworkProbe() {
  const setIsOnline = useOfflineModeStore((state) => state.setIsOnline);
  const isMountedRef = useRef(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    isMountedRef.current = true;

    const probe = async () => {
      const connected = await checkConnectivity();
      if (!isMountedRef.current) return;

      const current = useOfflineModeStore.getState().isOnline;
      if (connected !== current) {
        setIsOnline(connected);
      }

      // Schedule next probe: 15s if connected, 5s if disconnected
      const nextDelay = connected ? 15000 : 5000;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(probe, nextDelay);
    };

    // Initial check
    probe();

    const handleWindowFocus = () => {
      probe();
    };

    const handleOnline = () => {
      // Browser reports online event -> verify with probe immediately
      probe();
    };

    const handleOffline = () => {
      // Browser reports offline event -> immediately mark offline
      setIsOnline(false);
    };

    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      isMountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setIsOnline]);
}

