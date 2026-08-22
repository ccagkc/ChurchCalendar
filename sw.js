// ==========================================
// 葵涌堂悅曆 · Service Worker (FCM & PWA)
// 快取版本: v260822_close_on_null (Data 為空時點擊僅關閉通知)
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

const DEFAULT_SITE_URL = 'https://ccagkc.github.io/ChurchCalendar/';

// ==========================================
// 1. Firebase 推播引擎 (FCM)
// ==========================================

// 背景推播監聽器
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] 🚨 攔截到背景推播 Payload: ', payload);

    // 🛑 避免雙重通知：若 Payload 包含 notification，系統已自動繪製橫幅，SW 靜默退出
    if (payload.notification) {
        return;
    }

    // 🟢 純 Data 封包：由 SW 手動繪製通知，並將 url 綁定入 data 物件
    const rawUrl = payload.data?.url || payload.data?.link || '';
    const title = payload.data?.title || '葵涌堂悅曆';
    const body = payload.data?.body || '您有一則新動態';

    const options = {
        body: body,
        icon: './icon-192.png',
        badge: './icon-192.png',
        data: { url: rawUrl }
    };

    self.registration.showNotification(title, options);
});

// 💡 點擊通知邏輯：有 URL 才開啟網頁；無 URL (Data 為空) 則直接關閉訊息！
self.addEventListener('notificationclick', (event) => {
    // 1. 無論如何，點擊後立即關閉通知橫幅
    event.notification.close();

    // 2. 提取 FCM 自訂資料中的 url
    const notificationData = event.notification.data || {};
    const rawUrl = notificationData.url || notificationData.link || event.notification.link;

    let targetUrl = null;

    // 3. 嚴謹解析 URL (判斷 FCM 是否傳入有效的 url 資料)
    if (rawUrl && typeof rawUrl === 'string') {
        const cleanedUrl = rawUrl.trim();

        if (cleanedUrl.startsWith('?')) {
            targetUrl = DEFAULT_SITE_URL + cleanedUrl;
        } else if (cleanedUrl.startsWith('http://') || cleanedUrl.startsWith('https://')) {
            try {
                const parsedUrl = new URL(cleanedUrl);
                // 確保只開啟專案相關頁面，避免導向根網域 404
                if (parsedUrl.hostname === 'ccagkc.github.io' && parsedUrl.pathname.includes('ChurchCalendar')) {
                    targetUrl = parsedUrl.href;
                }
            } catch (e) {
                console.warn('[SW] URL 格式不符，不進行開啟');
            }
        }
    }

    // 🛑 核心分支點：若 Data 為空或未能解析出有效 targetUrl，直接結束，不開啟任何網頁！
    if (!targetUrl) {
        console.log('[SW] ℹ️ FCM Data 為空或無有效 URL，點擊後已關閉通知，不開啓網頁。');
        return;
    }

    console.log('[SW] 🔗 偵測到有效 URL，呼叫瀏覽器開啟：', targetUrl);

    // 4. 僅當 targetUrl 存在時，才執行網頁開啟與切換
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (let i = 0; i < clientList.length; i++) {
                let client = clientList[i];
                if (client.url && client.url.includes('ChurchCalendar') && 'navigate' in client) {
                    client.navigate(targetUrl);
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});

// ==========================================
// 2. PWA 離線快取引擎 (具備網絡請求安全過濾)
// ==========================================
const CACHE_NAME = 'ccagkc-pwa-cache-v260822_bc4';
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