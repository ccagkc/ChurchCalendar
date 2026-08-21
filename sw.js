// ==========================================
// 葵涌堂悅曆 · Service Worker (FCM & PWA)
// 快取版本: v260821_6 (已補齊推播點擊導向與 404 防呆機制)
// ==========================================

// 1. 載入 Firebase 9.x+ 相容版 SDK
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

// 💡 專案基底 URL (確保點擊永遠在 ChurchCalendar 子路徑下運作)
const SITE_BASE_URL = 'https://ccagkc.github.io/ChurchCalendar/';

// ==========================================
// 1. Firebase 推播引擎 (FCM)
// ==========================================

// 💡 智慧型背景推播監聽器 (防重複 + 綁定正確導向 URL)
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] 🚨 攔截到背景推播 Payload: ', payload);

    // 擷取 Custom Data 中的 url 或 fcmOptions.link
    const rawUrl = payload.data?.url || payload.fcmOptions?.link;

    // 🛑 若 Payload 包含 notification 欄位，系統層級已自動跳出橫幅，跳過手動以防重複
    if (payload.notification) {
        console.log('[SW] ℹ️ 系統已自動渲染 Notification，已綁定點擊目標網址：', rawUrl);
        return;
    }

    // 🟢 僅當發送純 data 封包（無 notification 欄位）時，由 sw.js 手動觸發通知
    const title = payload.data?.title || '葵涌堂悅曆';
    const options = {
        body: payload.data?.body || '您有一則新動態',
        icon: './icon-192.png',
        badge: './icon-192.png',
        data: {
            url: rawUrl
        }
    };

    self.registration.showNotification(title, options);
});

// 💡 關鍵新增：點擊通知攔截器 (點擊後精準開啟指定 URL 網頁)
self.addEventListener('notificationclick', (event) => {
    event.notification.close(); // 1. 點擊後立即關閉通知橫幅

    // 2. 解析目標網址
    let targetUrl = SITE_BASE_URL;
    const notificationData = event.notification.data || {};
    const rawUrl = notificationData.url || notificationData.link;

    if (rawUrl) {
        targetUrl = rawUrl;
    }

    console.log('[SW] 🔗 點擊推播通知，精準導向至：', targetUrl);

    // 3. 執行跳轉或切換至已開啟的分頁
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // 若瀏覽器已開啟 ChurchCalendar 頁面，直接切換 focus 並導向目標 URL
            for (let i = 0; i < clientList.length; i++) {
                let client = clientList[i];
                if (client.url && client.url.includes('ChurchCalendar') && 'navigate' in client) {
                    client.navigate(targetUrl);
                    return client.focus();
                }
            }
            // 若未開啟，打開新頁籤/視窗載入目標 URL
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});

// ==========================================
// 2. PWA 離線快取引擎 (具備網絡請求安全過濾)
// ==========================================
const CACHE_NAME = 'ccagkc-pwa-cache-v260821_7';
const STATIC_ASSETS = [
    './',
    './index.html',
    './style.css?v=5',
    './manifest.json',
    './icon-192.png'
];

// 安裝 Service Worker
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] 📦 靜態資源快取成功');
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// 啟動與清理舊快取
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('[SW] 🧹 清除舊快取:', key);
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// 💡 安全攔截與快取過濾 (Network-First 策略)
self.addEventListener('fetch', (event) => {
    const req = event.request;
    const url = new URL(req.url);

    // 🛑 安全過濾 1: 只處理 GET 請求
    if (req.method !== 'GET') return;

    // 🛑 安全過濾 2: 排除非 http/https 協定
    if (!url.protocol.startsWith('http')) return;

    // 🛑 安全過濾 3: 排除 API / Firebase 動態請求
    if (url.hostname.includes('googleapis.com') || 
        url.hostname.includes('firebase') || 
        url.hostname.includes('google-analytics')) {
        return;
    }

    // 🟢 通過安全檢查的 GET 請求：執行 Network-First
    event.respondWith(
        fetch(req)
            .then((response) => {
                if (response && response.status === 200 && response.type === 'basic') {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(req, responseToCache);
                    });
                }
                return response;
            })
            .catch(() => {
                return caches.match(req).then((cachedResponse) => {
                    return cachedResponse || caches.match('./index.html');
                });
            })
    );
});
