const CACHE='ludia-nail-v2.8.0';
const CORE=['./','index.html','styles.css','salon-cloud.js','app.js','checkout-ui.js','checkout-ui.css','sales-ui.js','sales-ui.css','membership-ui.js','membership-ui.css','manifest.webmanifest'];
const ASSETS=['assets/icon-192.png','assets/icon-512.png','assets/nail_1.jpg','assets/nail_2.jpg','assets/nail_3.jpg','assets/nail_4.jpg','assets/nail_5.jpg'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll([...CORE,...ASSETS])))});
self.addEventListener('activate',e=>e.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(k=>(k.startsWith('ludia-art-')||k.startsWith('ludia-nail-'))&&k!==CACHE).map(k=>caches.delete(k))))])));
async function appShell(request){
 try{
  const res=await fetch(request),type=res.headers.get('content-type')||'';
  if(!type.includes('text/html')){const clone=res.clone();caches.open(CACHE).then(c=>c.put(request,clone)).catch(()=>{});return res}
  let html=await res.text();
  if(!html.includes('checkout-ui.css'))html=html.replace('</head>','  <link rel="stylesheet" href="checkout-ui.css" />\n</head>');
  if(!html.includes('sales-ui.css'))html=html.replace('</head>','  <link rel="stylesheet" href="sales-ui.css" />\n</head>');
  if(!html.includes('membership-ui.css'))html=html.replace('</head>','  <link rel="stylesheet" href="membership-ui.css" />\n</head>');
  if(!html.includes('checkout-ui.js'))html=html.replace('<script src="app.js"></script>','<script src="app.js"></script>\n  <script src="checkout-ui.js"></script>');
  if(!html.includes('sales-ui.js'))html=html.replace('</body>','  <script src="sales-ui.js"></script>\n</body>');
  if(!html.includes('membership-ui.js'))html=html.replace('</body>','  <script src="membership-ui.js"></script>\n</body>');
  const headers=new Headers(res.headers);headers.delete('content-length');headers.delete('content-encoding');
  const out=new Response(html,{status:res.status,statusText:res.statusText,headers});
  caches.open(CACHE).then(c=>c.put(request,out.clone())).catch(()=>{});return out
 }catch(error){return caches.match(request).then(r=>r||caches.match('index.html'))}
}
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET')return;
 const url=new URL(e.request.url),isHtml=e.request.mode==='navigate'||url.pathname.endsWith('/')||url.pathname.endsWith('/index.html');
 if(isHtml){e.respondWith(appShell(e.request));return}
 const isCore=CORE.some(x=>url.pathname.endsWith(x.replace('./','')));
 if(isCore){e.respondWith(fetch(e.request).then(res=>{const clone=res.clone();caches.open(CACHE).then(c=>c.put(e.request,clone)).catch(()=>{});return res}).catch(()=>caches.match(e.request)))}
 else{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{const clone=res.clone();caches.open(CACHE).then(c=>c.put(e.request,clone)).catch(()=>{});return res})))}
});
