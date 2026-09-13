/* tifinagh converter — service worker
   v5: الصفحة تُجلب من الشبكة أولاً حتى يظهر أي تحديث فوراً،
   والبقية من الذاكرة أولاً لتبقى سريعة وتعمل دون إنترنت.
   أُصلح هنا خطأ "Response served by service worker has redirections":
   بعض الخوادم تردّ على /index.html بتحويل إلى / ، والمتصفّح يرفض
   استخدام ردّ محوَّل لفتح صفحة، لذا تُعاد صياغة الردّ قبل تخزينه. */
const CACHE = 'tifinagh-v5';
const SHELL = './index.html';
const CORE = ['./', './manifest.webmanifest',
              './icon-192.png', './icon-512.png', './icon-maskable-512.png',
              './apple-touch-icon.png', './favicon-64.png'];

function plain(body, source){
  const headers = new Headers();
  const type = source.headers.get('content-type');
  if (type) headers.set('content-type', type);
  return new Response(body, { status: 200, statusText: 'OK', headers });
}

async function putShell(res){
  if (!res || !res.ok) return;
  const cache = await caches.open(CACHE);
  await cache.put(SHELL, plain(await res.clone().blob(), res));
}

async function readShell(){
  const hit = await caches.match(SHELL);
  if (!hit) return null;
  return hit.redirected ? plain(await hit.blob(), hit) : hit;
}

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(CORE))
      .then(() => fetch(SHELL, { cache: 'reload' }))
      .then(putShell)
      .then(() => self.skipWaiting())
  );
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
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        putShell(res).catch(() => {});
        return res;
      } catch {
        const shell = await readShell();
        if (shell) return shell;
        return new Response('تعذّر الاتصال، ولا توجد نسخة محفوظة بعد.', {
          status: 503,
          headers: { 'content-type': 'text/plain; charset=utf-8' }
        });
      }
    })());
    return;
  }

  // باقي الملفات: الذاكرة أولاً
  e.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic'){
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    } catch {
      return new Response('', { status: 504, statusText: 'Gateway Timeout' });
    }
  })());
});