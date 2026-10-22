#!/usr/bin/env node
// Muro de fotos en vivo - sin dependencias, sin cuentas. Solo Node.js 16+
// Uso:  node muro.js        (puerto 3000)   |   PORT=8080 node muro.js
// Para internet: PUBLIC_URL=https://tu-tunel.ejemplo.com node muro.js
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const DIR = path.join(__dirname, 'fotos');
const MAX_BYTES = 15 * 1024 * 1024;
fs.mkdirSync(DIR, { recursive: true });

function lanIP() {
  for (const list of Object.values(os.networkInterfaces()))
    for (const i of list || []) if (i.family === 'IPv4' && !i.internal) return i.address;
  return 'localhost';
}
const BASE = (process.env.PUBLIC_URL || 'http://' + lanIP() + ':' + PORT).replace(/\/$/, '');

const clients = new Set();
const listFotos = () => fs.readdirSync(DIR).filter(f => /\.jpg$/.test(f)).sort().reverse().slice(0, 60);

const STYLE = `
*{box-sizing:border-box}body{margin:0;font:16px/1.4 system-ui,sans-serif;background:#141413;color:#f1f1ec}
h1{margin:0 0 .3rem;font-size:1.5rem}p{color:#a3a39b}
button,.btn{background:#ff8a4c;color:#1a1a18;border:0;border-radius:12px;padding:.9rem 1.4rem;font-size:1.05rem;font-weight:700;cursor:pointer;display:inline-block}
button:disabled{opacity:.5}`;

const UPLOAD_HTML = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Subí tu foto</title>
<style>${STYLE}.w{max-width:520px;margin:0 auto;padding:1.5rem 1.25rem}#p{max-width:100%;border-radius:12px;margin:1rem 0;display:none}</style></head><body>
<div class="w"><h1>📸 Subí tu foto al muro</h1><p>Sacá una foto o elegí una de tu galería.</p>
<label class="btn" for="f">Elegir / sacar foto</label><input id="f" type="file" accept="image/*" hidden>
<img id="p" alt=""><div><button id="s" style="display:none">Enviar al muro</button></div><p id="m"></p></div>
<script>
var blob=null,$=function(i){return document.getElementById(i)};
$('f').onchange=function(e){var file=e.target.files[0];if(!file)return;$('m').textContent='Procesando…';
 var im=new Image(),u=URL.createObjectURL(file);
 im.onload=function(){var s=Math.min(1,1600/Math.max(im.width,im.height)),c=document.createElement('canvas');
  c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);c.getContext('2d').drawImage(im,0,0,c.width,c.height);
  c.toBlob(function(b){blob=b;$('p').src=URL.createObjectURL(b);$('p').style.display='block';$('s').style.display='inline-block';$('m').textContent='';},'image/jpeg',.85);};
 im.onerror=function(){$('m').textContent='No pude leer esa imagen.'};im.src=u;};
$('s').onclick=function(){if(!blob)return;$('s').disabled=true;$('m').textContent='Enviando…';
 fetch('/upload',{method:'POST',headers:{'Content-Type':'image/jpeg'},body:blob}).then(function(r){
  if(!r.ok)throw 0;$('m').textContent='¡Listo! Mirá la pantalla 🎉';$('p').style.display='none';$('s').style.display='none';$('f').value='';blob=null;
 }).catch(function(){$('m').textContent='No se pudo enviar, probá de nuevo.'}).then(function(){$('s').disabled=false});};
