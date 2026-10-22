#!/usr/bin/env node
// Muro de fotos en vivo - Boda de Paula y Carlos
// Sin dependencias, sin cuentas. Solo Node.js 16+
// Uso:  node muro.js        (puerto 3000)   |   PORT=8080 node muro.js
// Páginas:  /  (subir foto)   /wall  (muro para proyectar)   /qr  (QR grande)
// Foto de fondo opcional: poné un archivo "fondo.jpg" junto a este archivo.
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

/* ---------- Estilo romántico ---------- */
const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Marcellus&family=Pinyon+Script&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">`;

const STYLE = `
:root{--cream:#f8f6f3;--ink:#2a2622;--r:9px}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;font:15px/1.6 'Space Mono',ui-monospace,Menlo,Consolas,monospace;color:var(--ink);
 background:linear-gradient(rgba(20,16,10,.35),rgba(20,16,10,.5)),url(/fondo.jpg) center/cover fixed,linear-gradient(160deg,#8d7b59,#4a5a3b) fixed}
.script{font-family:'Pinyon Script','Brush Script MT',Georgia,cursive;font-weight:400;color:#fff;text-shadow:0 2px 14px rgba(0,0,0,.45);line-height:1.05;margin:0}
.caps{font-family:'Marcellus',Georgia,serif;letter-spacing:.08em;text-transform:uppercase;color:#fff;text-shadow:0 1px 8px rgba(0,0,0,.5)}
.card{padding:calc(var(--r) + 1.4rem);text-align:center;
 background:
  radial-gradient(circle at 50% 100%,var(--cream) calc(var(--r) - 1px),transparent var(--r)) top left/calc(var(--r)*2) var(--r) repeat-x,
  radial-gradient(circle at 50% 0,var(--cream) calc(var(--r) - 1px),transparent var(--r)) bottom left/calc(var(--r)*2) var(--r) repeat-x,
  radial-gradient(circle at 100% 50%,var(--cream) calc(var(--r) - 1px),transparent var(--r)) top left/var(--r) calc(var(--r)*2) repeat-y,
  radial-gradient(circle at 0 50%,var(--cream) calc(var(--r) - 1px),transparent var(--r)) top right/var(--r) calc(var(--r)*2) repeat-y,
  linear-gradient(var(--cream),var(--cream)) center/calc(100% - var(--r)*2 + 2px) calc(100% - var(--r)*2 + 2px) no-repeat;
 filter:drop-shadow(0 8px 20px rgba(0,0,0,.28))}
.t{text-transform:uppercase;font-size:.78rem;letter-spacing:.04em;margin:0 0 1.2rem}
.b{font:700 .82rem 'Space Mono',ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;background:var(--ink);color:var(--cream);border:1px solid var(--ink);padding:.85rem 1.1rem;cursor:pointer;display:inline-block;text-align:center}
.b.o{background:transparent;color:var(--ink)}.b:disabled{opacity:.35}
@keyframes pop{from{transform:scale(.6) rotate(var(--rot,0deg));opacity:0}to{transform:scale(1) rotate(var(--rot,0deg));opacity:1}}`;

