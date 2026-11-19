// Минимальный Service Worker для избежания ошибок 404
const CACHE_NAME = 'sgtin-scanner-v1';

self.addEventListener('install', (event) => {
    console.log('Service Worker installed');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker activated');
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    // Простой прокси без кэширования пока
    event.respondWith(fetch(event.request));
});
