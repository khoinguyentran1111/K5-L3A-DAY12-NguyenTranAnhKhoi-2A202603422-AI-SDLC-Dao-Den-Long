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
if (typeof WebSocket === 'undefined') {
  console.log(`SKIP: needs Node >= 22 (global WebSocket); this is Node ${process.version}`);
  process.exit(3);
}
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
  // On GitHub Actions, surface failures as annotations (readable without downloading logs).
  if (!ok && process.env.GITHUB_ACTIONS) console.log(`::error title=browser-check::${name} ${detail}`.replace(/\n/g, ' '));
};

const port = 5600 + Math.floor(Math.random() * 300);
const dbg = 9400 + Math.floor(Math.random() * 300);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-browser-'));
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(port), NO_OPEN: '1' } });
await new Promise((r) => server.stdout.once('data', r));
const flags = [
  '--headless=new', '--enable-unsafe-swiftshader', '--hide-scrollbars', '--no-first-run',
  '--window-size=1280,720', `--remote-debugging-port=${dbg}`, `--user-data-dir=${tmp}`,
];
if (process.env.BROWSER_GPU) {
  // measure with the real GPU (FPS requirement); ANGLE on D3D11 (Windows) / Metal (macOS) / GL (Linux)
  flags.push('--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu');
  if (process.platform === 'win32') flags.push('--use-angle=d3d11');
} else if (process.platform !== 'darwin') flags.push('--use-angle=swiftshader'); // software WebGL (no GPU needed)
if (process.platform === 'linux') flags.push('--no-sandbox'); // Ubuntu 24.04 CI blocks Chrome's user-namespace sandbox
const chrome = spawn(browserPath, [...flags, 'about:blank'], { stdio: 'ignore' });

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
  for (let i = 0; i < 100 && !targets; i++) {
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

  const D = 'window.__ddl';
  const press = (code) => hold(code, 60);

  // 1. Main menu -> night intro (Ông Đăng) -> play Night 1   (F3)
  await send('Page.navigate', { url: `http://localhost:${port}/` });
  const loaded = await waitFor('!!window.__ddl', 30000);
  const webgl = await evaluate("!!document.createElement('canvas').getContext('webgl2')");
  check('page loads and WebGL is available', loaded && webgl, `loaded=${loaded} webgl2=${webgl} errors=${consoleErrors.slice(0, 2).join(' | ')}`);
  if (!loaded) throw new Error('client did not start');
  check('main menu is shown first', await waitFor(`${D}.screen === 'menu'`));
  await press('Enter');
  check('Enter -> night intro with the island name and Ông Đăng', await waitFor(`${D}.screen === 'intro' && /Đảo Bến/.test(document.getElementById('card').textContent) && /Ông Đăng/.test(document.getElementById('card').textContent)`));
  await shot('p2_intro');
  await press('Enter');
  check('Enter -> playing Night 1', await waitFor(`${D}.mode === 'playing' && ${D}.game.night === 1 && ${D}.screen === null`));

  // 2. real key presses through the input mapping (yaw 0: W = +Z, D = screen-right = -X)
  const moveWhile = async (code, cond) => {
    await key(code, 'keyDown');
    const ok = await waitFor(cond, 10000);
    await key(code, 'keyUp');
    await sleep(100);
    return ok;
  };
  const p0 = await evaluate(`({...${D}.game.player})`);
  const wOk = await moveWhile('KeyW', `${D}.game.player.z - ${p0.z} > 1.5`);
  const p1 = await evaluate(`({...${D}.game.player})`);
  check('W moves Mây forward (+Z)', wOk && Math.abs(p1.x - p0.x) < 0.3, `dz=${(p1.z - p0.z).toFixed(2)}`);
  const dOk = await moveWhile('KeyD', `${D}.game.player.x - ${p1.x} < -1`);
  check('D moves Mây to screen-right (-X at yaw 0)', dOk);
  await key('Space', 'keyDown');
  check('Space makes Mây jump', await waitFor(`${D}.game.player.y > 0.3`, 3000));
  await key('Space', 'keyUp');
  await sleep(1200);
  const dz0 = await evaluate(`${D}.game.player.z`);
  await press('ShiftLeft');
  check('Shift dashes (dash cooldown starts)', await waitFor(`${D}.game.player.dashCd > 0`, 3000), `dz=${((await evaluate(`${D}.game.player.z`)) - dz0).toFixed(2)}`);
  await waitFor(`${D}.game.player.dashTicks === 0`, 3000); // let the dash finish before teleporting Mây below

  // 3. HUD layout and values   (F7)
  const hud = await evaluate(`(() => { const g = ${D}.game; const t = (id) => document.getElementById(id).textContent;
    const r = (id) => document.getElementById(id).getBoundingClientRect(); const W = innerWidth, H = innerHeight;
    const tl = Math.ceil(g.timeStart - g.simTick / 60 - 1e-9);
    return {
      flames: document.querySelectorAll('.flame:not(.out)').length === g.player.flames,
      flamesTopLeft: r('flames').left < W * 0.25 && r('flames').top < H * 0.2,
      clock: t('clock') === String(Math.floor(tl / 60)).padStart(2, '0') + ':' + String(tl % 60).padStart(2, '0'),
      clockTopCenter: Math.abs((r('clock').left + r('clock').right) / 2 - W / 2) < 40 && r('clock').top < H * 0.15,
      lamps: t('lamps') === g.lanterns.filter(l => l.lit).length + '/' + g.lanterns.length,
      score: t('score') === String(g.score),
      topRight: r('lamps').right > W * 0.75 && r('score').top < H * 0.25,
      moteBar10: document.querySelectorAll('.mote-cell').length === 10 && document.querySelectorAll('.mote-cell.on').length === g.player.carried,
      barBottomCenter: Math.abs((r('moteBar').left + r('moteBar').right) / 2 - W / 2) < 40 && r('moteBar').bottom > H * 0.85,
      cooldownsBottomRight: r('cdDash').left > W * 0.7 && r('cdPulse').bottom > H * 0.8,
    }; })()`);
  check('HUD values and positions match the sim (flames TL, clock TC, lamps+score TR, 10-cell bar BC, cooldowns BR)', hud && Object.values(hud).every(Boolean), JSON.stringify(hud));
  await evaluate(`(() => { const g = ${D}.game; g.player.x = 0; g.player.z = 23.5; })()`);
  const promptOk = await waitFor(`!document.getElementById('prompt').hidden && document.getElementById('prompt').textContent.includes('Nạp ánh sáng (0/10)')`, 3000);
  const dbgState = async () => JSON.stringify(await evaluate(`(() => { const g = ${D}.game, P = g.player; return { mode: ${D}.mode, screen: ${D}.screen, paused: g.paused, state: g.state, fallen: P.fallen, pos: [P.x, P.y, P.z].map(v => +v.toFixed(2)), prompt: document.getElementById('prompt').textContent }; })()`));
  check('prompt "E — Nạp ánh sáng (x/10)" near an unlit lantern', promptOk, promptOk ? '' : await dbgState());
  check('ambient light = 0.15 with no lantern lit (F9)', Math.abs((await evaluate(`${D}.ambient`)) - 0.15) < 1e-9);
  await shot('browser_playing');
  // deterministic camera: Mây at (0,0,12); yaw 0 -> camera at z=3 sees L1 (z=25) ahead; yaw 180 -> camera at z=21, L1 is 4 m behind it
  await evaluate(`(() => { const g = ${D}.game; g.player.x = 0; g.player.z = 12; ${D}.setCamYaw(0); })()`);
  const arrowHiddenAhead = await waitFor(`document.getElementById('arrow').hidden`, 3000);
  await evaluate(`${D}.setCamYaw(180)`);
  const arrowOk = await waitFor(`!document.getElementById('arrow').hidden`, 3000);
  check('arrow hidden while the nearest unlit lantern is on screen, shown when it is behind the camera', arrowHiddenAhead && arrowOk, arrowOk ? '' : await dbgState());

  // 4. pause: logic stops completely; menu has the 4 entries   (F4)
  await press('Escape');
  check('Esc pauses: pause menu with Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu', await waitFor(`${D}.screen === 'pause' && ${D}.game.paused && ['btnResume','btnRestart','btnPauseSettings','btnMenu'].every(id => document.getElementById(id))`));
  const st0 = await evaluate(`${D}.game.simTick`);
  const tk0 = await evaluate(`${D}.game.tick`);
  await sleep(800);
  check('while paused sim_tick is frozen but ticks still advance', (await evaluate(`${D}.game.simTick`)) === st0 && (await evaluate(`${D}.game.tick`)) > tk0);
  await shot('p2_pause');
  await press('Enter');
  check('Enter / Tiếp tục resumes', await waitFor(`!${D}.game.paused && ${D}.screen === null && ${D}.game.simTick > ${st0}`));

  // 5. settings persist across reloads   (F5)
  await press('KeyP');
  await waitFor(`${D}.screen === 'pause'`);
  await evaluate("document.getElementById('btnPauseSettings').click()");
  await waitFor(`${D}.screen === 'settings'`);
  await evaluate("(() => { const v = document.getElementById('vol'); v.value = '0.35'; v.dispatchEvent(new Event('input')); const s = document.getElementById('sens'); s.value = '1.7'; s.dispatchEvent(new Event('input')); })()");
  await send('Page.reload', {});
  await sleep(500);
  await waitFor('!!window.__ddl', 30000);
  const saved = await evaluate(`${D}.settings`);
  check('volume and mouse sensitivity are saved between sessions', saved && Math.abs(saved.volume - 0.35) < 1e-9 && Math.abs(saved.sensitivity - 1.7) < 1e-9, JSON.stringify(saved));

  // 5b. Ticket-03 visuals: fuel bar, 1 Hz blinking, no safe ring when weak, deflated + torn unlit
  //     lantern, drain beam, refuel prompt, capacity bar, colour-blind palette (persisted)
  await open('?scenario=ui_p3_fuel&live');
  await waitFor(`${D}.lanternView('L1').fuelBar.visible`, 5000);
  const lv = async () => evaluate(`(() => { const v = (id) => ${D}.lanternView(id); return {
    barL2: v('L2').fuelBar.visible, fillL2: +v('L2').barFill.scale.x.toFixed(2), fuelL2: ${D}.game.lanterns[1].fuel / 6000,
    safeL1: v('L1').safe.visible, safeL2: v('L2').safe.visible, k: v('L1').blinkK,
    l3: [v('L3').body.scale.x, v('L3').body.scale.y, v('L3').tearGroup.visible, v('L3').fuelBar.visible, v('L3').pips.filter(p => p.visible).length],
    l2: [v('L2').body.scale.x, v('L2').body.scale.y, v('L2').tearGroup.visible],
    beam: !!(${D}.shadeView('S1') && ${D}.shadeView('S1').beam.visible), s1: ${D}.game.shades[0].state,
    prompt: document.getElementById('prompt').textContent,
    cells: document.querySelectorAll('.mote-cell').length, count: document.querySelector('.mote-count').textContent,
  }; })()`);
  const v1 = await lv();
  check('lit lantern shows a fuel bar matching its fuel (Ticket-03 §1)', v1.barL2 && Math.abs(v1.fillL2 - v1.fuelL2) < 0.02, JSON.stringify(v1));
  check('weak lantern (fuel < 30) has no safe ring; a strong one keeps it', !v1.safeL1 && v1.safeL2);
  const ks = new Set();
  for (let i = 0; i < 14; i++) {
    ks.add((await lv()).k);
    await sleep(100);
  }
  check('weak lantern blinks (1 Hz)', ks.has(1) && ks.has(0.25), [...ks].join(','));
  check('unlit lantern is deflated by 20 % and torn; it shows the 5 relight pips (ever lit)', v1.l3[0] === 0.8 && v1.l3[1] === 1 && v1.l3[2] && !v1.l3[3] && v1.l3[4] === 5, JSON.stringify(v1.l3));
  check('lit lantern is full size and not torn', v1.l2[0] === 1 && v1.l2[1] === 1.25 && !v1.l2[2]);
  check('draining shade shows a beam to its lantern', v1.beam && v1.s1 === 'drain');
  check('prompt "E — Châm dầu" next to a lit lantern that is not full', /Châm dầu/.test(v1.prompt), v1.prompt);
  check('HUD capacity: 12 cells and "carried/capacity" after one successful light (Ticket-03 §4)', v1.cells === 12 && v1.count === '5/12', `${v1.cells} ${v1.count}`);
  await press('KeyE');
  // fuel ≈ 79.x when E lands -> used = min(5, ceil(20.x / 10)) = 3, fuel back to 100
  const refuelOk = await waitFor(`${D}.game.player.carried === 2 && ${D}.game.lanterns[1].fuel > 5900`, 3000);
  check('E (real key) refuels L2 with 3 motes back to 100', refuelOk, JSON.stringify(await evaluate(`[${D}.game.player.carried, ${D}.game.lanterns[1].fuel]`)));
  await shot('p3_fuel');
  await press('Escape');
  await waitFor(`${D}.screen === 'pause'`);
  await evaluate("document.getElementById('btnPauseSettings').click()");
  await waitFor(`${D}.screen === 'settings'`);
  await evaluate("(() => { const c = document.getElementById('cb'); c.checked = true; c.dispatchEvent(new Event('change')); })()");
  await send('Page.reload', {});
  await sleep(500);
  await waitFor(`!!(window.__ddl && ${D}.shadeView('S1'))`, 30000);
  const cb = await evaluate(`(() => ({ saved: ${D}.settings.colorblind, body: document.body.classList.contains('cb'),
    rim: '#' + ${D}.shadeView('S1').rimMat.color.getHexString(), eye: '#' + ${D}.shadeView('S1').eyeMat.color.getHexString(),
    danger: getComputedStyle(document.body).getPropertyValue('--danger').trim() }))()`);
  check('colour-blind palette is saved and applied: rim/eyes #00B3FF, warnings #FFFFFF (Ticket-03 §6)', cb.saved && cb.body && cb.rim === '#00b3ff' && cb.eye === '#00b3ff' && /^#fff(fff)?$/i.test(cb.danger), JSON.stringify(cb));
  await shot('p3_colorblind');
  await evaluate(`(() => { const s = ${D}.settings; s.colorblind = false; localStorage.setItem('dao-den-long.settings.v1', JSON.stringify(s)); })()`);

  // 6. win a night at dawn -> result -> next night intro -> Night 2   (F3, Ticket-03 §3)
  await open('?scenario=p3_08_dawn_win_night1');
  check('replay p3_08 wins Night 1 at dawn with 447 points like headless', await waitFor(`${D}.game.state === 'won' && ${D}.game.reason === 'dawn_survived' && ${D}.game.score === 447`));
  await open('?scenario=ui_n1_dawn');
  check('ambient light reaches 0.7 when every lantern is lit (F9)', await waitFor(`Math.abs(${D}.ambient - 0.7) < 1e-9`, 3000));
  check('all lanterns lit does not end the night early', (await evaluate(`${D}.game.state`)) === 'playing');
  check('result screen after a won night offers "Đêm kế tiếp"', await waitFor(`${D}.screen === 'result' && ${D}.game.reason === 'dawn_survived' && !!document.getElementById('btnNext')`));
  await shot('p3_result_won');
  const n1 = await evaluate(`${D}.game.score`);
  await evaluate("document.getElementById('btnNext').click()");
  check('-> intro of Night 2 (Đảo Cau)', await waitFor(`${D}.screen === 'intro' && /Đảo Cau/.test(document.getElementById('card').textContent)`));
  await press('Enter');
  check('-> playing Night 2 with 6 lanterns, total score carried over', await waitFor(`${D}.mode === 'playing' && ${D}.game.night === 2 && ${D}.game.lanterns.length === 6 && ${D}.campaign.total === ${n1}`));
  await shot('p2_night2');

  // 7. lose -> retry the same night
  await open('?scenario=p2_r04_dawn');
  const red = await waitFor(`document.getElementById('clock').classList.contains('danger')`, 5000);
  check('replay p2_r04 loses at dawn; clock is red (≤ 30 s)', red && (await waitFor(`${D}.game.state === 'lost' && ${D}.game.reason === 'dawn'`)));
  check('result screen after a loss offers "Chơi lại Đêm"', await waitFor(`${D}.screen === 'result' && !!document.getElementById('btnRetry')`));
  const before = await evaluate(`${D}.gamesStarted`);
  await press('Enter');
  check('Enter replays the same night', await waitFor(`${D}.gamesStarted === ${before + 1} && ${D}.mode === 'playing' && ${D}.game.night === 1`));

  // 8. win Night 3 -> Dawn screen with the total score
  await open('?scenario=ui_n3_win&night=3&seed=1');
  check('winning Night 3 shows the Dawn (Bình Minh) screen with the total', await waitFor(`${D}.screen === 'dawn' && document.getElementById('dawnTotal').textContent === String(${D}.campaign.total) && ${D}.campaign.total === ${D}.game.score`, 20000));
  await shot('p2_dawn');

  // 9. FPS during normal play at 1280x720 on this machine's renderer
  await open('?autostart&night=3&seed=5');
  await key('KeyW', 'keyDown');
  await sleep(1500);
  const samples = [];
  for (let i = 0; i < 6; i++) {
    await sleep(500);
    samples.push(await evaluate(`${D}.fps`));
  }
  await key('KeyW', 'keyUp');
  const avg = samples.reduce((x, y) => x + y, 0) / samples.length;
  log(`INFO  average FPS (Night 3, 1280x720, ${process.env.BROWSER_GPU ? 'GPU' : 'software renderer'}): ${avg.toFixed(1)} [${samples.join(', ')}]`);
  if (process.env.REQUIRE_FPS) check(`average FPS >= ${process.env.REQUIRE_FPS}`, avg >= Number(process.env.REQUIRE_FPS), avg.toFixed(1));

  // A scenario without inputs.json / expect.json is legal (UI-only scenarios); its 404 is expected.
  const realErrors = consoleErrors.filter((e) => !/404.*\/scenarios\/[\w-]+\/(inputs|expect)\.json/.test(e));
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