const UPLOAD_HTML = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Paula y Carlos · Subí tu foto</title>${FONTS}
<style>${STYLE}
.w{max-width:480px;margin:0 auto;padding:2rem 1.2rem 3rem}
label.l{display:block;font-size:.72rem;letter-spacing:.18em;text-transform:uppercase}
input[type=text]{width:100%;padding:.6rem .2rem;border:0;border-bottom:1px solid var(--ink);background:transparent;font:inherit;font-size:1.1rem;text-align:center;color:var(--ink);outline:none;margin:.2rem 0 1.3rem}
input[type=text]::placeholder{color:#9a928a}
.row{display:flex;gap:.6rem}.row .b{flex:1}
#p{max-width:100%;border:7px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.2);margin:1.1rem 0 .4rem;display:none}
#s{width:100%;margin-top:.8rem}#m{margin:.9rem 0 0;font-size:.78rem;min-height:1.2rem}</style></head><body>
<div class="w">
 <div class="caps" style="text-align:center;font-size:1.05rem">Compartí tus fotos</div>
 <h1 class="script" style="font-size:4.4rem;text-align:center;margin:.3rem 0">Paula y Carlos</h1>
 <div class="caps" style="text-align:center;font-weight:700;font-size:.8rem;letter-spacing:.28em;margin-bottom:1.8rem">Nuestra boda</div>
 <div class="card">
  <p class="t">Sacá una foto y dejá tu nombre.<br>Aparecerá en la pantalla de la fiesta.</p>
  <label class="l" for="n">Tu nombre</label>
  <input id="n" type="text" maxlength="30" placeholder="Ej: María" autocomplete="given-name">
  <div class="row">
   <label class="b" for="fc">📷 Sacar foto</label>
   <label class="b o" for="fg">Galería</label>
  </div>
  <input id="fc" type="file" accept="image/*" capture="environment" hidden>
  <input id="fg" type="file" accept="image/*" hidden>
  <img id="p" alt="">
  <button class="b" id="s" style="display:none">Enviar al muro</button>
  <p id="m"></p>
 </div>
</div>
<script>
var blob=null,$=function(i){return document.getElementById(i)};
try{$('n').value=localStorage.getItem('muro-nombre')||''}catch(e){}
function check(){$('s').disabled=!(blob&&$('n').value.trim())}
$('n').oninput=function(){try{localStorage.setItem('muro-nombre',$('n').value)}catch(e){}check()};
function leer(e){var file=e.target.files[0];if(!file)return;$('m').textContent='Procesando…';
 var im=new Image(),u=URL.createObjectURL(file);
 im.onload=function(){var s=Math.min(1,1600/Math.max(im.width,im.height)),c=document.createElement('canvas');
  c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);c.getContext('2d').drawImage(im,0,0,c.width,c.height);
  c.toBlob(function(b){blob=b;$('p').src=URL.createObjectURL(b);$('p').style.display='inline-block';$('s').style.display='block';
   $('m').textContent=$('n').value.trim()?'':'Escribí tu nombre para poder enviar.';check();},'image/jpeg',.85);};
 im.onerror=function(){$('m').textContent='No pude leer esa imagen.'};im.src=u;}
$('fc').onchange=leer;$('fg').onchange=leer;
$('s').onclick=function(){var nom=$('n').value.trim();if(!blob||!nom)return;$('s').disabled=true;$('m').textContent='Enviando…';
 fetch('/upload',{method:'POST',headers:{'Content-Type':'image/jpeg','X-Nombre':encodeURIComponent(nom)},body:blob}).then(function(r){
  if(!r.ok)throw 0;$('m').textContent='¡Gracias, '+nom+'! Mirá la pantalla 💛';$('p').style.display='none';$('s').style.display='none';$('fc').value='';$('fg').value='';blob=null;
 }).catch(function(){$('m').textContent='No se pudo enviar, probá de nuevo.';$('s').disabled=false});};
