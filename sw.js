// 💡 【發佈鐵則】每次您修改了 index.html，請務必把這裡的 v3 改成 v4、v5...
// 只要這個檔案有任何一個字元變動，瀏覽器就會啟動強制更新機制！
const CACHE_NAME = 'ccagkc-pwa-cache-v260819_9'; 

self.addEventListener('install', (event) => {
    // 強制最新版的 Service Worker 立即接管，不等待舊版關閉
    self.skipWaiting(); 
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] 系統升級，刪除舊快取:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    // 【策略 A：HTML 頁面】採用「嚴格網路優先」並擊穿 Disk Cache
    if (event.request.mode === 'navigate') {
        event.respondWith(
            // 💡 專家核心解法：加入 { cache: 'no-store' } 
            // 這是命令 Chrome：「不准使用硬碟快取，給我去實體伺服器抓最新版！」
            fetch(event.request.url, { cache: 'no-store' })
                .then((networkResponse) => {
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                })
                .catch(() => {
                    // 若真的沒有網路 (Offline)，才退回使用快取畫面
                    return caches.match(event.request);
                })
        );
        return;
    }

    // 【策略 B：圖片、CSS 等靜態資源】採用「快取優先」以維持 0.01 秒極速載入
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
