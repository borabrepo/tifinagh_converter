/* tifinagh converter — service worker
   v2: الصفحة تُجلب من الشبكة أولاً حتى يظهر أي تحديث فوراً،
   والبقية من الذاكرة أولاً لتبقى سريعة وتعمل دون إنترنت. */
const CACHE = 'tifinagh-v4';
const CORE = ['./', './index.html', './manifest.webmanifest',
              './icon-192.png', './icon-512.png', './icon-maskable-512.png',
              './apple-touch-icon.png', './favicon-64.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const isPage = req.mode === 'navigate' || req.destination === 'document' ||
                 new URL(req.url).pathname.endsWith('.html');

  if (isPage){
    // الشبكة أولاً: أي نسخة جديدة تظهر مباشرة
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{});
        return res;
      }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  // باقي الملفات: الذاكرة أولاً
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{});
      return res;
    }).catch(() => hit))
  );
});
