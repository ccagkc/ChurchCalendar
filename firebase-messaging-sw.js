// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging-compat.js');

// 💡 專家設定：這裡填入您現有的 Firebase Config
const firebaseConfig = {
    apiKey: "AIzaSyAEMB-eVojfzcUMyKt9JgGK_okPRO2V73g",
    authDomain: "ccagkc-biblereading-project.firebaseapp.com",
    databaseURL: "https://ccagkc-biblereading-project-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "ccagkc-biblereading-project",
    storageBucket: "ccagkc-biblereading-project.firebasestorage.app",
    messagingSenderId: "962459311265",
    appId: "1:962459311265:web:cbad43a46491a046e5e4e0"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// 💡 專家設定：處理背景收到的推播訊息
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] 收到背景推播訊息', payload);
    const notificationTitle = payload.notification.title || '葵涌堂悅曆';
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/icon-192.png', // 您的網站圖示
        badge: '/icon-192.png',
        data: payload.data
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});