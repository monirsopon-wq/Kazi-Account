/* ═══════════════════════════════════════════════════════════
   SERVICE WORKER — Account Tracker PWA
   Version: 1.0
   Purpose: Offline cache, install support, auto-update
   ═══════════════════════════════════════════════════════════ */

const CACHE_VERSION = 'account-tracker-v1';
const RUNTIME_CACHE = 'account-tracker-runtime-v1';

/* ───────────────────────────────────────────────
   যে ফাইলগুলো App Shell (প্রথমবারেই দরকার)
   ─────────────────────────────────────────────── */
const APP_SHELL = [
  './',
  './index.html',
  './Kazi account.html',
  'https://fonts.googleapis.com/css2?family=Baloo+Da+2:wght@600;700;800&family=Noto+Sans+Bengali:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

/* ───────────────────────────────────────────────
   INSTALL — App Shell cache
   ─────────────────────────────────────────────── */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing…');
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => {
        // ignoreErrors দিয়ে try করি, কোনো URL miss হলে পুরো install fail করবে না
        return Promise.allSettled(
          APP_SHELL.map(url =>
            cache.add(url).catch(err => console.warn('[SW] Skipped:', url, err.message))
          )
        );
      })
      .then(() => {
        console.log('[SW] Install complete — skipWaiting');
        return self.skipWaiting();
      })
  );
});

/* ───────────────────────────────────────────────
   ACTIVATE — পুরনো cache মুছে ফেলা
   ─────────────────────────────────────────────── */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating…');
  event.waitUntil(
    caches.keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter(key => key !== CACHE_VERSION && key !== RUNTIME_CACHE)
            .map(key => {
              console.log('[SW] Deleting old cache:', key);
              return caches.delete(key);
            })
        );
      })
      .then(() => {
        console.log('[SW] Activate complete — clients.claim');
        return self.clients.claim();
      })
  );
});

/* ───────────────────────────────────────────────
   FETCH — network first, cache fallback
   ─────────────────────────────────────────────── */
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // শুধু GET request handle করি
  if (req.method !== 'GET') return;

  // Chrome extension বা dev tools request skip করি
  if (!req.url.startsWith('http')) return;

  // Firebase API call (Firestore / Auth write) — cache করা যাবে না
  if (req.url.includes('/google.firestore') ||
      req.url.includes('firestore.googleapis.com') ||
      req.url.includes('identitytoolkit') ||
      req.url.includes('securetoken.googleapis.com')) {
    return; // সরাসরি network-এ যাবে
  }

  event.respondWith(
    (async () => {
      const url = new URL(req.url);
      const isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
      const isExternal = url.origin !== self.location.origin;

      try {
        // ── HTML navigate: network first (নতুন version পেতে) ──
        if (isHTML) {
          try {
            const fresh = await fetch(req);
            const cache = await caches.open(CACHE_VERSION);
            cache.put(req, fresh.clone()).catch(() => {});
            return fresh;
          } catch (err) {
            const cached = await caches.match(req);
            if (cached) return cached;
            const fallback = await caches.match('./') || await caches.match('./index.html') || await caches.match('./Kazi account.html');
            if (fallback) return fallback;
            throw err;
          }
        }

        // ── External CDN (fonts, libs): cache first ──
        if (isExternal) {
          const cached = await caches.match(req);
          if (cached) return cached;
          const fresh = await fetch(req);
          if (fresh && fresh.status === 200) {
            const cache = await caches.open(RUNTIME_CACHE);
            cache.put(req, fresh.clone()).catch(() => {});
          }
          return fresh;
        }

        // ── Same-origin assets: cache first ──
        const cached = await caches.match(req);
        if (cached) {
          // background-এ fresh copy আনি (stale-while-revalidate)
          fetch(req).then(fresh => {
            if (fresh && fresh.status === 200) {
              caches.open(CACHE_VERSION).then(c => c.put(req, fresh.clone())).catch(() => {});
            }
          }).catch(() => {});
          return cached;
        }

        const fresh = await fetch(req);
        if (fresh && fresh.status === 200) {
          const cache = await caches.open(CACHE_VERSION);
          cache.put(req, fresh.clone()).catch(() => {});
        }
        return fresh;

      } catch (err) {
        console.error('[SW] Fetch failed:', req.url, err);

        // HTML request হলে offline page
        if (isHTML) {
          const fallback = await caches.match('./') || await caches.match('./index.html') || await caches.match('./Kazi account.html');
          if (fallback) return fallback;
        }

        // অন্যথায় empty response
        return new Response('Offline', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'text/plain' })
        });
      }
    })()
  );
});

/* ───────────────────────────────────────────────
   MESSAGE — app থেকে manual control
   ─────────────────────────────────────────────── */
self.addEventListener('message', (event) => {
  const data = event.data || {};

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
        .then(() => {
          if (event.source) event.source.postMessage({ type: 'CACHE_CLEARED' });
        })
    );
  }

  if (data.type === 'GET_VERSION') {
    if (event.source) event.source.postMessage({ type: 'VERSION', version: CACHE_VERSION });
  }
});

/* ───────────────────────────────────────────────
   PUSH NOTIFICATION (optional, ভবিষ্যতে কাজে লাগবে)
   ─────────────────────────────────────────────── */
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || 'Account Tracker', {
        body: data.body || '',
        icon: data.icon || undefined,
        badge: data.badge || undefined,
        tag: data.tag || 'at-notification'
      })
    );
  } catch (e) { /* ignore */ }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('./');
    })
  );
});

console.log('[SW] Loaded — ' + CACHE_VERSION);