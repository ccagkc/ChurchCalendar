// ==========================================
// 葵涌堂悅曆 · Service Worker (FCM & PWA)
// 快取版本: v260821_debug_1 (Debug 專用：通知顯示原始 Hyperlink)
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

// ==========================================
// 1. Firebase 推播引擎 (FCM Debug 模式)
// ==========================================

// 💡 背景推播監聽器：攔截 Payload 並將 URL 顯現於通知內文
messaging.onBackgroundMessage((payload) => {
    console.log('[SW Debug] 🚨 攔截到背景推播 Payload: ', payload);

    // 1. 提取 FCM Payload 中的原始 url 或 link 數值
    const rawUrl = payload.data?.url || payload.fcmOptions?.link || payload.data?.link || '(未偵測到 URL)';

    // 2. 提取標題與內文
    const originTitle = payload.notification?.title || payload.data?.title || '葵涌堂悅曆';
    const originBody = payload.notification?.body || payload.data?.body || '您有一則新動態';

    // 3. 組合 Debug 顯示文字 (把將要跳轉的 Hyperlink 直接寫入內文)
    const debugTitle = `[Debug] ${originTitle}`;
    const debugBody = `${originBody}\n🔗 導向網址: ${rawUrl}`;

    const options = {
        body: debugBody,
        icon: './icon-192.png',
        badge: './icon-192.png',
        // 將原始網址帶入 data 物件供點擊觸發時讀取
        data: {
            url: rawUrl
        }
    };

    // 強制手動彈出包含 Debug 資訊的通知橫幅
    self.registration.showNotification(debugTitle, options);
});

// 💡 點擊通知攔截器 (直接導向 FCM 帶入的原始 url 值)
self.addEventListener('notificationclick', (event) => {
    event.notification.close(); // 1. 關閉通知橫幅

    // 2. 讀取綁定在 notification.data 中的原始 URL
    const notificationData = event.notification.data || {};
    const targetUrl = notificationData.url;

    console.log('[SW Debug] 🔗 點擊推播通知，準備導向原始 URL：', targetUrl);

    // 3. 執行跳轉 (若 URL 有效且非提示字串)
    if (targetUrl && targetUrl !== '(未偵測到 URL)') {
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
                // 若已開啟瀏覽器頁面，直接導向該網址並聚焦
                for (let i = 0; i < clientList.length; i++) {
                    let client = clientList[i];
                    if ('navigate' in client && 'focus' in client) {
                        client.navigate(targetUrl);
                        return client.focus();
                    }
                }
                // 若未開啟，開啓新頁籤導向目標 URL
                if (clients.openWindow) {
                    return clients.openWindow(targetUrl);
                }
            })
        );
    }
});

// ==========================================
// 2. PWA 離線快取引擎 (具備網絡請求安全過濾)
// ==========================================
const CACHE_NAME = 'ccagkc-pwa-cache-v260821_debug_1';
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

// 安全攔截與快取過濾 (Network-First 策略)
self.addEventListener('fetch', (event) => {
    const req = event.request;
    const url = new URL(req.url);

    if (req.method !== 'GET') return;
    if (!url.protocol.startsWith('http')) return;

    if (url.hostname.includes('googleapis.com') || 
        url.hostname.includes('firebase') || 
        url.hostname.includes('google-analytics')) {
        return;
    }

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