#!/usr/bin/env node
// End-to-end check of the real 3D client in headless Chrome/Edge via the DevTools Protocol:
// real key presses, HUD text vs. simulation state, replay after game over, no console errors.
//   node scripts/browser-check.mjs [--out report.txt] [--shots dir]
// Exit 0 = all checks pass, 1 = a check failed, 3 = no browser found (skipped).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k) => (process.argv.indexOf(k) > 0 ? process.argv[process.argv.indexOf(k) + 1] : null);
const BROWSERS = [
  process.env.CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean);
const browserPath = BROWSERS.find((b) => fs.existsSync(b));
if (!browserPath) {
  console.log('SKIP: no Chrome/Edge found (set CHROME=/path/to/chrome)');
  process.exit(3);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lines = [];
const log = (s) => {
  lines.push(s);
  console.log(s);
};
let failed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failed++;
  log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

const port = 5600 + Math.floor(Math.random() * 300);
const dbg = 9400 + Math.floor(Math.random() * 300);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-browser-'));
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(port), NO_OPEN: '1' } });
await new Promise((r) => server.stdout.once('data', r));
const chrome = spawn(browserPath, [
  '--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars',
  '--window-size=1280,720', `--remote-debugging-port=${dbg}`, `--user-data-dir=${tmp}`, 'about:blank',
], { stdio: 'ignore' });

async function cleanup() {
  chrome.kill();
  server.kill();
  await sleep(300);
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    /* Chrome may still hold files on Windows */
  }
}

