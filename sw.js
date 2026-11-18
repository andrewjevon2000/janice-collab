/* Service worker. Data collab & resep disimpan di localStorage + Supabase, bukan di cache.
   - Halaman (index.html): network-first, jadi versi baru langsung tampil saat online;
     kalau offline pakai salinan cache.
   - Aset lain (ikon, manifest): cache-first.
   - Install selalu ambil file segar dari server (cache:'reload'), supaya cache versi baru
     tidak terisi file lama dari HTTP cache browser. */
const CACHE = 'janice-collab-v15';
// Foto resep (Supabase Storage) disimpan di cache terpisah supaya tetap tampil saat offline
// dan tidak ikut terhapus saat versi app naik.
const FOTO_CACHE = 'janice-foto';
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
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE && k!==FOTO_CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Foto resep: cache-first (nama file selalu unik, jadi isinya tidak pernah berubah)
  if (url.pathname.includes('/storage/v1/object/public/resep-foto/')) {
    e.respondWith(caches.open(FOTO_CACHE).then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) c.put(req, res.clone()).catch(()=>{});
      return res;
    }))));
    return;
  }
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

/* Notifikasi H-1: dikirim fungsi Supabase `notify-h1` (lihat PANDUAN.md langkah 4).
   Isi push berupa JSON {title, body, url, tag}. */
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Jadwal besok', {
    body: d.body || 'Buka app untuk melihat jadwal',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: d.tag || 'janice-h1',
    data: { url: d.url || './index.html#jadwal' }
  }));
});
/* Tap notifikasi: fokus ke app yang sudah terbuka, atau buka app di tab Jadwal */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './index.html#jadwal', self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) {
      if (c.url.startsWith(self.registration.scope) && 'focus' in c) {
        return ('navigate' in c ? c.navigate(url) : Promise.resolve(c)).then(w => (w || c).focus());
      }
    }
    return clients.openWindow(url);
  }));
});
