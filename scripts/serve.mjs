import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { build } from './build.mjs';

const root = process.cwd();
const base = (process.env.BASE_PATH || '').replace(/\/$/, '');
const out = path.join(root, '_site');
build(root);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
const server = http.createServer((request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (base && pathname !== base && !pathname.startsWith(`${base}/`)) { response.writeHead(404); response.end('Not found'); return; }
    let relative = pathname.slice(base.length).replace(/^\//, '');
    const full = path.resolve(out, relative);
    if (!full.startsWith(`${out}${path.sep}`) && full !== out) { response.writeHead(403); response.end(); return; }
    if (relative.split('/').some(part => part.startsWith('.'))) { response.writeHead(404); response.end(); return; }
    if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
      if (!pathname.endsWith('/')) { response.writeHead(301, { Location: `${pathname}/${new URL(request.url, 'http://localhost').search}` }); response.end(); return; }
      relative = path.join(relative, 'index.html');
    }
    const file = path.join(out, relative);
    const exists = fs.existsSync(file) && fs.statSync(file).isFile();
    response.writeHead(exists ? 200 : 404, { 'Content-Type': mime[path.extname(exists ? file : '404.html')] || 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(fs.readFileSync(exists ? file : path.join(out, '404.html')));
  } catch { response.writeHead(400); response.end('Bad request'); }
});
server.listen(Number(process.env.PORT || 4173), '127.0.0.1', () => console.log(`The gates are open: http://localhost:${server.address().port}${base}/`));
if (process.argv.includes('--watch')) {
  let timer;
  for (const target of ['collection', 'site', 'taxonomy.json']) fs.watch(path.join(root, target), { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => { try { build(root); } catch (error) { console.error(`Rebuild stopped: ${error.message}`); } }, 150);
  });
  console.log('Watching collection and site; refresh the browser after an edit. Restart after changing build scripts.');
}
