#!/usr/bin/env node
// Muro de fotos en vivo - sin dependencias, sin cuentas. Solo Node.js 16+
// Uso:  node muro.js        (puerto 3000)   |   PORT=8080 node muro.js
// Páginas:  /  (subir foto)   /wall  (muro para proyectar)   /qr  (QR grande)
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
const cleanName = s => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 30);
function nombreDe(f) { try { return fs.readFileSync(path.join(DIR, f.replace(/\.jpg$/, '.txt')), 'utf8'); } catch (e) { return ''; } }
const listFotos = () => fs.readdirSync(DIR).filter(f => /\.jpg$/.test(f)).sort().reverse().slice(0, 60).map(f => ({ f, n: nombreDe(f) }));

const STYLE = `
*{box-sizing:border-box}body{margin:0;font:16px/1.4 system-ui,sans-serif;background:#141413;color:#f1f1ec}
h1{margin:0 0 .3rem;font-size:1.5rem}p{color:#a3a39b}
button,.btn{background:#ff8a4c;color:#1a1a18;border:0;border-radius:12px;padding:.9rem 1.4rem;font-size:1.05rem;font-weight:700;cursor:pointer;display:inline-block;text-align:center}
button:disabled{opacity:.4}.btn.sec{background:#33332f;color:#f1f1ec}`;

const UPLOAD_HTML = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Subí tu foto</title>
<style>${STYLE}.w{max-width:520px;margin:0 auto;padding:1.5rem 1.25rem}
input[type=text]{width:100%;padding:.9rem;border:1px solid #444;border-radius:12px;background:#1f1f1d;color:#f1f1ec;font-size:1.1rem;margin:.3rem 0 1rem}
.row{display:flex;gap:.6rem;flex-wrap:wrap}.row .btn{flex:1;min-width:140px}
#p{max-width:100%;border-radius:12px;margin:1rem 0;display:none}</style></head><body>
<div class="w"><h1>📸 Subí tu foto al muro</h1><p>Poné tu nombre y sacá una foto.</p>
<label for="n"><b>Tu nombre</b></label>
<input id="n" type="text" maxlength="30" placeholder="Ej: María" autocomplete="given-name">
<div class="row">
 <label class="btn" for="fc">📷 Sacar foto</label>
 <label class="btn sec" for="fg">🖼️ Galería</label>
</div>
<input id="fc" type="file" accept="image/*" capture="environment" hidden>
<input id="fg" type="file" accept="image/*" hidden>
<img id="p" alt=""><div><button id="s" style="display:none">Enviar al muro</button></div><p id="m"></p></div>
<script>
var blob=null,$=function(i){return document.getElementById(i)};
try{$('n').value=localStorage.getItem('muro-nombre')||''}catch(e){}
function check(){$('s').disabled=!(blob&&$('n').value.trim())}
$('n').oninput=function(){try{localStorage.setItem('muro-nombre',$('n').value)}catch(e){}check()};
function leer(e){var file=e.target.files[0];if(!file)return;$('m').textContent='Procesando…';
 var im=new Image(),u=URL.createObjectURL(file);
 im.onload=function(){var s=Math.min(1,1600/Math.max(im.width,im.height)),c=document.createElement('canvas');
  c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);c.getContext('2d').drawImage(im,0,0,c.width,c.height);
  c.toBlob(function(b){blob=b;$('p').src=URL.createObjectURL(b);$('p').style.display='block';$('s').style.display='inline-block';
   $('m').textContent=$('n').value.trim()?'':'Escribí tu nombre para poder enviar.';check();},'image/jpeg',.85);};
 im.onerror=function(){$('m').textContent='No pude leer esa imagen.'};im.src=u;}
$('fc').onchange=leer;$('fg').onchange=leer;
$('s').onclick=function(){var nom=$('n').value.trim();if(!blob||!nom)return;$('s').disabled=true;$('m').textContent='Enviando…';
 fetch('/upload',{method:'POST',headers:{'Content-Type':'image/jpeg','X-Nombre':encodeURIComponent(nom)},body:blob}).then(function(r){
  if(!r.ok)throw 0;$('m').textContent='¡Listo, '+nom+'! Mirá la pantalla 🎉';$('p').style.display='none';$('s').style.display='none';$('fc').value='';$('fg').value='';blob=null;
 }).catch(function(){$('m').textContent='No se pudo enviar, probá de nuevo.';$('s').disabled=false});};
