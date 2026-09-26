const CACHE='ludia-nail-v2.54.2';
const ASSETS=['assets/icon-192.png','assets/icon-512.png','assets/nail_1.jpg','assets/nail_2.jpg','assets/nail_3.jpg','assets/nail_4.jpg','assets/nail_5.jpg'];
self.addEventListener('install',event=>{self.skipWaiting();event.waitUntil(caches.open(CACHE).then(cache=>Promise.allSettled(ASSETS.map(path=>cache.add(path)))))});
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>(key.startsWith('ludia-art-')||key.startsWith('ludia-nail-'))&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 // APIs can contain authenticated salon data; never intercept or store those responses.
 if(request.method!=='GET'||url.origin!==location.origin||url.pathname.startsWith('/api/')||request.headers.has('authorization'))return;
 const navigation=request.mode==='navigate',staticAsset=/\.(js|css|webmanifest|png|jpe?g|webp|svg)$/.test(url.pathname);
 if(!navigation&&!staticAsset)return;
 event.respondWith(fetch(request,{cache:navigation||/\.(js|css)$/.test(url.pathname)?'no-cache':'default'}).then(response=>{
  if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(navigation?'index.html':request,copy)))}
  return response;
 }).catch(async()=>await caches.match(navigation?'index.html':request)||new Response('인터넷 연결을 확인해 주세요.',{status:503,headers:{'content-type':'text/plain; charset=utf-8'}})));
});
