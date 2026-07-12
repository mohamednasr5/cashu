/**
 * Service Worker — PWA Offline Support
 * نظام كاش ذكي يضمن عمل التطبيق بدون إنترنت
 * ============================================================
 */

const CACHE_NAME = 'vodafone-cash-v1.2.0';
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './device-module.css',
  './version.js',
  './app.js',
  './device-module.js',
  './services/firebase.service.js',
  './services/adb.service.js',
  './services/device.service.js',
  './services/wallet.service.js',
  './pages/device-dashboard-page.js',
  './pages/device-manager-page.js',
  './pages/wallet-numbers-page.js',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];

const EXTERNAL_CACHE = 'external-assets-v1';
const EXTERNAL_URLS = [
  'https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800;900&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js'
];

// ==================== Install ====================
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)),
      caches.open(EXTERNAL_CACHE).then(cache => cache.addAll(EXTERNAL_URLS))
    ]).then(() => {
      console.log('[SW] All assets cached');
      return self.skipWaiting();
    }).catch(err => {
      console.warn('[SW] Cache partial failure:', err);
      return self.skipWaiting();
    })
  );
});

// ==================== Activate ====================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME && key !== EXTERNAL_CACHE)
          .map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// ==================== Fetch ====================
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Firebase و ADB — Network First (تحتاج إنترنت)
  if (url.hostname.includes('firebaseio.com') ||
      url.hostname.includes('firebaseapp.com') ||
      url.hostname.includes('googleapis.com') ||
      url.protocol === 'ws:' || url.protocol === 'wss:') {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Firebase SDK scripts — Stale While Revalidate
  if (url.hostname.includes('gstatic.com') ||
      url.pathname.includes('firebase')) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  // الموارد الثابتة المحلية — Cache First
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // الموارد الخارجية (خطوط، أيقونات) — Stale While Revalidate
  event.respondWith(staleWhileRevalidate(event.request));
});

// ==================== Strategies ====================

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    // صفحة offline للملفات HTML
    if (request.headers.get('accept')?.includes('text/html')) {
      return caches.match('./index.html');
    }
    return new Response('', { status: 408, statusText: 'Offline' });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(EXTERNAL_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);

  return cached || fetchPromise;
}