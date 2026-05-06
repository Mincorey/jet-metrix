// Простейший Service Worker для прохождения проверок PWA
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  // Ничего не перехватываем, просто пропускаем запросы сети
});