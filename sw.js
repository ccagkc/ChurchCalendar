// sw.js (v260819_12) - 離線快取與 FCM 雙劍合璧終極版

// ==========================================
// 1. Firebase 推播引擎 (FCM)
// ==========================================
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

messaging.onBackgroundMessage((payload) => {
    console.log('[SW] 🚨 成功攔截背景推播！Payload: ', payload);
    const notificationTitle = payload.notification?.title || '葵涌堂悅曆通知';
    const notificationOptions = {
        body: payload.notification?.body || '您有一則新訊息',
        icon: '/icon-192.png',
        data: payload.data || {}
    };
    self.registration.showNotification(notificationTitle, notificationOptions);
});

// ==========================================
// 2. PWA 離線快取引擎 (具備網絡請求安全過濾)
// ==========================================
const CACHE_NAME = 'ccagkc-pwa-cache-v260819_12';
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

// 💡 關鍵修復：安全攔截與快取過濾
self.addEventListener('fetch', (event) => {
    const req = event.request;
    const url = new URL(req.url);

    // 🛑 安全過濾 1: 只處理 GET 請求 (排除 POST, PUT, DELETE)
    if (req.method !== 'GET') return;

    // 🛑 安全過濾 2: 排除非 http/https 協定 (如 chrome-extension://, blob:)
    if (!url.protocol.startsWith('http')) return;

    // 🛑 安全過濾 3: 排除 Google Analytics、Firebase Realtime DB 或 WebChannel 動態請求
    if (url.hostname.includes('googleapis.com') || 
        url.hostname.includes('firebase') || 
        url.hostname.includes('google-analytics')) {
        return;
    }

    // 🟢 通過安全檢查的 GET 請求：執行 Network-First (網絡優先，失敗退回快取) 策略
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