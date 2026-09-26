const CACHE = "account-tracker-pwa-v3";
const DEFAULT_NAME = "Account Tracker";
const SHELL = [
  "./",
  "./index.html",
  "./dynamic-manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

function dataUrlToResponse(dataUrl){
  const m = String(dataUrl||"").match(/^data:([^;,]+)(?:;base64)?,(.*)$/s);
  if(!m) return null;
  const mime = m[1] || "application/octet-stream";
  const body = m[2] || "";
  let bytes;
  if (String(dataUrl).includes(";base64")) {
    const bin = atob(body);
    bytes = new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  } else {
    bytes = new TextEncoder().encode(decodeURIComponent(body));
  }
  return new Response(bytes,{headers:{"Content-Type":mime,"Cache-Control":"no-cache"}});
}

async function putCompanyAssets(name,icon192,icon512){
  const cache = await caches.open(CACHE);

  const r192=dataUrlToResponse(icon192);
  const r512=dataUrlToResponse(icon512);
  if(r192) await cache.put("./company-icon-192.png",r192);
  if(r512) await cache.put("./company-icon-512.png",r512);

  const manifest={
    name: name || DEFAULT_NAME,
    short_name: name || DEFAULT_NAME,
    start_url: "./",
    scope: "./",
    display: "standalone",
    orientation: "portrait",
    background_color: "#12213f",
    theme_color: "#12213f",
    description: "Accounts & Project Tracker",
    icons: [
      {src:"./company-icon-192.png",sizes:"192x192",type:"image/png",purpose:"any maskable"},
      {src:"./company-icon-512.png",sizes:"512x512",type:"image/png",purpose:"any maskable"}
    ]
  };
  await cache.put("./dynamic-manifest.json",new Response(JSON.stringify(manifest),{
    headers:{"Content-Type":"application/manifest+json","Cache-Control":"no-cache"}
  }));
}

self.addEventListener("install",event=>{
  event.waitUntil(
    caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())
  );
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))
    )).then(()=>self.clients.claim())
  );
});

self.addEventListener("message",event=>{
  if(!event.data || event.data.type!=="company-pwa-update") return;
  event.waitUntil(putCompanyAssets(event.data.name,event.data.icon192,event.data.icon512));
});

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET") return;
  const url=new URL(event.request.url);

  // Always serve the current cached dynamic manifest regardless of cache-busting query.
  if(url.pathname.endsWith("/dynamic-manifest.json")){
    event.respondWith(
      caches.match("./dynamic-manifest.json").then(r=>r || fetch(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached=>{
      if(cached) return cached;
      return fetch(event.request).then(response=>{
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{});
        return response;
      }).catch(()=>caches.match("./index.html"));
    })
  );
});
