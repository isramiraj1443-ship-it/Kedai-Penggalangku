/* ============================================================
   sw.js — Service Worker: aplikasi tetap terbuka tanpa internet
   Strategi: app-shell cache-first; API selalu lewat jaringan.
   ============================================================ */

const CACHE = 'kedai-penggalangku-v1';
const ASSETS = [
  './',
  './index.html',
  './css/app.css',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/util.js',
  './js/charts.js',
  './js/logic.js',
  './js/demo.js',
  './js/api.js',
  './js/pages-dashboard.js',
  './js/pages-kasir.js',
  './js/pages-data.js',
  './js/pages-laporan.js',
  './js/pages-settings.js',
  './js/app.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(ASSETS.map(a => c.add(a))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                 // POST API → selalu jaringan
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;       // API spreadsheet → selalu jaringan

  if (req.mode === 'navigate') {
    // halaman: coba jaringan dulu (agar update cepat), jatuh ke cache saat offline
    e.respondWith(
      fetch(req)
        .then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', cp)); return res; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // aset statis: cache-first
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      const cp = res.clone();
      caches.open(CACHE).then(c => c.put(req, cp));
      return res;
    }))
  );
});
