/* ═══════════════════════════════════════════════════════════════
   Account Tracker — Service Worker
   ═══════════════════════════════════════════════════════════════ */

const CACHE_NAME = 'kazi-account-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install Event
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Fetch Event - ডেক্সটপ Chrome-এ PWA ইনস্টল করার জন্য এটি বাধ্যতামূলক
self.addEventListener('fetch', (event) => {
  // Firebase API কলগুলো নেটওয়ার্কে যেতে দিন, ক্যাশ করবেন না
  if (
    event.request.method !== 'GET' || 
    event.request.url.includes('firestore.googleapis.com') || 
    event.request.url.includes('identitytoolkit.googleapis.com') ||
    event.request.url.includes('securetoken.googleapis.com')
  ) {
    return; 
  }

  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});