</script></body></html>`;

const WALL_HTML = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Paula y Carlos · Muro en vivo</title>${FONTS}
<style>${STYLE}
.top{display:flex;align-items:center;justify-content:space-between;gap:1.5rem;padding:1.4rem 1.6rem .8rem;flex-wrap:wrap}
.top .script{font-size:clamp(3rem,7vw,5.5rem)}
#qc{padding:calc(var(--r) + .9rem);max-width:210px}
#qc .t{font-size:.62rem;margin:.6rem 0 0}#q{display:inline-block;line-height:0}
#u{font-size:.55rem;word-break:break-all;color:#6b635b;margin-top:.3rem}
#g{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:20px;padding:.8rem 1.6rem 2rem}
#g figure{margin:0;background:var(--cream);padding:9px 9px 0;box-shadow:0 6px 18px rgba(0,0,0,.4);animation:pop .8s;transform:rotate(var(--rot,0deg))}
#g figure.n{box-shadow:0 0 0 4px #e8c3b0,0 6px 18px rgba(0,0,0,.4)}
#g img{width:100%;aspect-ratio:1;object-fit:cover;display:block}
figcaption{font-family:'Pinyon Script','Brush Script MT',cursive;font-size:1.6rem;text-align:center;padding:.1rem 0 .3rem;color:var(--ink);min-height:2.5rem;line-height:1.5}
#b{position:fixed;inset:0;background:rgba(15,11,6,.9);display:none;align-items:center;justify-content:center;z-index:5}
#bf{background:var(--cream);padding:14px 14px 0;box-shadow:0 12px 40px rgba(0,0,0,.6);animation:pop .6s}
#bf img{max-width:88vw;max-height:70vh;display:block}
#bn{font-family:'Pinyon Script','Brush Script MT',cursive;font-size:3.4rem;color:var(--ink);text-align:center;padding:.1rem 0 .5rem;line-height:1.4}</style></head><body>
<div class="top">
 <div><div class="caps" style="font-size:1.1rem">Nuestra boda</div><h1 class="script">Paula y Carlos</h1></div>
 <div class="card" id="qc"><div id="q"></div><p class="t">Escaneá y subí tu foto</p><div id="u"></div></div>
</div>
<div id="g"></div>
<div id="b"><div id="bf"><img alt=""><div id="bn"></div></div></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<script>
var g=document.getElementById('g'),b=document.getElementById('b'),seen={};
function fig(o,nuevo){var f=document.createElement('figure');f.style.setProperty('--rot',(Math.random()*4-2).toFixed(1)+'deg');
 if(nuevo){f.className='n';setTimeout(function(){f.className=''},8000)}
 var i=document.createElement('img');i.src='/fotos/'+o.f;f.appendChild(i);
 var c=document.createElement('figcaption');c.textContent=o.n||'';f.appendChild(c);return f}
function add(o,nuevo){if(seen[o.f])return;seen[o.f]=1;g.insertBefore(fig(o,nuevo),g.firstChild);
 if(nuevo){b.querySelector('img').src='/fotos/'+o.f;document.getElementById('bn').textContent=o.n||'';b.style.display='flex';clearTimeout(add.t);add.t=setTimeout(function(){b.style.display='none'},5000);}
 while(g.children.length>60)g.removeChild(g.lastChild)}
fetch('/api/list').then(function(r){return r.json()}).then(function(l){l.reverse().forEach(function(o){add(o,false)})});
new EventSource('/events').onmessage=function(e){try{add(JSON.parse(e.data),true)}catch(x){}};
fetch('/api/info').then(function(r){return r.json()}).then(function(d){
 try{new QRCode(document.getElementById('q'),{text:d.url,width:150,height:150})}catch(e){}
 document.getElementById('u').textContent=d.url});
</script></body></html>`;

const QR_HTML = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Paula y Carlos · QR</title>${FONTS}
<style>${STYLE}
body{display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;padding:1.5rem}
#q{display:inline-block;line-height:0;margin:.5rem 0}#u{font-size:.65rem;color:#6b635b;word-break:break-all;margin-top:.6rem}</style></head><body>
<div>
 <div class="caps" style="font-size:1.1rem">Compartí tus fotos</div>
 <h1 class="script" style="font-size:clamp(3.2rem,9vw,6rem);margin:.2rem 0 1.4rem">Paula y Carlos</h1>
 <div class="card" style="display:inline-block"><div id="q"></div>
  <p class="t" style="margin:.8rem 0 0">Escaneá el código con la cámara<br>de tu celular</p><div id="u"></div></div>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<script>
fetch('/api/info').then(function(r){return r.json()}).then(function(d){
 var s=Math.min(420,Math.floor(Math.min(innerWidth,innerHeight)*.5));
 try{new QRCode(document.getElementById('q'),{text:d.url,width:s,height:s})}catch(e){}
 document.getElementById('u').textContent=d.url});
</script></body></html>`;

function send(res, code, type, body) { res.writeHead(code, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff' }); res.end(body); }

http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  if (req.method === 'GET' && url === '/') return send(res, 200, 'text/html; charset=utf-8', UPLOAD_HTML);
  if (req.method === 'GET' && url === '/wall') return send(res, 200, 'text/html; charset=utf-8', WALL_HTML);
  if (req.method === 'GET' && url === '/qr') return send(res, 200, 'text/html; charset=utf-8', QR_HTML);
  if (req.method === 'GET' && url === '/fondo.jpg') {
    const f = path.join(__dirname, 'fondo.jpg');
    if (!fs.existsSync(f)) return send(res, 404, 'text/plain', 'No encontrado');
    res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' });
    return fs.createReadStream(f).pipe(res);
  }
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
  console.log('\n  Muro de fotos - Paula y Carlos\n');
  console.log('  Muro / proyector:  http://localhost:' + PORT + '/wall');
  console.log('  QR grande:         http://localhost:' + PORT + '/qr');
  console.log('  Link para subir:   ' + BASE + '/\n');
});
