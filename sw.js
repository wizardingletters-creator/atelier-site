// Atelier offline helper. Tries the internet first for up to 1.5 seconds, so updates show straight away;
// on slow signal or offline it opens the last saved copy instantly.
const C='atelier-39f04745e6';
const SHELL=['/','/manifest.webmanifest','/icons/icon-180.png','/icons/icon-192.png','/icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url);
  const lib=u.hostname==='cdn.jsdelivr.net'&&u.pathname.indexOf('/npm/@supabase/')===0;
  if(r.method!=='GET'||(u.origin!==location.origin&&!lib))return;
  const key=r.mode==='navigate'?'/':r;
  const net=fetch(r.mode==='navigate'?new Request(r.url,{cache:'no-cache',credentials:'same-origin'}):r).then(res=>{if(res.ok||(lib&&res.type==='opaque')){const cp=res.clone();e.waitUntil(caches.open(C).then(c=>c.put(key,cp)));}return res;});
  // the supabase library never changes at a fixed version, so the saved copy is used straight away
  if(lib){e.respondWith(caches.match(r).then(m=>m||net));return;}
  // fast open: wait up to 1.5s for the internet (so new versions show straight away on good signal),
  // otherwise open the saved copy at once and save the newer one for next time
  if(r.mode==='navigate'){e.respondWith(caches.match('/').then(m=>{if(!m)return net.catch(()=>caches.match('/'));
    return Promise.race([net.then(res=>res.ok?res:m,()=>m),new Promise(ok=>setTimeout(()=>ok(m),1500))]);}));return;}
  e.respondWith(net.catch(()=>caches.match(key).then(m=>m||caches.match('/'))));});
// urgent pings from Atelier's pinger
const report=m=>self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>cs.forEach(c=>c.postMessage({pushDiag:m,v:C})));
self.addEventListener('push',e=>{let d={};try{d=e.data?e.data.json():{};}catch(x){d={title:'Atelier',body:e.data?e.data.text():''};}
  const show=self.registration.showNotification(d.title||'Atelier ✿',{body:d.body||'',tag:d.tag||'atelier',renotify:true,icon:'/icons/icon-192.png',badge:'/icons/badge-96.png',data:{url:d.url||'/',slip:d.slip,title:d.title,body:d.body},actions:d.slip?(d.done?[{action:'done',title:'✓ Done'}]:[]).concat([{action:'snooze',title:'⏰ Snooze 1 hour'}]):[]})
    .then(()=>report('received and shown'),err=>report('received but could not show: '+(err&&err.message||err)));
  e.waitUntil(show);});
self.addEventListener('message',e=>{if(e.data==='version')e.source&&e.source.postMessage({swVersion:C});});
const PUSH_FN='https://jzpfsnwqfqcuqmxpufwq.supabase.co/functions/v1/push';
self.addEventListener('notificationclick',e=>{e.notification.close();const nd=e.notification.data||{},u=nd.url||'/';
  const openApp=()=>clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{for(const c of cs){if('focus' in c)return c.focus();}return clients.openWindow(u);});
  if((e.action==='done'||e.action==='snooze')&&nd.slip){
    e.waitUntil(fetch(PUSH_FN,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({act:e.action,slip:nd.slip,title:nd.title,text:nd.body})})
      .then(r=>r.ok?r.json():Promise.reject(r.status)).then(j=>{if(!j.ok)return openApp();report(e.action==='done'?'ticked from notification':'snoozed 1 hour');
        return self.clients.matchAll({type:'window'}).then(cs=>cs.forEach(c=>c.postMessage({pushDone:1})));})
      .catch(openApp));
    return;}
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{for(const c of cs){if('focus' in c)return c.focus();}return clients.openWindow(u);}));});