try {
  let targets = null;
  for (let i = 0; i < 50 && !targets; i++) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${dbg}/json/list`)).json();
    } catch {
      await sleep(200);
    }
  }
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let nextId = 1;
  const pending = new Map();
  const consoleErrors = [];
  ws.addEventListener('message', (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
    } else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      consoleErrors.push(`${msg.params.entry.text} ${msg.params.entry.url || ''}`);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = nextId++;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;
  const waitFor = async (expression, timeout = 15000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      if (await evaluate(expression)) return true;
      await sleep(100);
    }
    return false;
  };
  const key = async (code, type) => {
    const keyName = { Enter: 'Enter', Space: ' ' }[code] || code.replace('Key', '').toLowerCase();
    await send('Input.dispatchKeyEvent', { type, code, key: keyName, windowsVirtualKeyCode: code === 'Enter' ? 13 : 0 });
  };
  const hold = async (code, ms) => {
    await key(code, 'keyDown');
    await sleep(ms);
    await key(code, 'keyUp');
  };
  const shot = async (name) => {
    const dir = arg('--shots');
    if (!dir) return;
    fs.mkdirSync(dir, { recursive: true });
    const { result } = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(dir, `${name}.png`), Buffer.from(result.data, 'base64'));
  };
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  const open = async (q) => {
    await send('Page.navigate', { url: `http://localhost:${port}/${q}` });
    return waitFor('!!(window.__ddl && window.__ddl.game)');
  };

  log(`browser: ${path.basename(browserPath)} | ${os.type()} ${os.release()} | Node ${process.version}`);

  // 1. Title screen -> Enter starts a game (R10 start)
  await send('Page.navigate', { url: `http://localhost:${port}/` });
  await waitFor('!!window.__ddl');
  check('title screen shown, no game yet', await evaluate("window.__ddl.mode === 'title' && !document.getElementById('overlay').hidden"));
  await hold('Enter', 50);
  check('Enter starts a game', await waitFor("window.__ddl.mode === 'playing' && window.__ddl.game.state === 'playing'"));

  // 2. Keyboard movement through the real input mapping (yaw 0: W = +Z, D = screen-right = -X)
  await open('?autostart&seed=3');
  const p0 = await evaluate('({...window.__ddl.game.player})');
  await hold('KeyW', 800);
  const p1 = await evaluate('({...window.__ddl.game.player})');
  check('W moves Mây forward (+Z)', p1.z - p0.z > 1.5 && Math.abs(p1.x - p0.x) < 0.3, `dz=${(p1.z - p0.z).toFixed(2)} dx=${(p1.x - p0.x).toFixed(2)}`);
  await hold('KeyD', 500);
  const p2 = await evaluate('({...window.__ddl.game.player})');
  check('D moves Mây to screen-right (-X at yaw 0)', p2.x - p1.x < -1, `dx=${(p2.x - p1.x).toFixed(2)}`);
  await key('Space', 'keyDown');
  const jumped = await waitFor('window.__ddl.game.player.y > 0.3', 2000);
  await key('Space', 'keyUp');
  check('Space makes Mây jump', jumped);

  // 3. HUD shows the simulation state
  const hud = await evaluate(`(() => { const g = window.__ddl.game; const t = (id) => document.getElementById(id).textContent;
    return { carried: t('carried') === String(g.player.carried), lit: t('lit') === String(g.lanterns.filter(l => l.lit).length),
      score: t('score') === String(g.score), flames: document.querySelectorAll('.flame:not(.out)').length === g.player.flames,
      time: /^\\d:\\d\\d$/.test(t('time')) }; })()`);
  check('HUD matches state (flames, carried, lanterns, time, score)', hud && Object.values(hud).every(Boolean), JSON.stringify(hud));
  await shot('browser_playing');

  // 4. Win -> overlay -> R replays (R10). p1_05 wins on tick 1 with 349 points.
  await open('?scenario=p1_05_win_bonus&seed=1');
  check('replay p1_05 reaches "won" with 349 points like headless', await waitFor("window.__ddl.mode === 'over' && window.__ddl.game.state === 'won' && window.__ddl.game.score === 349"));
  check('win overlay visible with replay hint', await evaluate("!document.getElementById('overlay').hidden && /chơi lại/.test(document.getElementById('ov-cta').textContent)"));
  await shot('browser_won');
  const before = await evaluate('window.__ddl.gamesStarted');
  await hold('KeyR', 50);
  check('R after a win starts a fresh game', await waitFor(`window.__ddl.gamesStarted === ${before + 1}`), `games ${before} -> ${await evaluate('window.__ddl.gamesStarted')}`);
  await sleep(300);
  check('a key that is not R/Enter does not restart', await (async () => {
    await open('?scenario=p1_05_win_bonus&seed=1');
    await waitFor("window.__ddl.mode === 'over'");
    const n = await evaluate('window.__ddl.gamesStarted');
    await hold('KeyW', 100);
    await sleep(200);
    return (await evaluate('window.__ddl.gamesStarted')) === n;
  })());

  // 5. Lose (dawn) -> Enter replays
  await open('?scenario=p1_04_dawn&seed=1');
  check('replay p1_04 reaches "lost" (dawn)', await waitFor("window.__ddl.mode === 'over' && window.__ddl.game.state === 'lost' && window.__ddl.game.reason === 'dawn'"));
  await shot('browser_lost');
  const beforeLoss = await evaluate('window.__ddl.gamesStarted');
  await hold('Enter', 50);
  check(
    'Enter after a loss starts a fresh game',
    await waitFor(`window.__ddl.gamesStarted === ${beforeLoss + 1} && window.__ddl.mode === 'playing' && window.__ddl.game.state === 'playing'`),
  );

  // A scenario without inputs.json is legal (contract: no inputs = stand still); its 404 is expected.
  const realErrors = consoleErrors.filter((e) => !/404.*\/scenarios\/[\w-]+\/inputs\.json/.test(e));
  check('no console errors / exceptions', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));
  ws.close();
} catch (e) {
  check('browser check crashed', false, e.message);
} finally {
  await cleanup();
}
log(`\n${failed === 0 ? 'ALL PASS' : `${failed} FAILED`}`);
if (arg('--out')) fs.writeFileSync(arg('--out'), `${lines.join('\n')}\n`);
process.exit(failed ? 1 : 0);
