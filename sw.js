const CACHE_NAME = 'kcc-pwa-cache-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css?v=5',
    './manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const url = event.request.url;

    // 避開 API 與 CDN，強制走網路抓取最新資料
    if (url.includes('google.com') || url.includes('firebase') || url.includes('unpkg.com') || url.includes('cdn.tailwindcss.com')) {
        return; 
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || fetch(event.request);
        })
    );
});