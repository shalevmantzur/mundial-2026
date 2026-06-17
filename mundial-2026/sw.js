/* Service Worker — ניחוש מונדיאל 2026
   אסטרטגיה: network-first עבור קבצי האפליקציה (תמיד מקבלים גרסה עדכנית),
   עם נפילה ל-cache כשאין רשת. */
const CACHE = 'mundial-v6';
const ASSETS = ['./','./index.html','./app.js','./config.js','./data.js','./manifest.json'];

self.addEventListener('install', e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS).catch(()=>{})));
});

self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>
    Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e=>{
  const url = new URL(e.request.url);
  // בקשות לשרת (Supabase / API) — תמיד מהרשת, בלי cache
  if(url.origin !== location.origin){ return; }
  e.respondWith(
    fetch(e.request).then(res=>{
      const copy = res.clone();
      caches.open(CACHE).then(c=>c.put(e.request, copy).catch(()=>{}));
      return res;
    }).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html')))
  );
});
