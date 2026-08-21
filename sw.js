// ==========================================
// 葵涌堂悅曆 · Service Worker (FCM & PWA)
// 快取版本: v260821_7 (精簡版：直導 FCM 原始 URL)
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
// 1. Firebase 推播引擎 (FCM)
// ==========================================

// 💡 背景推播監聽器 (防重複 + 綁定原始目標網址)
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] 🚨 攔截到背景推播 Payload: ', payload);

    // 直接提取原始 url 或 link 數值，不做任何字串修改
    const targetUrl = payload.data?.url || payload.fcmOptions?.link || '';

    // 🛑 若 Payload 包含 notification 欄位，系統層級已自動跳出橫幅，跳過手動以防重複
    if (payload.notification) {
        console.log('[SW] ℹ️ 系統已自動渲染 Notification，已記錄原始目標網址：', targetUrl);
        return;
    }

    // 🟢 僅當發送純 data 封包（無 notification 欄位）時，由 sw.js 手動觸發通知
    const title = payload.data?.title || '葵涌堂悅曆';
    const options = {
        body: payload.data?.body || '您有一則新動態',
        icon: './icon-192.png',
        badge: './icon-192.png',
        data: {
            url: targetUrl
        }
    };

    self.registration.showNotification(title, options);
});

// 💡 關鍵新增：點擊通知攔截器 (直接跳轉 FCM 帶入的原始 url 值)
self.addEventListener('notificationclick', (event) => {
    event.notification.close(); // 1. 關閉通知橫幅

    // 2. 取得原始網址，完全不做任何格式或路徑修飾
    const notificationData = event.notification.data || {};
    const targetUrl = notificationData.url || notificationData.link;

    console.log('[SW] 🔗 點擊推播通知，直接導向原始 URL：', targetUrl);

    // 3. 若網址存在，執行開啓/導向動作
    if (targetUrl) {
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
                // 若已有開啟的瀏覽器視窗，直接導向並切換焦點
                for (let i = 0; i < clientList.length; i++) {
                    let client = clientList[i];
                    if ('navigate' in client && 'focus' in client) {
                        client.navigate(targetUrl);
                        return client.focus();
                    }
                }
                // 若無開啟中的視窗，在瀏覽器開啓新分頁導向目標網址
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