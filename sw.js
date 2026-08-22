// ==========================================
// 葵涌堂悅曆 · Service Worker (FCM & PWA)
// 快取版本: v260822_bc11
// ==========================================

const DEFAULT_SITE_URL = 'https://ccagkc.github.io/ChurchCalendar/';

// ⭐ 1. 最優先註冊 notificationclick（必須在 firebase.messaging() 之前）
//    這樣才能正確處理你在 onBackgroundMessage 裡 showNotification 出來的通知
self.addEventListener('notificationclick', (event) => {
    // 無論如何先關閉橫幅
    event.notification.close();

    // 阻止 Firebase SDK 自己的 click 處理（避免被強制開啟錯誤網址）
    event.stopImmediatePropagation();

    const notificationData = event.notification.data || {};
    const rawUrl = notificationData.url || notificationData.link || '';

    // 沒有傳入任何 url / link → 只關閉，不開網頁
    if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
        console.log('[SW] ℹ️ 無有效 URL，點擊後只關閉通知');
        return;
    }

    let targetUrl = null;
    const cleanedUrl = rawUrl.trim();

    // 解析 URL
    if (cleanedUrl.startsWith('?')) {
        // 相對 query，補上預設網址
        targetUrl = DEFAULT_SITE_URL + cleanedUrl;
    } else if (cleanedUrl.startsWith('http://') || cleanedUrl.startsWith('https://')) {
        try {
            const parsedUrl = new URL(cleanedUrl);
            // 只允許本專案網域 + 包含 ChurchCalendar 路徑，避免開到 404
            if (parsedUrl.hostname === 'ccagkc.github.io' &&
                parsedUrl.pathname.includes('ChurchCalendar')) {
                targetUrl = parsedUrl.href;
            }
        } catch (e) {
            console.warn('[SW] URL 格式錯誤，不開啟');
        }
    }

    // 解析後仍無有效 targetUrl → 只關閉
    if (!targetUrl) {
        console.log('[SW] ℹ️ 無法解析出有效目標網址，只關閉通知');
        return;
    }

    console.log('[SW] 🔗 開啟目標：', targetUrl);

    // 有有效 URL 才執行開啟 / focus
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // 優先 focus 已開啟且包含 ChurchCalendar 的分頁
            for (const client of clientList) {
                if (client.url && client.url.includes('ChurchCalendar') && 'focus' in client) {
                    // 可選：若支援 navigate 就導向目標網址
                    if ('navigate' in client) {
                        client.navigate(targetUrl);
                    }
                    return client.focus();
                }
            }
            // 沒有已開啟的分頁 → 開新視窗
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});

// 2. 載入 Firebase SDK
importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging-compat.js');

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

// 3. 背景推播：自己重新包裝並顯示通知
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] 🚨 攔截到背景推播 Payload: ', payload);

    const rawUrl = payload.data?.url || payload.data?.link || '';
    const title  = payload.data?.title || payload.notification?.title || '葵涌堂悅曆';
    const body   = payload.data?.body  || payload.notification?.body  || '您有一則新動態';

    const options = {
        body: body,
        icon: './icon-192.png',
        badge: './icon-192.png',
        data: { url: rawUrl }   // 這裡放的 data 會在 notificationclick 被讀到
    };

    self.registration.showNotification(title, options);
});

// ==========================================
// 4. PWA 離線快取（保持原樣）
// ==========================================
const CACHE_NAME = 'ccagkc-pwa-cache-v260822_bc11';
const STATIC_ASSETS = [
    './',
    './index.html',
    './style.css?v=5',
    './manifest.json',
    './icon-192.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) return caches.delete(key);
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    const url = new URL(req.url);

    if (req.method !== 'GET' || !url.protocol.startsWith('http')) return;
    if (url.hostname.includes('googleapis.com') || url.hostname.includes('firebase') || url.hostname.includes('google-analytics')) return;

    event.respondWith(
        fetch(req)
            .then((response) => {
                if (response && response.status === 200 && response.type === 'basic') {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(req, responseToCache));
                }
                return response;
            })
            .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
    );
});