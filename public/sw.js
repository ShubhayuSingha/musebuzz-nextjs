// public/sw.js
// MuseBuzz Service Worker - Version 1.2.0

const CACHE_STATIC_NAME = 'musebuzz-static-v5';
const CACHE_PAGES_NAME = 'musebuzz-pages-v2';
const CACHE_AUDIO_NAME = 'musebuzz-audio-v1';
const CACHE_MEDIA_IMAGES_NAME = 'musebuzz-media-images-v1';

const PRECACHE_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
  '/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/images/playlist-placeholder.jpg',
  '/images/album-placeholder.png',
  '/images/artist-placeholder.png',
  '/images/placeholder.svg'
];

// Message Event: Allow client to force skipWaiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// 1. Install Event: Precache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Precache asset failed:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// 2. Activate Event: Clean up stale caches and claim clients
self.addEventListener('activate', (event) => {
  const currentCaches = [CACHE_STATIC_NAME, CACHE_PAGES_NAME, CACHE_AUDIO_NAME, CACHE_MEDIA_IMAGES_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!currentCaches.includes(cacheName) && cacheName.startsWith('musebuzz-')) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Helper: Handle HTTP Range requests for cached audio (essential for Safari & mobile scrubbing)
async function handleRangeAudioRequest(request, cachedResponse) {
  const rangeHeader = request.headers.get('range');
  if (!rangeHeader) {
    return cachedResponse;
  }

  const arrayBuffer = await cachedResponse.arrayBuffer();
  const bytes = rangeHeader.replace(/bytes=/, '').split('-');
  const totalLength = arrayBuffer.byteLength;
  const start = parseInt(bytes[0], 10) || 0;
  const end = bytes[1] ? parseInt(bytes[1], 10) : totalLength - 1;

  if (start >= totalLength || end >= totalLength) {
    return new Response('', {
      status: 416,
      statusText: 'Range Not Satisfiable',
      headers: { 'Content-Range': `bytes */${totalLength}` }
    });
  }

  const slicedBuffer = arrayBuffer.slice(start, end + 1);
  return new Response(slicedBuffer, {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Range': `bytes ${start}-${end}/${totalLength}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': `${end - start + 1}`,
      'Content-Type': cachedResponse.headers.get('Content-Type') || 'audio/mpeg'
    }
  });
}

// 3. Fetch Event: Intelligent routing & caching
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Bypass dev HMR / hot-reload / chrome extensions / analytics
  if (
    url.pathname.includes('_next/webpack-hmr') ||
    url.pathname.includes('hot-update') ||
    url.protocol.startsWith('chrome-extension')
  ) {
    return;
  }

  // Audio files (Supabase Storage audio or audio cache)
  const isAudioRequest =
    url.pathname.includes('/storage/v1/object/public/songs/') ||
    request.headers.get('accept')?.includes('audio/') ||
    url.pathname.endsWith('.mp3');

  if (isAudioRequest) {
    event.respondWith(
      (async () => {
        const audioCache = await caches.open(CACHE_AUDIO_NAME);
        const cachedResponse = await audioCache.match(request, { ignoreSearch: true });

        if (cachedResponse) {
          return handleRangeAudioRequest(request, cachedResponse);
        }

        // Not in cache: fetch from network
        try {
          const networkResponse = await fetch(request);
          return networkResponse;
        } catch (err) {
          // If offline and not in cache
          return new Response('Audio unavailable offline', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        }
      })()
    );
    return;
  }

  // Dev stack frames helper
  if (url.pathname.includes('__nextjs_original-stack-frames')) {
    event.respondWith(
      fetch(request).catch(() => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }))
    );
    return;
  }

  // Handle manifest.json and favicon
  if (url.pathname === '/manifest.json' || url.pathname === '/favicon.ico' || url.pathname === '/icon.svg') {
    event.respondWith(
      (async () => {
        const staticCache = await caches.open(CACHE_STATIC_NAME);
        const cached = await staticCache.match(url.pathname, { ignoreSearch: true });
        if (cached) return cached;
        try {
          const res = await fetch(request);
          if (res.status === 200) staticCache.put(url.pathname, res.clone());
          return res;
        } catch {
          if (url.pathname === '/manifest.json') {
            return new Response(JSON.stringify({
              name: 'MuseBuzz',
              short_name: 'MuseBuzz',
              start_url: '/',
              display: 'standalone',
              theme_color: '#18181b',
              background_color: '#18181b'
            }), { status: 200, headers: { 'Content-Type': 'application/manifest+json' } });
          }
          return new Response('', { status: 200, headers: { 'Content-Type': 'image/x-icon' } });
        }
      })()
    );
    return;
  }

  // Next.js Static Chunks, Assets & Fonts
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/images/') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.json') ||
    url.pathname.endsWith('.ico')
  ) {
    event.respondWith(
      (async () => {
        const staticCache = await caches.open(CACHE_STATIC_NAME);

        // In dev and online mode, try network first to receive fresh updates, then cache
        try {
          const networkResponse = await fetch(request);
          if (networkResponse.status === 200) {
            staticCache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          // Offline: match against static cache or any active cache with ignoreSearch
          const cached = (await staticCache.match(request, { ignoreSearch: true })) ||
                         (await staticCache.match(url.pathname, { ignoreSearch: true })) ||
                         (await caches.match(request, { ignoreSearch: true }));
          if (cached) return cached;

          // If offline and chunk is not in cache, return valid dummy module instead of 404 to avoid ChunkLoadError
          if (url.pathname.endsWith('.js')) {
            return new Response('/* offline chunk placeholder */', {
              status: 200,
              headers: { 'Content-Type': 'application/javascript' }
            });
          }
          if (url.pathname.endsWith('.css')) {
            return new Response('', {
              status: 200,
              headers: { 'Content-Type': 'text/css' }
            });
          }
          return new Response('', { status: 200 });
        }
      })()
    );
    return;
  }

  // Next.js React Server Components (RSC) requests when navigating
  if (url.searchParams.has('_rsc') || request.headers.get('rsc') === '1') {
    event.respondWith(
      (async () => {
        const pagesCache = await caches.open(CACHE_PAGES_NAME);
        try {
          const res = await fetch(request);
          if (res.status === 200) {
            pagesCache.put(request, res.clone());
          }
          return res;
        } catch {
          const cached = await pagesCache.match(request);
          if (cached) return cached;
          return new Response('', { status: 200, headers: { 'Content-Type': 'text/x-component' } });
        }
      })()
    );
    return;
  }

  // Navigation requests (HTML Pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const pagesCache = await caches.open(CACHE_PAGES_NAME);

        try {
          // Network-first for fresh data
          const networkResponse = await fetch(request);
          if (networkResponse.status === 200) {
            pagesCache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (error) {
          // Network failed: Check cache for this specific page
          const cachedPage = await pagesCache.match(request);
          if (cachedPage) {
            return cachedPage;
          }

          // Fallback to home page shell if cached
          const cachedHome = await pagesCache.match('/');
          if (cachedHome) {
            return cachedHome;
          }

          // Fallback to offline page
          const staticCache = await caches.open(CACHE_STATIC_NAME);
          const fallback = await staticCache.match('/offline');
          if (fallback) {
            return fallback;
          }

          return new Response('Offline', { status: 503 });
        }
      })()
    );
    return;
  }

  // Next.js Image Optimization route (_next/image?url=...)
  if (url.pathname.startsWith('/_next/image')) {
    event.respondWith(
      (async () => {
        const targetUrl = url.searchParams.get('url');
        const staticCache = await caches.open(CACHE_STATIC_NAME);

        // 1. If targetUrl is in cache (saved during download or prior fetch), return it directly
        if (targetUrl) {
          const cachedTarget = await staticCache.match(targetUrl, { ignoreSearch: true, ignoreVary: true });
          if (cachedTarget) {
            return cachedTarget;
          }
        }

        const cachedReq = await staticCache.match(request, { ignoreSearch: true, ignoreVary: true });
        if (cachedReq) return cachedReq;

        // 2. Not cached: try network
        try {
          const networkResponse = await fetch(request);
          if (networkResponse.status === 200) {
            staticCache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch {
          // 3. Network failed / offline: check targetUrl again or serve clean fallback
          if (targetUrl) {
            const cachedTarget = await staticCache.match(targetUrl, { ignoreSearch: true, ignoreVary: true });
            if (cachedTarget) return cachedTarget;
          }
          const fallback = await staticCache.match('/images/placeholder.svg');
          if (fallback) return fallback;
          const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="#18181b"/><path d="M150 90v70a35 35 0 1 0 25 33.5V115h40V90h-65z" fill="#52525b"/></svg>`;
          return new Response(fallbackSvg, {
            status: 200,
            headers: { 'Content-Type': 'image/svg+xml' }
          });
        }
      })()
    );
    return;
  }

  // Supabase public cover images & general static resources
  if (url.hostname.includes('supabase.co') && url.pathname.includes('/object/public/')) {
    event.respondWith(
      (async () => {
        const staticCache = await caches.open(CACHE_STATIC_NAME);

        // 1. Check cache first with ignoreVary: true
        const cached = (await staticCache.match(request, { ignoreSearch: true, ignoreVary: true })) ||
                       (await staticCache.match(request.url, { ignoreSearch: true, ignoreVary: true })) ||
                       (await staticCache.match(url.href, { ignoreSearch: true, ignoreVary: true }));

        if (cached) {
          return cached;
        }

        // 2. Not in cache: try network
        try {
          const networkResponse = await fetch(request);
          if (networkResponse.status === 200) {
            staticCache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch {
          // Offline and not cached: return clean SVG placeholder instead of broken icon
          const fallback = await staticCache.match('/images/placeholder.svg');
          if (fallback) return fallback;
          const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="#18181b"/><path d="M150 90v70a35 35 0 1 0 25 33.5V115h40V90h-65z" fill="#52525b"/></svg>`;
          return new Response(fallbackSvg, {
            status: 200,
            headers: { 'Content-Type': 'image/svg+xml' }
          });
        }
      })()
    );
    return;
  }

  // All other Supabase requests (Auth /user, REST API) when offline
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(JSON.stringify({
          error: 'offline',
          message: 'Network offline. Request ignored in offline mode.'
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }
});
