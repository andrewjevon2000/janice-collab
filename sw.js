/* Service worker. Data collab & resep disimpan di localStorage + Supabase, bukan di cache.
   - Halaman (index.html): network-first, jadi versi baru langsung tampil saat online;
     kalau offline pakai salinan cache.
   - Aset lain (ikon, manifest): cache-first.
   - Install selalu ambil file segar dari server (cache:'reload'), supaya cache versi baru
     tidak terisi file lama dari HTTP cache browser. */
const CACHE = 'janice-collab-v13';
const ASSETS = ['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c =>
    Promise.all(ASSETS.map(u => fetch(new Request(u, {cache:'reload'}))
      .then(res => { if (res.ok) return c.put(u, res); })
      .catch(()=>{})))
  ));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Jangan cache panggilan ke Supabase / CDN dinamis, selalu ke jaringan.
  if (url.hostname.includes('supabase') || url.hostname.includes('jsdelivr')) return;
  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html');
  if (isPage) {
    e.respondWith(
      fetch(req, {cache:'no-cache'}).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)).catch(()=>{}); }
        return res;
      }).catch(() => caches.match('./index.html').then(hit => hit || caches.match('./')))
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{}); }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
