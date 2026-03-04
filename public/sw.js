
const CACHE_NAME="maxhelp-v1";
const STATIC_ASSETS=["/manifest.webmanifest","/assets/css/style.css"];

self.addEventListener("install",(e)=>{
 e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(STATIC_ASSETS)));
 self.skipWaiting();
});

self.addEventListener("activate",(e)=>{
 e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>k!==CACHE_NAME?caches.delete(k):null))));
 self.clients.claim();
});

self.addEventListener("fetch",(e)=>{
 const req=e.request;
 const url=new URL(req.url);
 if(url.pathname.startsWith("/api/")) return;

 e.respondWith(
  caches.match(req).then(cached=>cached||fetch(req).then(res=>{
    const copy=res.clone();
    caches.open(CACHE_NAME).then(c=>c.put(req,copy));
    return res;
  }))
 );
});