</script></body></html>`;

const WALL_HTML = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Muro en vivo</title>
<style>${STYLE}
.w{padding:1rem}.top{display:flex;align-items:center;gap:1rem;margin-bottom:1rem}.top h1{flex:1;font-size:2rem}
#q{background:#fff;padding:8px;border-radius:12px;text-align:center;color:#000;font-size:.7rem;max-width:170px;word-break:break-all}
#g{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
#g figure{margin:0;border-radius:12px;overflow:hidden;aspect-ratio:1;animation:pop .7s;position:relative}
#g figure.n{outline:4px solid #ff8a4c}#g img{width:100%;height:100%;object-fit:cover;display:block}
figcaption{position:absolute;left:0;right:0;bottom:0;padding:1.2rem .6rem .5rem;background:linear-gradient(transparent,rgba(0,0,0,.75));font-weight:600;font-size:.95rem}
#b{position:fixed;inset:0;background:rgba(0,0,0,.9);display:none;flex-direction:column;align-items:center;justify-content:center;z-index:5}
#b img{max-width:92vw;max-height:84vh;border-radius:12px;animation:pop .5s}#bn{font-size:1.8rem;font-weight:700;margin-top:.8rem}
@keyframes pop{from{transform:scale(.6);opacity:0}to{transform:scale(1);opacity:1}}</style></head><body>
<div class="w"><div class="top"><h1>Muro de fotos en vivo</h1><div id="q"></div></div><div id="g"></div></div>
<div id="b"><img alt=""><div id="bn"></div></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<script>
var g=document.getElementById('g'),b=document.getElementById('b'),seen={};
function fig(o,nuevo){var f=document.createElement('figure');if(nuevo){f.className='n';setTimeout(function(){f.className=''},8000)}
 var i=document.createElement('img');i.src='/fotos/'+o.f;f.appendChild(i);
 if(o.n){var c=document.createElement('figcaption');c.textContent=o.n;f.appendChild(c)}return f}
function add(o,nuevo){if(seen[o.f])return;seen[o.f]=1;g.insertBefore(fig(o,nuevo),g.firstChild);
 if(nuevo){b.querySelector('img').src='/fotos/'+o.f;document.getElementById('bn').textContent=o.n||'';b.style.display='flex';clearTimeout(add.t);add.t=setTimeout(function(){b.style.display='none'},5000);}
 while(g.children.length>60)g.removeChild(g.lastChild)}
fetch('/api/list').then(function(r){return r.json()}).then(function(l){l.reverse().forEach(function(o){add(o,false)})});
new EventSource('/events').onmessage=function(e){try{add(JSON.parse(e.data),true)}catch(x){}};
fetch('/api/info').then(function(r){return r.json()}).then(function(d){var q=document.getElementById('q');
 try{new QRCode(q,{text:d.url,width:150,height:150})}catch(e){}
 var s=document.createElement('div');s.textContent=d.url;q.appendChild(s)});
</script></body></html>`;

const QR_HTML = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>QR del muro</title>
<style>${STYLE}body{display:flex;min-height:100vh;align-items:center;justify-content:center;background:#fff;color:#111;text-align:center}
h1{font-size:2.2rem;margin-bottom:1rem}#q{display:inline-block;padding:16px;background:#fff}#u{margin-top:1rem;color:#555;word-break:break-all}</style></head><body>
<div><h1>📸 Escaneá y subí tu foto</h1><div id="q"></div><div id="u"></div></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<script>
fetch('/api/info').then(function(r){return r.json()}).then(function(d){
 var s=Math.min(480,Math.floor(Math.min(innerWidth,innerHeight)*.6));
 try{new QRCode(document.getElementById('q'),{text:d.url,width:s,height:s})}catch(e){}
 document.getElementById('u').textContent=d.url});
</script></body></html>`;

function send(res, code, type, body) { res.writeHead(code, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff' }); res.end(body); }

http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  if (req.method === 'GET' && url === '/') return send(res, 200, 'text/html; charset=utf-8', UPLOAD_HTML);
  if (req.method === 'GET' && url === '/wall') return send(res, 200, 'text/html; charset=utf-8', WALL_HTML);
  if (req.method === 'GET' && url === '/qr') return send(res, 200, 'text/html; charset=utf-8', QR_HTML);
  if (req.method === 'GET' && url === '/api/info') {
    // Sin PUBLIC_URL, se deduce de la dirección con la que entraron (Render, Railway, etc.)
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
    let nombre = '';
    try { nombre = cleanName(decodeURIComponent(req.headers['x-nombre'] || '')); } catch (e) {}
    if (!nombre) return send(res, 400, 'text/plain', 'Falta el nombre');
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
      const base = Date.now() + '-' + crypto.randomBytes(3).toString('hex');
      const name = base + '.jpg';
      fs.writeFile(path.join(DIR, base + '.txt'), nombre, () => {
        fs.writeFile(path.join(DIR, name), buf, err => {
          if (err) return send(res, 500, 'text/plain', 'Error');
          const msg = JSON.stringify({ f: name, n: nombre });
          for (const c of clients) c.write('data: ' + msg + '\n\n');
          send(res, 200, 'text/plain', 'ok');
        });
      });
    });
    return;
  }
  send(res, 404, 'text/plain', 'No encontrado');
}).listen(PORT, '0.0.0.0', () => {
  console.log('\n  Muro de fotos en marcha\n');
  console.log('  Muro / proyector:  http://localhost:' + PORT + '/wall');
  console.log('  QR grande:         http://localhost:' + PORT + '/qr');
  console.log('  Link para subir:   ' + BASE + '/\n');
});
