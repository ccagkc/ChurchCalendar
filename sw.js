// ==========================================
// 葵涌堂悅曆 · Service Worker (FCM & PWA)
// 快取版本: v260822_bc12
// ==========================================

const DEFAULT_SITE_URL = 'https://ccagkc.github.io/ChurchCalendar/';

// ⭐ 1. 最優先註冊 notificationclick（必須在 firebase.messaging() 之前）
//    攔截 Firebase SDK 的 click，改由我們開啟原始封包裡的自訂 url
self.addEventListener('notificationclick', (event) => {
    // 1. 關閉橫幅
    event.notification.close();

    // 2. 阻止 Firebase SDK 自己的 click 處理（避免開到錯誤網址）
    event.stopImmediatePropagation();

    const data = event.notification.data || {};

    // 3. 盡可能從各種可能位置取出自訂 url
    //    - 你自己放的 data.url / data.link
    //    - Firebase 內部 FCM_MSG 結構
    const rawUrl =
        data.url ||
        data.link ||
        data.FCM_MSG?.data?.url ||
        data.FCM_MSG?.data?.link ||
        data.FCM_MSG?.fcmOptions?.link ||
        data.FCM_MSG?.notification?.click_action ||
        '';

    // 沒有任何 url → 只關閉，不開網頁
    if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
        console.log('[SW] ℹ️ 無有效 URL，點擊後只關閉通知');
        return;
    }

    let targetUrl = null;
    const cleanedUrl = rawUrl.trim();

    // 4. 解析 URL（沿用你原本邏輯）
    if (cleanedUrl.startsWith('?')) {
        targetUrl = DEFAULT_SITE_URL + cleanedUrl;
    } else if (cleanedUrl.startsWith('http://') || cleanedUrl.startsWith('https://')) {
        try {
            const parsedUrl = new URL(cleanedUrl);
            // 只允許本專案網域 + 包含 ChurchCalendar，避免 404
            if (parsedUrl.hostname === 'ccagkc.github.io' &&
                parsedUrl.pathname.includes('ChurchCalendar')) {
                targetUrl = parsedUrl.href;
            }
        } catch (e) {
            console.warn('[SW] URL 格式錯誤，不開啟');
        }
    }

    if (!targetUrl) {
        console.log('[SW] ℹ️ 無法解析出有效目標網址，只關閉通知');
        return;
    }

    console.log('[SW] 🔗 開啟目標：', targetUrl);

    // 5. 有有效 URL 才開啟 / focus
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url && client.url.includes('ChurchCalendar') && 'focus' in client) {
                    if ('navigate' in client) {
                        client.navigate(targetUrl);
                    }
                    return client.focus();
                }
            }
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

// 3. 背景推播：不再自己 showNotification
//    讓 Firebase SDK 顯示原始 notification，我們只在 click 時接手
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] 🚨 攔截到背景推播 Payload: ', payload);
    // ⚠️ 刻意不呼叫 self.registration.showNotification()
    //    避免產生第二則通知
});

// ==========================================
// 4. PWA 離線快取
// ==========================================
const CACHE_NAME = 'ccagkc-pwa-cache-v260822_bc12';
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