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

    // 1. 提取自訂資料中的 url
    const rawUrl = payload.data?.url || payload.data?.link || payload.fcmOptions?.link || '';
    
    // 2. 提取標題與內文
    const title = payload.notification?.title || payload.data?.title || '葵涌堂悅曆';
    const body = payload.notification?.body || payload.data?.body || '您有一則新動態';

    // 3. 關鍵修正：將 rawUrl 顯式寫入 data 物件
    const options = {
        body: body,
        icon: './icon-192.png',
        badge: './icon-192.png',
        data: {
            url: rawUrl // 👈 這裡成功將 FCM 的 url 塞入 Notification 物件中！
        }
    };

    // 4. 由 SW 手動渲染通知 (確保 data 不會丟失)
    self.registration.showNotification(title, options);
});

// 💡 核心保險絲：全域點擊攔截與 404 強制修正引擎
self.addEventListener('notificationclick', (event) => {
    event.notification.close(); // 關閉原本的通知

    // 1. 此時 event.notification.data100% 存在，因為階段 1 已經手動寫入！
    const notificationData = event.notification.data || {};
    const rawUrl = notificationData.url;

    let targetUrl = DEFAULT_SITE_URL;

    // 2. 進行嚴謹解析
    if (rawUrl && typeof rawUrl === 'string') {
            const cleanedUrl = rawUrl.trim();
    
            // 🟢 情況 A：處理相對路徑 (?date=2026-08-22)
            if (cleanedUrl.startsWith('?')) {
                targetUrl = DEFAULT_SITE_URL + cleanedUrl;
            } 
            // 🟢 情況 B：利用原生 URL 物件進行精確結構解析
            else {
                try {
                    const parsedUrl = new URL(cleanedUrl);
                    
                    // 只要主網域是 ccagkc.github.io，且路徑包含 ChurchCalendar，即視為合法正確網址
                    if (parsedUrl.hostname === 'ccagkc.github.io' && parsedUrl.pathname.includes('ChurchCalendar')) {
                        targetUrl = parsedUrl.href; // 100% 保留包含 ?date=... 的完整網址
                    }
                } catch (e) {
                    console.warn('[SW] ⚠️ URL 格式解析失敗，退回預設網址:', e);
                }
            }
        }

    if (targetUrl === 'https://ccagkc.github.io/' || targetUrl === 'https://ccagkc.github.io') {
        targetUrl = DEFAULT_SITE_URL;
    }

    console.log('[SW] 🔗 最終成功擷取並解析導向 URL：', targetUrl);
   
// 3. 執行網頁開啓與切換
    if (targetUrl != 'https://ccagkc.github.io/') {
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
         });
    }
  );
});

// ==========================================
// 2. PWA 離線快取引擎 (具備網絡請求安全過濾)
// ==========================================
const CACHE_NAME = 'ccagkc-pwa-cache-v260821_bc2';
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
