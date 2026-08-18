// 💡 每次您有重大更新，可以微調這個版本號 (例如 v3, v4)
const CACHE_NAME = 'ccagkc-pwa-cache-v2';

// 1. 安裝階段：強制最新的 Service Worker 立刻接管，不需等待舊版關閉
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

// 2. 啟動階段：清理過期的舊快取，並立即取得頁面控制權
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName); // 刪除舊版本
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. 攔截請求階段：專家級的「智慧分流機制」
self.addEventListener('fetch', (event) => {
    // 【策略 A】如果請求的是 HTML 網頁 (mode === 'navigate')
    // 採用「網路優先 (Network First)」：永遠先去伺服器抓最新版，若沒網路才退回用快取。
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                })
                .catch(() => {
                    // 若斷網，則提供舊的快取 HTML
                    return caches.match(event.request);
                })
        );
        return;
    }

    // 【策略 B】如果請求的是圖片、CSS、JS 等靜態資源
    // 採用「快取優先 (Cache First, falling back to network)」：保持閃電級載入速度
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || fetch(event.request).then((networkResponse) => {
                return caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                });
            });
        })
    );
});