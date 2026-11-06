#!/usr/bin/env node
/**
 * Server static minimal, fără dependențe, pentru BMW B48 Mechanic Simulator.
 *   node tools/serve.mjs            → http://localhost:8080
 *   PORT=3000 node tools/serve.mjs  → http://localhost:3000
 * Servește doar fișiere din rădăcina proiectului (protecție path traversal).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.map': 'application/json; charset=utf-8'
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(body);
}

/** Rezolvă calea cerută în interiorul ROOT; întoarce null dacă iese din rădăcină. */
function resolveSafe(urlPath) {
  let decoded;
  try { decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0]); } catch { return null; }
  if (decoded.includes('\0')) return null;
  const rel = path.normalize(decoded).replace(/^([/\\])+/, '');
  const full = path.resolve(ROOT, rel);
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) return null;
  // nu servim fișiere ascunse (.git, .env …)
  if (path.relative(ROOT, full).split(path.sep).some((seg) => seg.startsWith('.') && seg.length > 1)) return null;
  return full;
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Metodă nepermisă', { Allow: 'GET, HEAD' });
  let file = resolveSafe(req.url || '/');
  if (!file) return send(res, 403, 'Acces interzis');
  fs.stat(file, (err, st) => {
    if (!err && st.isDirectory()) {
      file = path.join(file, 'index.html');
      return fs.stat(file, (e2, st2) => (e2 || !st2.isFile() ? send(res, 404, 'Negăsit') : stream(file, st2)));
    }
    if (err || !st.isFile()) return send(res, 404, `Negăsit: ${req.url}`);
    return stream(file, st);
  });

  function stream(f, st) {
    const type = MIME[path.extname(f).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    if (req.method === 'HEAD') return res.end();
    const s = fs.createReadStream(f);
    s.on('error', () => { if (!res.headersSent) send(res, 500, 'Eroare la citire'); else res.destroy(); });
    s.pipe(res);
  }
});

server.on('error', (err) => {
  console.error(err.code === 'EADDRINUSE' ? `Portul ${PORT} este ocupat. Folosiți PORT=<alt port> npm start.` : err);
  process.exit(1);
});
server.listen(PORT, HOST, () => {
  console.log(`BMW B48 Mechanic Simulator — http://localhost:${PORT}  (rădăcină: ${ROOT})`);
  console.log('Ctrl+C pentru oprire.');
});
