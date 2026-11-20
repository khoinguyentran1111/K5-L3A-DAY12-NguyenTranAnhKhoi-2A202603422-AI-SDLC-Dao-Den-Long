#!/usr/bin/env node
// Tiny server for the 3D game (no extra dependencies) + the local leaderboard (Ticket-04 §3).
//   npm start            -> http://localhost:5173 (opens the browser unless NO_OPEN=1)
//   PORT=8080 HOST=0.0.0.0 npm start
//   node scripts/serve.mjs --export-leaderboard out.json   -> {"entries": [...]} in order, then exit
// The leaderboard is stored on the local disk in data/leaderboard.json (override: DDL_LEADERBOARD=path),
// so it survives closing and reopening the game.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { insertEntry, makeEntry, sanitize } from '../src/core/leaderboard.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BOARD = path.resolve(process.env.DDL_LEADERBOARD || path.join(ROOT, 'data', 'leaderboard.json'));

export function readBoard(file = BOARD) {
  try {
    return sanitize(JSON.parse(fs.readFileSync(file, 'utf8')).entries);
  } catch {
    return []; // no file yet (or unreadable): empty board
  }
}
function writeBoard(entries, file = BOARD) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify({ entries }, null, 2)}\n`);
  fs.renameSync(tmp, file); // atomic replace: a crash never leaves half a file
}

// ---- CLI: export the leaderboard and exit
const ei = process.argv.indexOf('--export-leaderboard');
if (ei > 0) {
  const out = process.argv[ei + 1];
  if (!out) {
    console.error('usage: node scripts/serve.mjs --export-leaderboard <out.json>');
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify({ entries: readBoard() }, null, 2)}\n`);
  console.log(`leaderboard (${readBoard().length} entries) -> ${out}`);
  process.exit(0);
}

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

const json = (res, code, obj) => res.writeHead(code, { 'content-type': TYPES['.json'], 'cache-control': 'no-store' }).end(JSON.stringify(obj));

function leaderboardApi(req, res) {
  if (req.method === 'GET') return json(res, 200, { entries: readBoard() });
  if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' });
  let body = '';
  req.on('data', (c) => {
    body += c;
    if (body.length > 4096) req.destroy();
  });
  req.on('end', () => {
    try {
      const { name, score, nights_won, seed } = JSON.parse(body);
      const entry = makeEntry({ name, score, nights_won, seed }); // achieved_at = now, with the local UTC offset
      const entries = insertEntry(readBoard(), entry);
      writeBoard(entries);
      json(res, 200, { entries, rank: entries.indexOf(entry) + 1 || null });
    } catch (e) {
      json(res, 400, { error: e.message });
    }
  });
}

const server = http.createServer((req, res) => {
  let p;
  try {
    p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (p === '/api/leaderboard') return leaderboardApi(req, res);
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
  console.log(`Đảo Đèn Lồng đang chạy: ${url}  (Ctrl+C để dừng) · bảng xếp hạng: ${path.relative(process.cwd(), BOARD) || BOARD}`);
  if (process.env.NO_OPEN || process.env.CI) return;
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
  } catch {
    /* no browser available: the URL is printed above */
  }
});
