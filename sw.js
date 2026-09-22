const CACHE='ludia-nail-v1.9';
const ASSETS=['./','index.html','styles.css','app.js','manifest.webmanifest','assets/icon-192.png','assets/icon-512.png','assets/nail_1.jpg','assets/nail_2.jpg','assets/nail_3.jpg','assets/nail_4.jpg','assets/nail_5.jpg'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>e.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(k=>(k.startsWith('ludia-art-')||k.startsWith('ludia-nail-'))&&k!==CACHE).map(k=>caches.delete(k))))])));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{const clone=res.clone();caches.open(CACHE).then(c=>c.put(e.request,clone)).catch(()=>{});return res}).catch(()=>caches.match('index.html'))))});
