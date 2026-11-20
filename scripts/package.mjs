#!/usr/bin/env node
// Builds the GitHub Release package (Ticket-04 §5): a ready-to-run folder + zip that needs only
// Node.js >= 20 (three.js is bundled, no `npm install`).
//   node scripts/package.mjs            -> dist/dao-den-long-v<version>/ and dist/dao-den-long-v<version>.zip
// Inside: node scripts/serve.mjs (game + leaderboard on disk), node src/headless.js, scripts/bench.mjs,
// scripts/soak.mjs. The web/ subfolder is also a plain static site (any web server; the leaderboard then
// falls back to the browser's storage).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const name = `dao-den-long-v${version}`;
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(DIST, name);
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const copy = (rel, to = rel) => {
  const src = path.join(ROOT, rel);
  if (!fs.existsSync(src)) throw new Error(`missing ${rel}`);
  fs.cpSync(src, path.join(OUT, to), { recursive: true });
};
for (const p of ['src', 'scenarios', 'game.contract.json', 'package.json', 'README.md', 'CHANGELOG.md', 'CREDITS.md', 'LICENSE']) copy(p);
for (const s of ['serve.mjs', 'bench.mjs', 'soak.mjs', 'scenarios.mjs']) copy(`scripts/${s}`);
copy('node_modules/three/build/three.module.js');
copy('node_modules/three/LICENSE', 'node_modules/three/LICENSE');
fs.writeFileSync(path.join(OUT, 'node_modules/three/package.json'), JSON.stringify({ name: 'three', version: JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/three/package.json'), 'utf8')).version, license: 'MIT' }, null, 2));

// plain static copy of the web game (relative paths so it works from any folder/host)
const WEB = path.join(OUT, 'web');
fs.mkdirSync(WEB, { recursive: true });
fs.cpSync(path.join(ROOT, 'src'), path.join(WEB, 'src'), { recursive: true });
fs.cpSync(path.join(ROOT, 'game.contract.json'), path.join(WEB, 'game.contract.json'));
fs.mkdirSync(path.join(WEB, 'node_modules/three/build'), { recursive: true });
fs.cpSync(path.join(ROOT, 'node_modules/three/build/three.module.js'), path.join(WEB, 'node_modules/three/build/three.module.js'));
const html = fs.readFileSync(path.join(ROOT, 'src/web/index.html'), 'utf8')
  .replace('href="/src/web/style.css"', 'href="src/web/style.css"')
  .replace('"/node_modules/three/build/three.module.js"', '"./node_modules/three/build/three.module.js"')
  .replace('src="/src/web/main.js"', 'src="src/web/main.js"');
fs.writeFileSync(path.join(WEB, 'index.html'), html);
const mainJs = path.join(WEB, 'src/web/main.js');
fs.writeFileSync(mainJs, fs.readFileSync(mainJs, 'utf8').replace("fetch('/game.contract.json')", "fetch(new URL('../../game.contract.json', import.meta.url))"));

fs.writeFileSync(path.join(OUT, 'CHAY-GAME.txt'), `Đảo Đèn Lồng v${version}
==========================

Cần: Node.js >= 20 (https://nodejs.org). Không cần "npm install" (three.js đã kèm sẵn).

Chơi:      node scripts/serve.mjs          rồi mở http://localhost:5173 (trình duyệt tự mở)
Headless:  node src/headless.js --seed 1 --night 1 --ticks 600 --out out/run.jsonl
Bench:     node scripts/bench.mjs --seed 42 --duration 30 --out bench.json   (cần Chrome hoặc Edge, Node >= 22)
Soak:      node scripts/soak.mjs --seed 7 --nights 10 --out soak.json
Bảng xếp hạng: lưu ở data/leaderboard.json; xuất: node scripts/serve.mjs --export-leaderboard out.json

Bản web tĩnh: thư mục web/ chạy được trên mọi web server tĩnh (ví dụ: npx serve web, hoặc GitHub Pages).
Ở chế độ này không có server nên bảng xếp hạng được lưu trong bộ nhớ của trình duyệt.
`);

// zip (bsdtar on Windows 10+/macOS, zip on Linux)
const zip = path.join(DIST, `${name}.zip`);
fs.rmSync(zip, { force: true });
let r;
if (process.platform === 'linux') r = spawnSync('zip', ['-qr', zip, name], { cwd: DIST });
else r = spawnSync(process.platform === 'win32' ? 'C:/Windows/System32/tar.exe' : 'tar', ['-a', '-c', '-f', zip, name], { cwd: DIST });
if (r.status !== 0) {
  console.error(`zip failed (${r.error?.message || r.stderr}); the folder ${path.relative(ROOT, OUT)} is ready`);
  process.exit(1);
}
const size = (fs.statSync(zip).size / 2 ** 20).toFixed(2);
console.log(`package: ${path.relative(ROOT, OUT)}/ and ${path.relative(ROOT, zip)} (${size} MB)`);
