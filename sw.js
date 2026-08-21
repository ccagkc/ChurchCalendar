// ==========================================
// 葵涌堂悅曆 · Service Worker (FCM & PWA)
// 快取版本: v260821_fix_404 (徹底解決系統預設通知 404 錯誤)
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

// 💡 專案正確保底網址
const DEFAULT_SITE_URL = 'https://ccagkc.github.io/ChurchCalendar/';

// ==========================================
// 1. Firebase 推播引擎 (FCM)
// ==========================================

// 背景推播監聽器
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] 🚨 攔截到背景推播 Payload: ', payload);

    // 🛑 若 Payload 包含 notification 欄位，作業系統已自動顯示通知，直接 return 避免產生雙重通知！
    if (payload.notification) {
        return;
    }

    // 🟢 僅當發送純 Data 封包時（如來自 API），由 SW 手動發送
    const title = payload.data?.title || '葵涌堂悅曆';
    const targetUrl = payload.data?.url || DEFAULT_SITE_URL;
    const options = {
        body: payload.data?.body || '您有一則新動態',
        icon: './icon-192.png',
        badge: './icon-192.png',
        data: { url: targetUrl }
    };

    self.registration.showNotification(title, options);
});

// 💡 核心保險絲：全域點擊攔截與 404 強制修正引擎
self.addEventListener('notificationclick', (event) => {
    event.notification.close(); // 關閉通知橫幅

    // 1. 嘗試從通知物件取得自訂 url
    const notificationData = event.notification.data || {};
    let targetUrl = notificationData.url || notificationData.link;

    // 2. 🛡️ 核心防呆：若點擊的是系統自動產生的通知（無 url），或是被瀏覽器預設轉向至根網域
    if (!targetUrl || targetUrl === 'https://ccagkc.github.io/' || targetUrl === 'https://ccagkc.github.io') {
        console.warn('[SW] ⚠️ 偵測到系統預設空網址/根網域，強制校正導向至 ChurchCalendar 子目錄！');
        targetUrl = DEFAULT_SITE_URL;
    }

    console.log('[SW] 🔗 最終安全導向網址：', targetUrl);

    // 3. 執行網頁開啓與切換
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // 若瀏覽器已開啟 ChurchCalendar 相關頁面，直接切換並導向
            for (let i = 0; i < clientList.length; i++) {
                let client = clientList[i];
                if (client.url && client.url.includes('ChurchCalendar') && 'navigate' in client) {
                    client.navigate(targetUrl);
                    return client.focus();
                }
            }
            // 若未開啟，開啓新頁籤導向正確網址
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});

// ==========================================
// 2. PWA 離線快取引擎 (具備網絡請求安全過濾)
// ==========================================
const CACHE_NAME = 'ccagkc-pwa-cache-v260821_fix_404';
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