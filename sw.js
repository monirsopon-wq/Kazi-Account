// sw.js
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  // ডেক্সটপ Chrome-এ PWA ইনস্টল করার জন্য এই fetch ইভেন্টটি বাধ্যতামূলক
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});