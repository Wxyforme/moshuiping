/* Minimal static host for local preview.

   Usage:  node tools/serve.js            → http://127.0.0.1:8080/
           node tools/serve.js --port 3000
           node tools/serve.js --host 0.0.0.0   (expose to the local network)

   Add ?s=0.86 to the URL to jump straight to a shot, ?t=5 to freeze the intro.
*/
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const PORT = parseInt(arg('--port', '8080'), 10);
const HOST = arg('--host', '127.0.0.1');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

let hits = 0;

http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { p = '/'; }
  if (p === '/' || p === '') p = '/docs/index.html';
  if (p.charAt(p.length - 1) === '/') p += 'index.html';

  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('404 ' + p);
  }
  hits++;
  if (hits <= 20 || hits % 50 === 0) console.log(new Date().toISOString().slice(11, 19), req.method, p);
  res.writeHead(200, {
    'content-type': MIME[path.extname(file)] || 'application/octet-stream',
    'cache-control': 'no-cache, no-store, must-revalidate'
  });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, HOST, () => {
  console.log('serving ' + ROOT);
  console.log('url http://' + (HOST === '0.0.0.0' ? 'localhost' : HOST) + ':' + PORT + '/');
});