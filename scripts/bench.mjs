#!/usr/bin/env node
// Benchmark (Ticket-04 §1):  node scripts/bench.mjs --seed 42 --duration 30 --out bench.json
// Opens the game in a real Chrome/Edge window (app mode, not fullscreen) whose page area is exactly
// 1280×720 (device scale factor 1), with vsync and the frame-rate limit switched off, loads the
// standard bench scene (/?bench: Night 1, 200 wandering shades, 100 motes, L1–L3 lit, orbiting
// camera), skips 3 s of warm-up, measures exactly --duration seconds and exits with code 0.
// Options: --headless (no window, e.g. CI), --warmup <s> (default 3), CHROME=/path/to/browser.
// Memory (assumption E6): the game runs in the browser's processes, so peak_mem_mb is the sum of
// the PEAK resident set of every process of this browser instance (Windows PeakWorkingSetSize,
// Linux VmHWM), read once after the measurement so sampling never disturbs the frame times.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PROCESS_START = performance.timeOrigin; // epoch ms when this process started (load_ms origin)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => (process.argv.indexOf(`--${k}`) > 0 ? process.argv[process.argv.indexOf(`--${k}`) + 1] : d);
const seed = Number(arg('seed', 42));
const duration = Number(arg('duration', 30));
const warmup = Number(arg('warmup', 3));
const out = arg('out', 'bench.json');
const headless = process.argv.includes('--headless');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const BROWSERS = [
  process.env.CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean);
const browserPath = BROWSERS.find((b) => fs.existsSync(b));
if (!browserPath) {
  console.error('bench: cần Chrome hoặc Edge (đặt CHROME=/đường/dẫn/tới/chrome).');
  process.exit(3);
}
if (typeof WebSocket === 'undefined') {
  console.error(`bench: cần Node >= 22 (WebSocket có sẵn); đang chạy Node ${process.version}.`);
  process.exit(3);
}

const port = 5900 + Math.floor(Math.random() * 400);
const dbg = 9800 + Math.floor(Math.random() * 150);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-bench-'));
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(port), NO_OPEN: '1', DDL_LEADERBOARD: path.join(profile, 'lb.json') } });
await new Promise((r) => server.stdout.once('data', r));

