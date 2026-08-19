// ==========================================
// 1. Firebase 推播引擎 (FCM) 模組載入
// ==========================================
importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging-compat.js');

// 初始化 Firebase
firebase.initializeApp({
    apiKey: "AIzaSyAEMB-eVojfzcUMyKt9JgGK_okPRO2V73g",
    authDomain: "ccagkc-biblereading-project.firebaseapp.com",
    databaseURL: "https://ccagkc-biblereading-project-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "ccagkc-biblereading-project",
    storageBucket: "ccagkc-biblereading-project.firebasestorage.app",
    messagingSenderId: "962459311265",
    appId: "1:962459311265:web:cbad43a46491a046e5e4e0"
});

const messaging = firebase.messaging();

// 強制攔截背景推播
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] 🚨 成功攔截到背景推播！Payload: ', payload);
    const notificationTitle = payload.notification?.title || '葵涌堂悅曆通知';
    const notificationOptions = {
        body: payload.notification?.body || '您有一則新訊息',
        icon: '/icon-192.png',
        data: payload.data || {}
    };
    self.registration.showNotification(notificationTitle, notificationOptions);
});

// ==========================================
// 2. 原本的 PWA 離線快取引擎 (Cache) 保持在下方
// ==========================================
const CACHE_NAME = 'ccagkc-pwa-cache-v260819_11'; // 💡 記得更新版號

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
