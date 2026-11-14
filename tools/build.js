/* Bundles inkwell/ into a single self-contained page.
   Emits docs/index.html (GitHub Pages entry) and dist/index.html (drop-anywhere copy).

   Usage:  node tools/build.js
*/
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'inkwell');
const VER = '1.0.0';

fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });

const read = f => fs.readFileSync(path.join(SRC, f), 'utf8');
const b64 = f => fs.readFileSync(path.join(SRC, f)).toString('base64');

let html = read('index.html');
let css = read('style.css');
let js = read('app.js');

// NOTE: every replace below passes a *function*. A replacement string would
// interpret `$'`, "$&" etc., and the app source is full of `$('#id')` selectors —
// that silently spliced HTML into the script and broke the bundle.

// webfont → data URI
const fontB64 = b64('inter.woff2');
css = css.replace(/url\('inter\.woff2'\)\s*format\('woff2'\)/g,
  () => "url(data:font/woff2;base64," + fontB64 + ") format('woff2')");
if (/url\('inter\.woff2'\)/.test(css)) throw new Error('font reference not replaced');

// CSS inline
const cssTag = /<link rel="stylesheet" href="style\.css">/;
if (!cssTag.test(html)) throw new Error('stylesheet link not found');
html = html.replace(cssTag, () => '<style>\n' + css + '\n</style>');

// JS inline (guard any literal closing script tag)
js = js.replace(/<\/script>/gi, () => '<\\/script>');
const jsTag = /<script src="app\.js"><\/script>/;
if (!jsTag.test(html)) throw new Error('script tag not found');
html = html.replace(jsTag, () => '<script>\n' + js + '\n</script>');

// drop the font preload: the font is already inside the document
html = html.replace(/<link rel="preload" href="inter\.woff2"[^>]*>\s*\n/, () => '');

// social / sharing meta + build stamp
html = html.replace('</head>', () =>
  '<meta property="og:type" content="website">\n' +
  '<meta property="og:title" content="墨水瓶 — 优化流程、降低成本并激发创造力的智能层">\n' +
  '<meta property="og:description" content="把重复交给系统，把判断留给人，把时间还给创造。">\n' +
  '<meta name="twitter:card" content="summary_large_image">\n' +
  '<!-- build ' + VER + ' · ' + new Date().toISOString() + ' -->\n' +
  '</head>');

if (/(src|href)="(?!data:|#)[^"]*\.(js|css|woff2)"/.test(html)) {
  throw new Error('bundle still references an external asset');
}

fs.writeFileSync(path.join(ROOT, 'docs', 'index.html'), html, 'utf8');
fs.writeFileSync(path.join(ROOT, 'dist', 'index.html'), html, 'utf8');
fs.writeFileSync(path.join(ROOT, 'docs', '.nojekyll'), '', 'utf8');

const kb = n => (n / 1024).toFixed(1) + ' KB';
console.log('docs/index.html  ' + kb(Buffer.byteLength(html, 'utf8')));
console.log('  css  ' + kb(Buffer.byteLength(css, 'utf8')));
console.log('  js   ' + kb(Buffer.byteLength(js, 'utf8')));
console.log('  font ' + kb(fontB64.length));
console.log('  external asset refs: 0');