#!/usr/bin/env node
// Tiny static server for the 3D game (no extra dependencies).
//   npm start            -> http://localhost:5173 (opens the browser unless NO_OPEN=1)
//   PORT=8080 HOST=0.0.0.0 npm start
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 5173;
const HOST = process.env.HOST || '127.0.0.1';
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};
const ALLOW = ['/src/', '/scenarios/', '/node_modules/three/build/', '/game.contract.json'];

if (!fs.existsSync(path.join(ROOT, 'node_modules/three/build/three.module.js'))) {
  console.error('three.js chưa được cài. Chạy: npm install');
  process.exit(1);
}

const server = http.createServer((req, res) => {
  let p;
  try {
    p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (p === '/' || p === '/index.html') p = '/src/web/index.html';
  const file = path.resolve(ROOT, `.${p}`);
  const okPrefix = ALLOW.some((a) => p === a || p.startsWith(a));
  if (!okPrefix || !file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, HOST, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Đảo Đèn Lồng đang chạy: ${url}  (Ctrl+C để dừng)`);
  if (process.env.NO_OPEN || process.env.CI) return;
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
  } catch {
    /* no browser available: the URL is printed above */
  }
});