const flags = [
  `--remote-debugging-port=${dbg}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
  '--window-size=1280,720', '--window-position=40,40', '--force-device-scale-factor=1',
  '--disable-gpu-vsync', '--disable-frame-rate-limit', // vsync off (Ticket-04 §1)
  '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows', '--disable-extensions',
];
if (headless) flags.push('--headless=new', '--enable-gpu');
if (process.platform === 'linux') flags.push('--no-sandbox');
const chrome = spawn(browserPath, [...flags, '--app=data:text/html,<title>bench</title>'], { stdio: 'ignore' });

let ws;
async function finish(code) {
  try {
    ws?.close();
  } catch {
    /* ignore */
  }
  chrome.kill();
  server.kill();
  await sleep(500);
  try {
    fs.rmSync(profile, { recursive: true, force: true });
  } catch {
    /* Windows may still hold files */
  }
  process.exit(code);
}

// Sum of the peak resident sets of all processes started with our private profile directory.
function peakMemMb() {
  const tag = path.basename(profile);
  try {
    if (process.platform === 'win32') {
      const ps = `(Get-CimInstance Win32_Process | Where-Object { $_.Name -ne 'powershell.exe' -and $_.CommandLine -like '*${tag}*' } | Measure-Object -Property PeakWorkingSetSize -Sum).Sum`;
      const r = spawnSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8', timeout: 30000 });
      const kb = Number(r.stdout.trim()); // Win32_Process.PeakWorkingSetSize is in KILOBYTES (WorkingSetSize is in bytes)
      return kb > 0 ? Math.round(kb / 1024) : null;
    }
    if (process.platform === 'linux') {
      let kb = 0;
      for (const pid of fs.readdirSync('/proc').filter((d) => /^\d+$/.test(d))) {
        try {
          if (!fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').includes(tag)) continue;
          kb += Number((fs.readFileSync(`/proc/${pid}/status`, 'utf8').match(/VmHWM:\s+(\d+)/) || [])[1] || 0);
        } catch {
          /* process ended */
        }
      }
      return kb ? Math.round(kb / 1024) : null;
    }
    // macOS: no per-process peak counter without extra tools -> current RSS (lower bound)
    const r = spawnSync('ps', ['-ax', '-o', 'rss=,command='], { encoding: 'utf8' });
    const kb = r.stdout.split('\n').filter((l) => l.includes(tag)).reduce((a, l) => a + Number(l.trim().split(/\s+/)[0] || 0), 0);
    return kb ? Math.round(kb / 1024) : null;
  } catch {
    return null;
  }
}

try {
  let targets = null;
  for (let i = 0; i < 150 && !targets?.some((t) => t.type === 'page'); i++) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${dbg}/json/list`)).json();
    } catch {
      await sleep(100);
    }
  }
  const page = targets.find((t) => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  });
  const send = (method, params = {}) => new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;

  // make the page area exactly 1280×720: grow the window by its own frame/title bar
  const viewport = async () => evaluate('[innerWidth, innerHeight, outerWidth, outerHeight]');
  if (!headless) {
    const [iw, ih, ow, oh] = await viewport();
    const { result } = await send('Browser.getWindowForTarget', { targetId: page.id });
    if (result?.windowId) {
      await send('Browser.setWindowBounds', { windowId: result.windowId, bounds: { width: 1280 + (ow - iw), height: 720 + (oh - ih), windowState: 'normal' } });
    }
  } else {
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  }
  await sleep(300);
  const [vw, vh] = await viewport();
  const version = (await send('Browser.getVersion')).result?.product || path.basename(browserPath);

  await send('Page.navigate', { url: `http://localhost:${port}/?bench&seed=${seed}&duration=${duration}&warmup=${warmup}` });
  console.log(`bench: ${version}, page ${vw}×${vh}, warm-up ${warmup} s, measuring ${duration} s …`);
  const deadline = Date.now() + (warmup + duration + 90) * 1000;
  let res = null;
  while (!res && Date.now() < deadline) {
    await sleep(500);
    res = await evaluate('window.__benchResult || null');
  }
  if (!res) throw new Error('the bench page did not finish in time');
  const peak = peakMemMb();
  const report = {
    contract_version: '1.3',
    avg_fps: res.avg_fps,
    p1_low_fps: res.p1_low_fps,
    frame_ms_p95: res.frame_ms_p95,
    frames: res.frames,
    load_ms: Math.round(res.first_frame_epoch_ms - PROCESS_START),
    peak_mem_mb: peak,
    vsync_off: true,
    renderer: `Three.js r${res.three} (${res.webgl2 ? 'WebGL 2' : 'WebGL 1'}) in ${version}${headless ? ' headless' : ''}; GPU: ${res.gpu}`,
    os: `${os.type()} ${os.release()} ${os.arch()} | ${os.cpus()[0]?.model} x${os.cpus().length} | ${(os.totalmem() / 2 ** 30).toFixed(1)} GB RAM | Node ${process.version}`,
    // extra fields (not required): how the numbers were obtained
    seed,
    duration_s: duration,
    warmup_s: warmup,
    viewport: [vw, vh],
    canvas_px: res.canvas,
    window: headless ? 'headless' : 'app window, not fullscreen',
    browser_flags: flags.filter((f) => !/remote-debugging|user-data-dir/.test(f)),
    scene: { night: 1, shades: res.shades, motes: res.motes, lit_lanterns: res.lit, sim_ticks: res.sim_ticks, state: res.state },
    peak_mem_note: process.platform === 'darwin' ? 'macOS: current RSS of the browser processes at the end (lower bound)' : 'sum of the peak resident set of every browser process of this run',
    thresholds: { avg_fps: 60, p1_low_fps: 30, load_ms: 10000 },
    slowest_frames: res.slowest, // [seconds since the bench started, dt ms]
  };
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`bench: avg ${report.avg_fps} FPS, 1% low ${report.p1_low_fps} FPS, p95 ${report.frame_ms_p95} ms, ${report.frames} frames, load ${report.load_ms} ms, peak ${peak} MB -> ${out}`);
  await finish(0);
} catch (e) {
  console.error(`bench failed: ${e.message}`);
  await finish(1);
}