</script></body></html>`;

const WALL_HTML = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Muro en vivo</title>
<style>${STYLE}
.w{padding:1rem}.top{display:flex;align-items:center;gap:1rem;margin-bottom:1rem}.top h1{flex:1;font-size:2rem}
#q{background:#fff;padding:8px;border-radius:12px;text-align:center;color:#000;font-size:.7rem;max-width:170px;word-break:break-all}
#g{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
#g figure{margin:0;border-radius:12px;overflow:hidden;aspect-ratio:1;animation:pop .7s}
#g figure.n{outline:4px solid #ff8a4c}#g img{width:100%;height:100%;object-fit:cover;display:block}
#b{position:fixed;inset:0;background:rgba(0,0,0,.9);display:none;align-items:center;justify-content:center;z-index:5}
#b img{max-width:92vw;max-height:92vh;border-radius:12px;animation:pop .5s}
@keyframes pop{from{transform:scale(.6);opacity:0}to{transform:scale(1);opacity:1}}</style></head><body>
<div class="w"><div class="top"><h1>Muro de fotos en vivo</h1><div id="q"></div></div><div id="g"></div></div>
<div id="b"><img alt=""></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<script>
var g=document.getElementById('g'),b=document.getElementById('b'),seen={};
function fig(n,nuevo){var f=document.createElement('figure');if(nuevo){f.className='n';setTimeout(function(){f.className=''},8000)}
 var i=document.createElement('img');i.src='/fotos/'+n;f.appendChild(i);return f}
function add(n,nuevo){if(seen[n])return;seen[n]=1;g.insertBefore(fig(n,nuevo),g.firstChild);
 if(nuevo){b.querySelector('img').src='/fotos/'+n;b.style.display='flex';clearTimeout(add.t);add.t=setTimeout(function(){b.style.display='none'},5000);}
 while(g.children.length>60)g.removeChild(g.lastChild)}
fetch('/api/list').then(function(r){return r.json()}).then(function(l){l.reverse().forEach(function(n){add(n,false)})});
new EventSource('/events').onmessage=function(e){add(e.data,true)};
fetch('/api/info').then(function(r){return r.json()}).then(function(d){var q=document.getElementById('q');
 try{new QRCode(q,{text:d.url,width:150,height:150})}catch(e){}
 var s=document.createElement('div');s.textContent=d.url;q.appendChild(s)});
</script></body></html>`;

function send(res, code, type, body) { res.writeHead(code, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff' }); res.end(body); }

http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  if (req.method === 'GET' && url === '/') return send(res, 200, 'text/html; charset=utf-8', UPLOAD_HTML);
  if (req.method === 'GET' && url === '/wall') return send(res, 200, 'text/html; charset=utf-8', WALL_HTML);
  if (req.method === 'GET' && url === '/api/info') {
    // Si no hay PUBLIC_URL, se deduce de la dirección con la que entraron (funciona en Render, Railway, etc.)
    const proto = (req.headers['x-forwarded-proto'] || 'http').split(',')[0];
    const auto = process.env.PUBLIC_URL ? BASE : (req.headers.host && !/^(localhost|127\.)/.test(req.headers.host) ? proto + '://' + req.headers.host : BASE);
    return send(res, 200, 'application/json', JSON.stringify({ url: auto.replace(/\/$/, '') + '/' }));
  }
  if (req.method === 'GET' && url === '/api/list') return send(res, 200, 'application/json', JSON.stringify(listFotos()));

  if (req.method === 'GET' && url === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(': ok\n\n'); clients.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 20000);
    req.on('close', () => { clearInterval(ping); clients.delete(res); });
    return;
  }

  if (req.method === 'GET' && url.startsWith('/fotos/')) {
    const name = decodeURIComponent(url.slice(7));
    if (!/^[\w.-]+\.jpg$/.test(name)) return send(res, 404, 'text/plain', 'No encontrado');
    const file = path.join(DIR, name);
    if (!fs.existsSync(file)) return send(res, 404, 'text/plain', 'No encontrado');
    res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' });
    return fs.createReadStream(file).pipe(res);
  }

  if (req.method === 'POST' && url === '/upload') {
    const chunks = []; let size = 0, abort = false;
    req.on('data', c => {
      size += c.length;
      if (size > MAX_BYTES) { abort = true; send(res, 413, 'text/plain', 'Muy grande'); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (abort) return;
      const buf = Buffer.concat(chunks);
      if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) return send(res, 400, 'text/plain', 'Solo JPEG');
      const name = Date.now() + '-' + crypto.randomBytes(3).toString('hex') + '.jpg';
      fs.writeFile(path.join(DIR, name), buf, err => {
        if (err) return send(res, 500, 'text/plain', 'Error');
        for (const c of clients) c.write('data: ' + name + '\n\n');
        send(res, 200, 'text/plain', 'ok');
      });
    });
    return;
  }
  send(res, 404, 'text/plain', 'No encontrado');
}).listen(PORT, '0.0.0.0', () => {
  console.log('\n  Muro de fotos en marcha\n');
  console.log('  Pantalla / proyector:  http://localhost:' + PORT + '/wall');
  console.log('  Link para el QR:       ' + BASE + '/\n');
  console.log('  Las fotos se guardan en: ' + DIR + '\n');
});
