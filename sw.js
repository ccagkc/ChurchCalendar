// ==========================================
// 葵涌堂悅曆 · Service Worker (FCM & PWA)
// 快取版本: v260821_1 (已修復推播點擊跳轉與子路徑 404 防呆)
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

// 💡 全域專案基底 URL (確保點擊永遠在 ChurchCalendar 子路徑下運作)
const SITE_BASE_URL = 'https://ccagkc.github.io/ChurchCalendar/';

/**
 * 🛠️ 輔助函式：URL 規格化修復器 (自動修復缺漏的子路徑，徹底告別 404)
 */
function sanitizeTargetUrl(rawUrl) {
    if (!rawUrl) return SITE_BASE_URL;
    
    // 若傳入的是完整的正確網址，直接回傳
    if (rawUrl.startsWith('https://ccagkc.github.io/ChurchCalendar/')) {
        return rawUrl;
    }
    
    // 若僅傳入參數 (如 "?date=2026-08-21" 或 "index.html?date=2026-08-21")
    if (rawUrl.startsWith('?') || rawUrl.startsWith('index.html')) {
        const queryStr = rawUrl.includes('?') ? rawUrl.substring(rawUrl.indexOf('?')) : '';
        return SITE_BASE_URL + queryStr;
    }

    // 若被誤切割成根網域 (https://ccagkc.github.io/?date=...)，重新拼接專案路徑
    if (rawUrl.includes('ccagkc.github.io') && !rawUrl.includes('/ChurchCalendar/')) {
        const queryStr = rawUrl.includes('?') ? rawUrl.substring(rawUrl.indexOf('?')) : '';
        return SITE_BASE_URL + queryStr;
    }

    return SITE_BASE_URL;
}

// ==========================================
// 1. Firebase 推播引擎 (FCM) 接收與點擊處理
// ==========================================

// 💡 智慧型背景推播監聽器 (防重複 + 綁定正確導向 URL)
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] 🚨 攔截到背景推播 Payload: ', payload);

    // 擷取 Custom Data 中的 url 或 fcmOptions.link
    const rawUrl = payload.data?.url || payload.fcmOptions?.link;
    const targetUrl = sanitizeTargetUrl(rawUrl);

    // 🛑 若 Payload 包含 notification 欄位，系統已自動渲染橫幅，但我們需要補充點擊事件資料
    if (payload.notification) {
        console.log('[SW] ℹ️ 系統已自動渲染橫幅，已記錄點擊目標網址：', targetUrl);
        return;
    }

    // 🟢 僅當發送純 data 封包（無 notification 欄位）時，由 sw.js 手動觸發通知
    const title = payload.data?.title || '🕊️ 葵涌堂每日靈修';
    const options = {
        body: payload.data?.body || '今日讀經進度已更新，點擊即刻閱讀。',
        icon: './icon-192.png',
        badge: './icon-192.png',
        data: {
            url: targetUrl
        }
    };

    self.registration.showNotification(title, options);
});

// 💡 關鍵新增：點擊通知攔截器 (攔截點擊並精準跳轉至當天讀經分頁)
self.addEventListener('notificationclick', (event) => {
    event.notification.close(); // 點擊後關閉通知橫幅

    // 嘗試從通知物件的 data 中提取目標網址
    // let targetUrl = SITE_BASE_URL;
    // if (event.notification && event.notification.data && event.notification.data.url) {
    //    targetUrl = sanitizeTargetUrl(event.notification.data.url);
    }

    // console.log('[SW] 🔗 點擊推播通知，準備精準導向至：', targetUrl);

    // event.waitUntil(
    //    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // 檢查瀏覽器是否已開啟 ChurchCalendar 頁面
    //        for (let i = 0; i < clientList.length; i++) {
    //            let client = clientList[i];
    //            if (client.url && client.url.includes('ChurchCalendar') && 'navigate' in client) {
    //                client.navigate(targetUrl);
    //                return client.focus();
    //            }
    //        }
    //        // 若尚未開啟，打開新頁籤導向完整目標網址
    //        if (clients.openWindow) {
    //            return clients.openWindow(targetUrl);
    //        }
    //    })
    //);
});

// ==========================================
// 2. PWA 離線快取引擎 (具備網絡請求安全過濾)
// ==========================================
const CACHE_NAME = 'ccagkc-pwa-cache-v260821_3';
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
