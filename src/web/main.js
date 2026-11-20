// Browser client: the 3-night campaign around the shared simulation (src/core/sim.js).
// Logic runs at a fixed 60 ticks/s exactly like headless; this file turns keyboard/mouse into
// contract-style inputs (incl. dash and pause) and draws the state with the Ticket-02 palette
// (Ticket-03: fuel bars, low-fuel blinking, deflated/torn unlit lanterns, colour-blind mode).
import * as THREE from 'three';
import { createGame, createBenchGame, step, timeLeft, ambientIntensity, TICK_RATE, WORLD, capacityOf, litNeeded, fuelOut } from '../core/sim.js';
import { benchStats, benchCamera } from './benchstats.js';
import { getNight } from '../core/maps.js';
import { PALETTE } from './palette.js';
import { buildWorld } from './world.js';
import { loadSettings, saveSettings, ACTIONS, DEFAULT_KEYS, keyConflict, keyLabel } from './settings.js';
import { nameError, makeEntry, insertEntry, sanitize } from '../core/leaderboard.js';
import { unlockAudio, setVolume, startMusic, sfx } from './audio.js';

const tuning = (await (await fetch('/game.contract.json')).json()).tuning;
const params = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
let settings = loadSettings();
setVolume(settings.volume);
const applyLook = () => {
  document.body.classList.toggle('cb', !!settings.colorblind); // Ticket-03 §6
  document.documentElement.classList.toggle('large', !!settings.largeText); // Ticket-04 §4: text ×1.25
};
applyLook();
const rimColor = () => (settings.colorblind ? PALETTE.shadeRimCB : PALETTE.shadeRim);

// ---------------------------------------------------------------- renderer
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.sky);
scene.fog = new THREE.FogExp2(PALETTE.fog, 0.014);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
const hemi = new THREE.HemisphereLight('#c9d2ff', PALETTE.grass, ambientIntensity(0, 5));
const moon = new THREE.DirectionalLight('#b9c4ff', 0.45);
moon.position.set(-30, 60, -20);
scene.add(hemi, moon);
function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- story (Ông Đăng)
const INTRO = {
  1: { quote: 'Mây à, sương đen đã phủ kín Bến. Gom đom đóm thắp đèn, rồi giữ cho đèn cháy tới bình minh nhé. Đèn nào cạn dầu thì Bóng Mực sẽ kéo tới hút cạn.', tips: ['Đứng cạnh đèn đang sáng và nhấn E để châm dầu. Đèn dưới 30 dầu sẽ nhấp nháy và mất vòng sáng bảo vệ.', 'Bình minh cần ít nhất 3/5 đèn còn sáng. Mỗi lần thắp đèn, Mây mang được thêm 2 đom đóm.', 'Shift để lướt, F để tỏa sáng (tốn 3 đom đóm). Mép đảo là biển mây.'] },
  2: { quote: 'Hai hòn Cau nối nhau bằng cây cầu tre không lan can. Bục nhảy vàng sẽ đưa con qua biển mây. Coi chừng Gió Lạc, chúng mê đom đóm lắm.', tips: ['Cần 4/6 đèn còn sáng lúc bình minh: đèn hai đảo phải chăm cả hai.', 'Gió Lạc (dải lụa xám xanh) cướp đom đóm khi con mang từ 5 con trở lên. Tỏa sáng để đòi lại.', 'Bùa Gió đỏ trên cầu giúp con chạy nhanh và lướt liên tục.'] },
  3: { quote: 'Đảo Chuông có ba tầng. Leo dốc lên tầng giữa, đứng lên bục để tới đỉnh tháp. Gió ở đây mạnh lắm, nghe lá xào xạc là phải đứng vững, con nhé.', tips: ['Cần 5/7 đèn còn sáng lúc bình minh.', 'Bóng Mực ở đây nhanh hơn (4.5 m/s). Tỏa sáng trúng con đang hút dầu được +15.', 'Mỗi 30 giây có một cơn gió kéo dài 5 giây.'] },
};

// ---------------------------------------------------------------- Mây
function buildMay() {
  const g = new THREE.Group();
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.5, 1.0, 16), new THREE.MeshLambertMaterial({ color: PALETTE.mayRobe }));
  robe.position.y = 0.5;
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.08, 8, 20), new THREE.MeshLambertMaterial({ color: PALETTE.mayScarf }));
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 1.02;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.04), scarf.material);
  tail.position.set(0.12, 0.85, -0.28);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 20, 16), new THREE.MeshLambertMaterial({ color: '#f1d1b5' }));
  head.position.y = 1.28;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.78, 0.38, 28, 1, true), new THREE.MeshLambertMaterial({ color: PALETTE.sand, side: THREE.DoubleSide }));
  hat.position.y = 1.58;
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 12), new THREE.MeshBasicMaterial({ color: PALETTE.lanternLit }));
  lamp.scale.y = 1.25;
  lamp.position.set(0, 1.05, 0.68);
  const light = new THREE.PointLight(PALETTE.lanternLit, 1.4, 10, 1.6);
  light.position.copy(lamp.position);
  g.add(robe, scarf, tail, head, hat, lamp, light);
  g.userData = { light };
  return g;
}
const may = buildMay();
scene.add(may);
// Creativity (Phase 1, kept): carried fireflies orbit Mây.
const orbitMat = new THREE.MeshBasicMaterial({ color: PALETTE.moteCore });
const orbiters = Array.from({ length: tuning.capacity_max }, () => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), orbitMat);
  scene.add(m);
  return m;
});

// ---------------------------------------------------------------- entity views
const moteGeo = new THREE.SphereGeometry(0.13, 10, 8);
const moteCoreMat = new THREE.MeshBasicMaterial({ color: PALETTE.moteCore });
const haloGeo = new THREE.SphereGeometry(0.34, 10, 8);
const haloMat = new THREE.MeshBasicMaterial({ color: PALETTE.moteHalo, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending });
const buildMote = () => {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(moteGeo, moteCoreMat), new THREE.Mesh(haloGeo, haloMat));
  return g;
};
const shadeGeo = new THREE.SphereGeometry(0.75, 20, 16);
const rimGeo = new THREE.SphereGeometry(0.82, 20, 16);
const eyeGeo = new THREE.SphereGeometry(0.11, 8, 6);
function buildShade() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: PALETTE.shadeBody });
  const body = new THREE.Mesh(shadeGeo, bodyMat);
  const rimMat = new THREE.MeshBasicMaterial({ color: rimColor(), side: THREE.BackSide });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  body.scale.set(1, 1.15, 1);
  rim.scale.set(1, 1.15, 1);
  const eyeMat = new THREE.MeshBasicMaterial({ color: rimColor() });
  const e1 = new THREE.Mesh(eyeGeo, eyeMat);
  const e2 = new THREE.Mesh(eyeGeo, eyeMat);
  e1.position.set(-0.25, 0.2, 0.66);
  e2.position.set(0.25, 0.2, 0.66);
  g.add(rim, body, e1, e2);
  // drain beam (Ticket-03 §2): a thin line from the shade to the lantern it is draining
  const beam = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: rimColor(), transparent: true, opacity: 0.8 }));
  beam.visible = false;
  beam.frustumCulled = false;
  scene.add(beam);
  g.userData = { bodyMat, eyeMat, rimMat, beam };
  return g;
}
const drifterMat = new THREE.MeshLambertMaterial({ color: PALETTE.drifter, side: THREE.DoubleSide, transparent: true, opacity: 0.9, emissive: '#2a3340' });
function buildDrifter() {
  const segs = Array.from({ length: 6 }, (_, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9 - i * 0.1, 0.3), drifterMat);
    scene.add(m);
    return m;
  });
  return { segs, trail: [] };
}
function buildCharm() {
  const g = new THREE.Group();
  const card = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.04), new THREE.MeshLambertMaterial({ color: PALETTE.charm, emissive: '#3a0008' }));
  const rim = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.83, 0.03), new THREE.MeshBasicMaterial({ color: PALETTE.gold }));
  g.add(rim, card);
  return g;
}
const pulseRing = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 64), new THREE.MeshBasicMaterial({ color: PALETTE.lanternCore, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
pulseRing.rotation.x = -Math.PI / 2;
scene.add(pulseRing);

// ---------------------------------------------------------------- session state
const newSeed = () => (params.has('seed') ? Number(params.get('seed')) : (Date.now() ^ (Math.random() * 1e9)) >>> 0);
const campaign = { night: 1, total: 0, scores: {}, seed: newSeed(), saved: false };
let g = null;
let mode = 'menu'; // menu | intro | playing | result | dawn
let screenKind = 'menu';
let world = null;
let gamesStarted = 0;
const views = { motes: new Map(), shades: new Map(), drifters: new Map(), charms: new Map() };
let pulseT = 1;
let camYaw = 0;
let lastBeep = null;
let windWarned = -1;

let replay = null;
if (params.has('scenario')) {
  const name = params.get('scenario').replace(/[^\w-]/g, '');
  const get = async (f) => {
    const r = await fetch(`/scenarios/${name}/${f}`);
    return r.ok ? r.json() : null;
  };
  const expect = await get('expect.json');
  replay = {
    scenario: (await get('scenario.json')) || {},
    inputs: (await get('inputs.json')) || { frames: [] },
    night: Number(params.get('night') || expect?.args?.night || 1),
    seed: Number(params.get('seed') || expect?.args?.seed || 1),
    live: params.has('live'), // scenario set-up, but played with the real keyboard
  };
}

function clearViews() {
  for (const v of [...views.motes.values(), ...views.shades.values(), ...views.charms.values()]) {
    scene.remove(v);
    if (v.userData.beam) scene.remove(v.userData.beam);
  }
  for (const d of views.drifters.values()) d.segs.forEach((s) => scene.remove(s));
  for (const m of Object.values(views)) m.clear();
}

function startNight(n) {
  gamesStarted++;
  campaign.night = n;
  clearViews();
  if (world) scene.remove(world.group);
  const map = getNight(n);
  world = buildWorld(map, tuning);
  scene.add(world.group);
  const useReplay = replay && replay.night === n;
  // a campaign has one seed (stored on the leaderboard); night n plays seed + n − 1 (assumption E8)
  const seed = useReplay ? replay.seed : params.has('seed') ? Number(params.get('seed')) : (campaign.seed + n - 1) >>> 0;
  g = createGame({ tuning, seed, night: n, scenario: useReplay ? replay.scenario : {} });
  if (useReplay) {
    replay.cur = { move: [0, 0], cam_yaw_deg: 0 };
    replay.fi = 0;
  }
  camYaw = 0;
  const P0 = g.player;
  camera.position.set(P0.x, P0.y + 5, P0.z - 9); // start right behind Mây (yaw 0 looks along +Z)
  camera.lookAt(P0.x, P0.y + 1.3, P0.z);
  camera.updateMatrixWorld();
  lastBeep = null;
  windWarned = -1;
  weakSeen = new Set();
  threats.length = 0;
  $('captions').innerHTML = '';
  $('threats').innerHTML = '';
  mode = 'playing';
  hideScreen();
  $('hud').hidden = false;
  $('nightLabel').textContent = `Đêm ${n} · ${map.name}`;
  buildMoteBar();
  startMusic();
}

// ---------------------------------------------------------------- benchmark scene (Ticket-04 §1)
// /?bench&seed=42&duration=30&warmup=3 : Night 1 with full lighting/effects, 200 wandering shades,
// 100 motes, L1–L3 lit at 100 (src/core/sim.js createBenchGame). No player input; the camera
// orbits (benchCamera). Frame times are recorded after the warm-up; the result is published on
// window.__benchResult for scripts/bench.mjs. Creative extras (Ông Đăng, music, captions) are off.
const bench = params.has('bench')
  ? { seed: Number(params.get('seed') || 42), duration: Number(params.get('duration') || 30), warmup: Number(params.get('warmup') ?? 3), t0: null, last: null, dts: [], at: [], firstFrameEpoch: null }
  : null;
function startBench() {
  gamesStarted++;
  clearViews();
  if (world) scene.remove(world.group);
  world = buildWorld(getNight(1), tuning);
  scene.add(world.group);
  g = createBenchGame({ tuning, seed: bench.seed });
  mode = 'bench';
  hideScreen();
  $('hud').hidden = false;
  $('nightLabel').textContent = 'Benchmark · Đêm 1 · Đảo Bến';
  buildMoteBar();
}
function benchFrame(now) {
  if (bench.t0 === null) {
    bench.t0 = now;
    bench.last = now;
    return;
  }
  const t = (now - bench.t0) / 1000;
  const dt = now - bench.last;
  bench.last = now;
  if (t > bench.warmup && t <= bench.warmup + bench.duration) {
    bench.dts.push(dt);
    bench.at.push(+t.toFixed(3));
  }
  if (t > bench.warmup + bench.duration && !window.__benchResult) {
    const gl = renderer.getContext();
    const dbgInfo = gl.getExtension('WEBGL_debug_renderer_info');
    window.__benchResult = {
      ...benchStats(bench.dts),
      first_frame_epoch_ms: bench.firstFrameEpoch,
      gpu: dbgInfo ? gl.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      three: THREE.REVISION,
      webgl2: renderer.capabilities.isWebGL2,
      canvas: [renderer.domElement.width, renderer.domElement.height],
      pixel_ratio: renderer.getPixelRatio(),
      shades: g.shades.length, motes: g.motes.length, lit: g.lanterns.filter((L) => L.lit).map((L) => L.id),
      sim_ticks: g.tick, state: g.state,
      slowest: bench.dts.map((d, i) => [bench.at[i], +d.toFixed(1)]).sort((a, b) => b[1] - a[1]).slice(0, 12),
    };
  }
}

// ---------------------------------------------------------------- screens
const screenEl = $('screen');
const card = $('card');
let primaryAction = null;
function hideScreen() {
  screenEl.hidden = true;
  primaryAction = null;
}
function showScreen(kind, html, actions) {
  screenKind = kind;
  card.innerHTML = html;
  screenEl.hidden = false;
  primaryAction = actions[0]?.[1] ?? null;
  const btns = document.createElement('div');
  btns.className = 'btns';
  actions.forEach(([label, fn, id], i) => {
    const b = document.createElement('button');
    b.className = `btn${i === 0 ? ' primary' : ''}`;
    b.textContent = label;
    if (id) b.id = id;
    b.addEventListener('click', () => {
      unlockAudio();
      sfx.ui();
      fn();
    });
    btns.appendChild(b);
  });
  card.appendChild(btns);
}

function showMenu() {
  mode = 'menu';
  $('hud').hidden = true;
  campaign.total = 0;
  campaign.scores = {};
  campaign.seed = newSeed();
  campaign.saved = false;
  const K = (a) => `<kbd>${keyLabel(settings.keys[a])}</kbd>`;
  showScreen('menu', `
    <h1>Đảo Đèn Lồng</h1>
    <h2>Ba hòn đảo · ba đêm</h2>
    <p>Sương đen đã nuốt ánh sáng của ba hòn đảo giữa biển mây. Giúp Mây, người giữ đèn nhỏ tuổi, gom đom đóm thắp các Đèn Lồng Lớn và <b>giữ cho đảo còn sáng tới bình minh</b>: đèn cạn dầu sẽ tắt, Bóng Mực thì rình hút dầu.</p>
    <ul>
      <li>${K('up')}${K('left')}${K('down')}${K('right')} đi · ${K('jump')} nhảy · ${K('dash')} lướt · ${K('interact')} thắp / châm dầu · ${K('pulse')}/chuột trái tỏa sáng</li>
      <li>Kéo chuột hoặc <kbd>←</kbd><kbd>→</kbd> xoay camera · ${K('pause')} tạm dừng · đổi phím trong Cài đặt</li>
    </ul>
    <p class="hint">Nhấn Enter để bắt đầu</p>`, [['Bắt đầu', () => showIntro(1), 'btnStart'], ['Bảng xếp hạng', () => showBoard(showMenu), 'btnBoard'], ['Cài đặt', () => showSettings(showMenu), 'btnSettings']]);
}

function showIntro(n) {
  mode = 'intro';
  $('hud').hidden = true;
  const map = getNight(n);
  showScreen('intro', `
    <h2>Đêm ${n}</h2>
    <h1>${map.name}</h1>
    <p class="quote">“${INTRO[n].quote}”<br><small>Ông Đăng, người giữ đèn già</small></p>
    <ul>${INTRO[n].tips.map((t) => `<li>${t}</li>`).join('')}</ul>
    <p class="hint">${map.lanterns.length} Đèn Lồng Lớn · cần ${litNeeded(tuning, map.lanterns.length)} đèn còn sáng lúc bình minh · ${tuning[map.durationKey]} giây</p>`, [['Vào Đêm', () => startNight(n), 'btnPlay'], ['Về menu', showMenu]]);
}

function showPause() {
  showScreen('pause', '<h1>Tạm dừng</h1><p>Logic game đang dừng hoàn toàn.</p>', [
    ['Tiếp tục', () => (latched.pause = true), 'btnResume'],
    ['Chơi lại Đêm', () => startNight(campaign.night), 'btnRestart'],
    ['Cài đặt', () => showSettings(showPause), 'btnPauseSettings'],
    ['Về menu', showMenu, 'btnMenu'],
  ]);
}

function showSettings(back) {
  const keyRows = ACTIONS.map(([a, label]) => `<div class="row key-row"><label for="key_${a}">${label}</label><button class="btn keybtn" data-action="${a}" id="key_${a}">${keyLabel(settings.keys[a])}</button></div>`).join('');
  const chk = (id, on, label, hint = '') => `<div class="row"><label for="${id}">${label}</label><input id="${id}" type="checkbox" ${on ? 'checked' : ''}>${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
  showScreen('settings', `
    <h1>Cài đặt</h1>
    <div class="settings-grid"><section>
      <div class="row"><label for="vol">Âm lượng</label><input id="vol" type="range" min="0" max="1" step="0.05" value="${settings.volume}"><span id="volV">${Math.round(settings.volume * 100)}%</span></div>
      <div class="row"><label for="sens">Độ nhạy chuột</label><input id="sens" type="range" min="0.2" max="3" step="0.1" value="${settings.sensitivity}"><span id="sensV">${settings.sensitivity.toFixed(1)}×</span></div>
      ${chk('cb', settings.colorblind, 'Bảng màu dễ phân biệt', 'Bóng Mực viền xanh, cảnh báo trắng kèm ⚠')}
      ${chk('cap', settings.captions, 'Phụ đề và chỉ báo', 'Bóng Mực xuất hiện, gió, 10 giây cuối, đèn sắp cạn')}
      ${chk('rm', settings.reducedMotion, 'Giảm chuyển động', 'tắt rung camera và chớp màn hình')}
      ${chk('lt', settings.largeText, 'Chữ lớn (×1.25)')}
    </section><section>
      <h2>Đổi phím</h2>${keyRows}
      <p id="keyMsg" class="hint" role="status">Bấm vào một ô rồi nhấn phím mới. <kbd>←</kbd><kbd>→</kbd> xoay camera, <kbd>Enter</kbd> để chọn.</p>
      <button class="btn" id="btnKeysReset">Khôi phục mặc định</button>
    </section></div>
    <p class="hint">Cài đặt được lưu lại cho những lần mở game sau.</p>`, [['Quay lại', () => { keyCapture = null; back(); }, 'btnBack']]);
  const save = () => {
    settings = {
      ...settings, volume: Number($('vol').value), sensitivity: Number($('sens').value), colorblind: $('cb').checked,
      captions: $('cap').checked, reducedMotion: $('rm').checked, largeText: $('lt').checked,
    };
    applyLook();
    $('volV').textContent = `${Math.round(settings.volume * 100)}%`;
    $('sensV').textContent = `${settings.sensitivity.toFixed(1)}×`;
    setVolume(settings.volume);
    saveSettings(settings);
  };
  $('vol').addEventListener('input', save);
  $('sens').addEventListener('input', save);
  for (const id of ['cb', 'cap', 'rm', 'lt']) $(id).addEventListener('change', save);
  // key rebinding: one key per action; duplicates and reserved keys are refused with a message
  const msg = (text, warn = false) => {
    $('keyMsg').textContent = text;
    $('keyMsg').className = warn ? 'warn' : 'hint';
  };
  const relabel = () => ACTIONS.forEach(([a]) => {
    const b = $(`key_${a}`);
    b.textContent = keyLabel(settings.keys[a]);
    b.classList.remove('capturing');
  });
  document.querySelectorAll('.keybtn').forEach((b) => b.addEventListener('click', () => {
    relabel();
    document.querySelectorAll('.keybtn.conflict').forEach((x) => x.classList.remove('conflict'));
    const action = b.dataset.action;
    const label = ACTIONS.find(([a]) => a === action)[1];
    b.textContent = 'Nhấn phím…';
    b.classList.add('capturing');
    msg(`Nhấn phím mới cho “${label}”${action === 'pause' ? '' : ' (Esc để hủy)'}.`);
    keyCapture = (code) => {
      keyCapture = null;
      if (code === 'Escape' && action !== 'pause') {
        relabel();
        return msg('Đã hủy.');
      }
      const c = keyConflict(settings.keys, action, code);
      if (c) {
        relabel();
        if (c.action) $(`key_${c.action}`).classList.add('conflict');
        b.classList.add('conflict');
        return msg(c.reserved ? `⚠ Phím ${keyLabel(code)} dùng để ${c.reserved}, không gán được.` : `⚠ Phím ${keyLabel(code)} đang dùng cho “${c.label}”. Chọn phím khác.`, true);
      }
      settings = { ...settings, keys: { ...settings.keys, [action]: code } };
      saveSettings(settings);
      relabel();
      msg(`Đã đổi: ${label} = ${keyLabel(code)}.`);
    };
  }));
  $('btnKeysReset').addEventListener('click', () => {
    keyCapture = null;
    settings = { ...settings, keys: { ...DEFAULT_KEYS } };
    saveSettings(settings);
    relabel();
    document.querySelectorAll('.keybtn.conflict').forEach((x) => x.classList.remove('conflict'));
    msg('Đã khôi phục phím mặc định.');
  });
}

// ---------------------------------------------------------------- leaderboard (Ticket-04 §3)
// Saved by the local server on the disk (data/leaderboard.json). The static web build has no
// server, so it falls back to this browser's storage (assumption E10).
const LB_LOCAL = 'dao-den-long.leaderboard.v1';
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
async function loadBoard() {
  try {
    const r = await fetch('/api/leaderboard');
    if (r.ok) return { entries: (await r.json()).entries, where: 'disk' };
  } catch {
    /* no server */
  }
  try {
    return { entries: sanitize(JSON.parse(localStorage.getItem(LB_LOCAL) || '[]')), where: 'browser' };
  } catch {
    return { entries: [], where: 'none' };
  }
}
async function saveScore(name) {
  const body = { name, score: campaign.total, nights_won: Object.keys(campaign.scores).length, seed: campaign.seed };
  try {
    const r = await fetch('/api/leaderboard', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (r.ok) return { ok: true, ...(await r.json()) };
    if (r.status === 400) return { ok: false, error: (await r.json()).error };
  } catch {
    /* no server: fall back below */
  }
  try {
    const entry = makeEntry(body);
    const entries = insertEntry(sanitize(JSON.parse(localStorage.getItem(LB_LOCAL) || '[]')), entry);
    localStorage.setItem(LB_LOCAL, JSON.stringify(entries));
    return { ok: true, entries, rank: entries.indexOf(entry) + 1 || null };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
const saveFormHtml = () => (campaign.saved
  ? '<p class="hint">Điểm của chuỗi này đã được lưu vào Bảng xếp hạng.</p>'
  : `<div class="save"><label for="lbName">Lưu ${campaign.total} điểm (${Object.keys(campaign.scores).length}/3 Đêm thắng) vào Bảng xếp hạng:</label>
     <div class="row"><input id="lbName" maxlength="12" autocomplete="off" spellcheck="false" placeholder="Tên: 3–12 ký tự"><button class="btn" id="btnSave">Lưu điểm</button></div>
     <p id="lbMsg" class="hint" role="status">Chữ, số và _ (có dấu tiếng Việt cũng được).</p></div>`);
function wireSaveForm() {
  const input = $('lbName');
  if (!input) return;
  const submit = async () => {
    const err = nameError(input.value);
    if (err) {
      $('lbMsg').className = 'warn';
      $('lbMsg').textContent = `⚠ ${err}`;
      return;
    }
    $('btnSave').disabled = true;
    const r = await saveScore(input.value);
    if (!r.ok) {
      $('lbMsg').className = 'warn';
      $('lbMsg').textContent = `⚠ ${r.error}`;
      $('btnSave').disabled = false;
      return;
    }
    campaign.saved = true;
    input.disabled = true;
    $('lbMsg').className = 'ok';
    $('lbMsg').textContent = r.rank ? `Đã lưu! Hạng ${r.rank} trong top 10.` : 'Đã lưu (chưa vào top 10).';
  };
  $('btnSave').addEventListener('click', submit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      submit();
    }
  });
}
async function showBoard(back) {
  const { entries, where } = await loadBoard();
  const rows = entries.map((e, i) => `<tr><td>${i + 1}</td><td>${esc(e.name)}</td><td>${e.score}</td><td>${e.nights_won}/3</td><td>${esc(e.achieved_at.slice(0, 16).replace('T', ' '))}</td><td>${e.seed}</td></tr>`).join('');
  showScreen('board', `
    <h1>Bảng xếp hạng</h1>
    <table class="board" id="boardTable"><thead><tr><th>#</th><th>Tên</th><th>Điểm</th><th>Đêm thắng</th><th>Thời điểm</th><th>Seed</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="6">Chưa có ai. Hãy là người đầu tiên!</td></tr>'}</tbody></table>
    <p class="hint">${where === 'disk' ? 'Lưu trên đĩa (data/leaderboard.json). Xuất: node scripts/serve.mjs --export-leaderboard out.json' : 'Chế độ web tĩnh: lưu trong trình duyệt này.'}</p>`, [['Quay lại', back, 'btnBack']]);
}

const REASONS = {
  dawn_survived: 'Bình minh lên, đảo vẫn còn sáng.',
  dawn: 'Bình minh lên nhưng chưa đủ đèn còn sáng.',
  no_flames: 'Ngọn Lửa của Mây đã tắt.',
};
function showResult() {
  mode = 'result';
  const n = campaign.night;
  const lit = g.lanterns.filter((L) => L.lit).length;
  const need = litNeeded(tuning, g.lanterns.length);
  if (g.result === 'won') {
    campaign.scores[n] = g.score;
    campaign.total = Object.values(campaign.scores).reduce((a, b) => a + b, 0);
    if (n === 3) return showDawn();
    showScreen('result', `
      <h2>Đêm ${n} · ${getNight(n).name}</h2><h1>Đảo đã sáng!</h1>
      <p>${REASONS.dawn_survived} ${lit}/${g.lanterns.length} đèn còn sáng (cần ${need}), Mây còn ${g.player.flames} Ngọn Lửa.</p>
      <p>Điểm Đêm này: <span class="big">${g.score}</span><br>Tổng: <b>${campaign.total}</b></p>`, [['Đêm kế tiếp', () => showIntro(n + 1), 'btnNext'], ['Về menu', showMenu]]);
  } else {
    showScreen('result', `
      <h2>Đêm ${n} · ${getNight(n).name}</h2><h1>Chưa thành…</h1>
      <p>${REASONS[g.reason] || ''} Còn sáng ${lit}/${g.lanterns.length} đèn (cần ${need}).</p>
      <p class="quote">“Không sao đâu Mây, mình thử lại nhé.” Ông Đăng</p>${saveFormHtml()}`, [['Chơi lại Đêm', () => startNight(n), 'btnRetry'], ['Về menu', showMenu]]);
    wireSaveForm();
  }
}
function showDawn() {
  mode = 'dawn';
  $('hud').hidden = true;
  showScreen('dawn', `
    <h2>Bình Minh</h2><h1>Ba hòn đảo đã sáng trở lại</h1>
    <p class="quote">“Con làm được rồi, Mây. Nghe tiếng chuông kìa: biển mây đang hồng lên.” Ông Đăng</p>
    <p>Đêm 1: ${campaign.scores[1] ?? 0} · Đêm 2: ${campaign.scores[2] ?? 0} · Đêm 3: ${campaign.scores[3] ?? 0}</p>
    <p>Tổng điểm: <span class="big" id="dawnTotal">${campaign.total}</span></p>${saveFormHtml()}`, [['Về menu', showMenu, 'btnMenu'], ['Bảng xếp hạng', () => showBoard(showDawn), 'btnBoard']]);
  wireSaveForm();
}

// ---------------------------------------------------------------- input
const held = new Set();
const latched = { jump: false, interact: false, pulse: false, dash: false, pause: false };
const LATCHED = new Set(['jump', 'interact', 'pulse', 'dash', 'pause']);
const actionOf = (code) => ACTIONS.find(([a]) => settings.keys[a] === code)?.[0];
let keyCapture = null; // set while the settings screen waits for a new key
let dragging = false;
let lastX = 0;

window.addEventListener('keydown', (e) => {
  unlockAudio();
  if (keyCapture) {
    e.preventDefault();
    if (!e.repeat) keyCapture(e.code);
    return;
  }
  if (e.target instanceof HTMLInputElement) return; // typing a name
  if (e.code === 'Space' || e.code === 'Tab' || e.code.startsWith('Arrow') || actionOf(e.code)) e.preventDefault();
  if (e.repeat) return;
  held.add(e.code);
  if (e.code === 'Enter' && !screenEl.hidden && primaryAction && screenKind !== 'settings') {
    sfx.ui();
    primaryAction();
    return;
  }
  if (mode !== 'playing') return;
  if (e.code === settings.keys.pause && !screenEl.hidden && screenKind === 'settings') return showPause();
  const a = actionOf(e.code);
  if (a && LATCHED.has(a)) latched[a] = true;
});
window.addEventListener('keyup', (e) => held.delete(e.code));
window.addEventListener('blur', () => {
  held.clear();
  if (mode === 'playing' && g && !g.paused) latched.pause = true; // auto-pause when the window loses focus
});
canvas.addEventListener('pointerdown', (e) => {
  unlockAudio();
  dragging = true;
  lastX = e.clientX;
  if (e.button === 0 && mode === 'playing' && !g.paused) latched.pulse = true;
});
window.addEventListener('pointerup', () => (dragging = false));
window.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  camYaw -= (e.clientX - lastX) * 0.25 * settings.sensitivity;
  lastX = e.clientX;
});

function currentInput() {
  const K = settings.keys;
  const k = (a) => (held.has(K[a]) ? 1 : 0);
  const input = {
    // Screen-right is world -X at yaw 0 for a camera looking down +Z, so "right" maps to move x = -1.
    move: [k('left') - k('right'), k('up') - k('down')],
    cam_yaw_deg: camYaw,
    jump: held.has(K.jump) || latched.jump,
    interact: held.has(K.interact) || latched.interact,
    pulse: held.has(K.pulse) || latched.pulse,
    dash: held.has(K.dash) || latched.dash,
    pause: latched.pause,
  };
  for (const key of Object.keys(latched)) latched[key] = false;
  return input;
}
function replayInput() {
  const frames = replay.inputs.frames;
  while (replay.fi < frames.length && frames[replay.fi].tick <= g.tick) {
    const { tick: _t, ...fields } = frames[replay.fi++];
    Object.assign(replay.cur, fields);
  }
  camYaw = replay.cur.cam_yaw_deg || 0;
  const input = { ...replay.cur, pause: replay.cur.pause || latched.pause };
  latched.pause = false;
  return input;
}

// ---------------------------------------------------------------- events -> feedback
function onEvents(events) {
  for (const e of events) {
    switch (e.name) {
      case 'mote_picked': sfx.pickup(e.data.carried); break;
      case 'deposit': sfx.deposit(); break;
      case 'lantern_lit': sfx.lanternLit(); world.lanternViews.get(e.data.lantern_id).userData.glow = 0.01; break;
      case 'refuel': sfx.refuel(); break;
      case 'lantern_out': sfx.lanternOut(); world.lanternViews.get(e.data.lantern_id).userData.glow = 0; caption(`🏮 Đèn ${e.data.lantern_id} đã tắt`, 'warn'); break;
      case 'pulse': sfx.pulse(); pulseT = 0; screenFlash('rgb(255, 233, 176)'); break;
      case 'player_hit': sfx.hit(); flashFlames(); shake(); screenFlash(settings.colorblind ? 'rgb(255, 255, 255)' : 'rgb(255, 90, 95)'); break;
      case 'shade_spawned':
        sfx.shadeSpawn();
        caption('⚠ Bóng Mực xuất hiện', 'warn');
        threats.push({ id: e.data.id, until: performance.now() + 4000 });
        if (settings.captions) fx.arrows++;
        break;
      case 'dash': sfx.dash(); break;
      case 'charm_picked': sfx.charm(); break;
      case 'drifter_steal': sfx.steal(); break;
      case 'drifter_drop': sfx.charm(); break;
      case 'paused': showPause(); break;
      case 'resumed': hideScreen(); break;
      case 'game_over': (g.result === 'won' ? sfx.win : sfx.lose)(); setTimeout(showResult, 600); mode = 'ending'; break;
      default:
    }
  }
}
// Ticket-04 §4: captions / visual indicators (can be switched off) and motion effects
// (camera shake, screen flash) that "Giảm chuyển động" switches off.
const threats = [];
let weakSeen = new Set();
const fx = { shakes: 0, flashes: 0, captions: 0, arrows: 0, log: [] };
let shakeT = 0;
function caption(text, kind = 'info', ms = 4000) {
  if (!settings.captions || mode === 'bench') return;
  const box = $('captions');
  const el = document.createElement('div');
  el.className = `caption ${kind}`;
  el.textContent = text;
  box.appendChild(el);
  while (box.children.length > 4) box.firstChild.remove();
  fx.captions++;
  fx.log = [...fx.log.slice(-29), text];
  setTimeout(() => el.remove(), ms);
}
function shake() {
  if (settings.reducedMotion) return;
  shakeT = 0.35;
  fx.shakes++;
}
function screenFlash(color) {
  if (settings.reducedMotion) return;
  const el = $('flash');
  el.style.background = color;
  el.animate([{ opacity: 0.45 }, { opacity: 0 }], { duration: 260, easing: 'ease-out' });
  fx.flashes++;
}
// Puts an on-screen marker at a world point, clamped to the screen edge (rotated towards it) when off-screen.
function placeEdgeMarker(el, x0, y0, z0) {
  v3.set(x0, y0, z0).applyMatrix4(camera.matrixWorldInverse);
  const behind = v3.z > 0;
  v3.applyMatrix4(camera.projectionMatrix);
  let { x, y } = v3;
  if (behind) {
    x = -x;
    y = -y;
  }
  const onScreen = !behind && Math.abs(x) < 0.95 && Math.abs(y) < 0.9;
  const m = onScreen ? 1 : Math.max(Math.abs(x) / 0.9, Math.abs(y) / 0.8, 1e-6);
  const ex = x / m;
  const ey = y / m;
  el.style.left = `${((ex + 1) / 2) * window.innerWidth}px`;
  el.style.top = `${((1 - ey) / 2) * window.innerHeight}px`;
  el.style.transform = onScreen ? 'rotate(90deg)' : `rotate(${Math.atan2(-ey, ex)}rad)`;
  return onScreen;
}
function updateIndicators(tl, t) {
  // new shades: arrow at the screen edge pointing at them (4 s)
  const now = performance.now();
  for (let i = threats.length - 1; i >= 0; i--) if (threats[i].until < now || !g.shades.some((sh) => sh.id === threats[i].id)) threats.splice(i, 1);
  const box = $('threats');
  const want = settings.captions ? threats : [];
  while (box.children.length > want.length) box.lastChild.remove();
  while (box.children.length < want.length) box.appendChild(document.createElement('div')).className = 'threat';
  want.forEach((th, i) => {
    const sh = g.shades.find((x) => x.id === th.id);
    const el = box.children[i];
    el.textContent = '➤';
    el.dataset.shade = th.id;
    placeEdgeMarker(el, sh.x, sh.y, sh.z);
  });
  // lanterns dropping below 30 fuel
  for (const L of g.lanterns) {
    const weak = L.lit && L.fuel < g.fuel.low;
    if (weak && !weakSeen.has(L.id)) caption(`⚠ Đèn ${L.id} sắp cạn dầu (dưới ${tuning.low_fuel_threshold})`, 'warn');
    if (weak) weakSeen.add(L.id);
    else weakSeen.delete(L.id);
  }
  if (tl <= 10 && t === 10 && lastBeep !== 10) caption('⏳ 10 giây cuối tới bình minh!', 'warn', 5000);
}
function flashFlames() {
  const p = $('flames');
  p.animate([{ background: settings.colorblind ? 'rgba(255,255,255,.7)' : 'rgba(255,90,95,.7)' }, { background: 'rgba(14,20,48,.72)' }], { duration: 400 });
}

// ---------------------------------------------------------------- HUD
function buildMoteBar(cap = tuning.carry_capacity) {
  const bar = $('moteBar');
  bar.innerHTML = '';
  for (let i = 0; i < cap; i++) bar.appendChild(document.createElement('div')).className = 'mote-cell';
  bar.appendChild(document.createElement('span')).className = 'mote-count';
}
const v3 = new THREE.Vector3();
function updateHud() {
  const P = g.player;
  const fl = $('flames');
  const nFl = Math.min(5, Math.max(tuning.flames, P.flames)); // at most 5 icons; more (test scenarios) as +N
  if (fl.querySelectorAll('.flame').length !== nFl) {
    fl.innerHTML = '';
    for (let i = 0; i < nFl; i++) fl.appendChild(document.createElement('div')).className = 'flame';
    fl.appendChild(document.createElement('span')).className = 'flame-more';
  }
  fl.querySelectorAll('.flame').forEach((c, i) => c.classList.toggle('out', i >= P.flames));
  fl.querySelector('.flame-more').textContent = P.flames > nFl ? `+${P.flames - nFl}` : '';
  const tl = timeLeft(g);
  const t = Math.ceil(tl - 1e-9);
  $('clock').textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  $('clock').classList.toggle('danger', tl <= 30);
  const lit = g.lanterns.filter((L) => L.lit).length;
  $('lamps').textContent = `${lit}/${g.lanterns.length}`;
  $('lampsNeed').textContent = `cần ${litNeeded(tuning, g.lanterns.length)}`;
  $('lampsStat').classList.toggle('short', lit < litNeeded(tuning, g.lanterns.length));
  $('score').textContent = g.score;
  const cap = capacityOf(tuning, P);
  if ($('moteBar').querySelectorAll('.mote-cell').length !== cap) buildMoteBar(cap);
  $('moteBar').querySelectorAll('.mote-cell').forEach((c, i) => c.classList.toggle('on', i < P.carried));
  $('moteBar').querySelector('.mote-count').textContent = `${P.carried}/${cap}`;
  const setCd = (id, frac) => {
    const el = $(id);
    el.querySelector('.cd-fill').style.setProperty('--p', `${Math.round(frac * 100)}%`);
    el.classList.toggle('ready', frac <= 0);
  };
  setCd('cdDash', P.charm > 0 ? 0 : P.dashCd / Math.round(tuning.dash_cooldown_s * TICK_RATE));
  const pulseFrac = P.pulseCd / Math.round(tuning.pulse_cooldown_s * TICK_RATE);
  setCd('cdPulse', P.carried < tuning.pulse_cost ? Math.max(pulseFrac, 0.999) : pulseFrac);
  $('kDash').textContent = keyLabel(settings.keys.dash);
  $('kPulse').textContent = keyLabel(settings.keys.pulse);
  $('charmInd').hidden = P.charm <= 0;
  $('charmS').textContent = Math.ceil(P.charm / TICK_RATE);

  const dist = (L) => Math.hypot(L.x - P.x, L.z - P.z);
  const byDist = (a, b) => dist(a) - dist(b);
  const unlit = g.lanterns.filter((L) => !L.lit).sort(byDist);
  const weak = g.lanterns.filter((L) => L.lit && L.fuel < g.fuel.low).sort(byDist);
  // the lantern E would act on (same rule as the sim: can take motes, nearest)
  const near = g.lanterns.filter((L) => (!L.lit || L.fuel < g.fuel.max) && dist(L) <= tuning.interact_radius).sort(byDist)[0];
  $('prompt').hidden = !near;
  if (near) {
    const cost = near.everLit ? tuning.relight_cost : tuning.lantern_cost;
    $('prompt').innerHTML = near.lit
      ? `<kbd>${keyLabel(settings.keys.interact)}</kbd> — Châm dầu (${Math.floor(fuelOut(near.fuel))}/${tuning.fuel_max})`
      : `<kbd>${keyLabel(settings.keys.interact)}</kbd> — ${near.everLit ? 'Thắp lại' : 'Nạp ánh sáng'} (${near.deposited}/${cost})`;
  }

  // arrow (C19): nearest weak lantern, otherwise nearest unlit one, when it is off-screen
  const target = weak[0] || unlit[0];
  const arrow = $('arrow');
  if (!target) arrow.hidden = true;
  else {
    v3.set(target.x, target.y + 3.6, target.z).applyMatrix4(camera.matrixWorldInverse);
    const behind = v3.z > 0;
    v3.applyMatrix4(camera.projectionMatrix);
    let { x, y } = v3;
    if (behind) {
      x = -x;
      y = -y;
    }
    const onScreen = !behind && Math.abs(x) < 0.95 && Math.abs(y) < 0.9;
    arrow.hidden = onScreen;
    arrow.classList.toggle('weak', target.lit);
    if (!onScreen) {
      const m = Math.max(Math.abs(x) / 0.9, Math.abs(y) / 0.8, 1e-6);
      const ex = x / m;
      const ey = y / m;
      arrow.style.left = `${((ex + 1) / 2) * window.innerWidth}px`;
      arrow.style.top = `${((1 - ey) / 2) * window.innerHeight}px`;
      arrow.style.transform = `rotate(${Math.atan2(-ey, ex)}rad)`;
    }
  }

  // wind warning (2 s before each gust) and leaves
  if (g.windEnabled) {
    const phase = g.simTick % WORLD.windEvery;
    const warn = phase >= WORLD.windEvery - 2 * TICK_RATE;
    $('windWarn').hidden = !warn;
    const cycle = Math.floor(g.simTick / WORLD.windEvery);
    if (warn && windWarned !== cycle) {
      windWarned = cycle;
      sfx.windWarn();
      caption('🍃 Gió sắp nổi! Đứng vững.', 'warn', 3000);
    }
    if ((warn || g.wind.ticks > 0) && Math.random() < 0.25) spawnLeaf(g.wind.ticks > 0 ? g.wind.dir : 0);
  } else $('windWarn').hidden = true;

  updateIndicators(tl, t);
  if (tl <= 10 && t > 0 && t !== lastBeep) {
    lastBeep = t;
    sfx.countdown(t <= 3);
  }
}
function spawnLeaf(dirDeg) {
  const leaf = document.createElement('div');
  leaf.className = 'leaf';
  leaf.textContent = '🍃';
  leaf.style.left = `${Math.random() * 100}%`;
  leaf.style.top = `${Math.random() * 100}%`;
  const a = ((dirDeg - camYaw) * Math.PI) / 180;
  leaf.style.setProperty('--dx', `${Math.cos(a) * 300}px`);
  leaf.style.setProperty('--dy', `${-Math.sin(a) * 120 - 40}px`);
  leaf.style.animationDuration = `${1.2 + Math.random()}s`;
  $('leaves').appendChild(leaf);
  setTimeout(() => leaf.remove(), 2400);
}

// ---------------------------------------------------------------- sync visuals
function sync(time, dt) {
  const P = g.player;
  const lit = g.lanterns.filter((L) => L.lit).length;
  hemi.intensity = ambientIntensity(lit, g.lanterns.length);
  scene.fog.density = 0.014 - 0.006 * (lit / g.lanterns.length);

  may.visible = !P.fallen && !(P.invuln > 0 && Math.floor(time * 12) % 2 === 0);
  may.position.set(P.x, P.y, P.z);
  may.rotation.y = P.facing;
  may.userData.light.intensity = 1 + 0.2 * P.carried;
  orbiters.forEach((o, i) => {
    o.visible = may.visible && i < P.carried;
    const a = time * 2.2 + (i / Math.max(1, P.carried)) * Math.PI * 2;
    o.position.set(P.x + Math.sin(a) * 0.85, P.y + 1.0 + Math.sin(time * 3 + i) * 0.12, P.z + Math.cos(a) * 0.85);
  });

  const blinkOn = Math.floor(time * 2) % 2 === 0; // 1 Hz: 0.5 s on, 0.5 s off
  for (const L of g.lanterns) {
    const u = world.lanternViews.get(L.id).userData;
    const weak = L.lit && L.fuel < g.fuel.low;
    if (L.lit) u.glow = Math.min(1, u.glow + dt * 1.5);
    const k = weak && !blinkOn ? 0.25 : 1; // low fuel: lantern and bar blink slowly
    u.blinkK = k;
    u.bodyMat.color.set(L.lit ? PALETTE.lanternLit : PALETTE.lanternOff);
    u.bodyMat.emissiveIntensity = u.glow * 0.9 * k;
    u.coreMat.opacity = u.glow * k;
    u.light.intensity = u.glow * 3 * k;
    u.safe.visible = L.lit && !weak; // fuel < 30: no safe zone
    // unlit: deflated by 20 % and torn (Ticket-03 §6, readable without colour)
    u.body.scale.set(L.lit ? 1 : 0.8, L.lit ? 1.25 : 1.0, L.lit ? 1 : 0.8);
    u.tearGroup.visible = !L.lit;
    u.fuelBar.visible = L.lit;
    if (L.lit) {
      u.fuelBar.quaternion.copy(camera.quaternion);
      u.barFill.scale.x = Math.max(0.001, L.fuel / g.fuel.max);
      u.barFill.material.color.set(weak ? (settings.colorblind ? PALETTE.uiDangerCB : PALETTE.uiDanger) : PALETTE.fuelBar);
      u.barFill.material.transparent = true;
      u.barFill.material.opacity = k;
    }
    const cost = L.everLit ? tuning.relight_cost : tuning.lantern_cost;
    u.pips.forEach((pip, i) => {
      pip.visible = !L.lit && i < cost;
      pip.material.color.set(i < L.deposited ? PALETTE.moteHalo : PALETTE.lanternOff);
    });
  }

  syncSet(views.motes, g.motes, buildMote, (v, m) => {
    const ph = Number(m.id.slice(1)) * 1.7;
    v.position.set(m.x, m.y + 0.8 + Math.sin(time * 2.5 + ph) * 0.18, m.z);
    v.visible = !(m.kind === 'dropped' && m.ttl < 120 && Math.floor(time * 8) % 2 === 0);
  });
  syncSet(views.shades, g.shades, buildShade, (v, s) => {
    const stunned = s.state === 'stunned';
    v.position.set(s.x, s.y + Math.sin(time * 3 + s.x) * 0.1, s.z);
    v.rotation.y = Math.atan2(P.x - s.x, P.z - s.z);
    v.userData.bodyMat.color.set(stunned ? PALETTE.shadeStunned : PALETTE.shadeBody);
    v.userData.eyeMat.color.set(stunned ? PALETTE.uiText : rimColor());
    v.userData.rimMat.color.set(rimColor());
    const beam = v.userData.beam;
    const tgt = s.state === 'drain' && g.lanterns.find((L) => L.id === s.target);
    beam.visible = !!tgt;
    if (tgt) {
      const p = beam.geometry.attributes.position;
      p.setXYZ(0, s.x, s.y, s.z);
      p.setXYZ(1, tgt.x, tgt.y + 3.6, tgt.z);
      p.needsUpdate = true;
      beam.material.color.set(rimColor());
      beam.material.opacity = 0.5 + 0.4 * Math.sin(time * 10);
    }
    const sc = s.state === 'spawning' ? 0.4 : 1;
    const wob = stunned ? 1 + Math.sin(time * 18) * 0.06 : 1;
    v.scale.set(sc * wob, sc / wob, sc * wob);
  });
  for (const d of g.drifters) {
    let v = views.drifters.get(d.id);
    if (!v) views.drifters.set(d.id, (v = buildDrifter()));
    v.trail.unshift([d.x, d.y, d.z]);
    v.trail.length = Math.min(v.trail.length, 18);
    v.segs.forEach((s, i) => {
      const p = v.trail[Math.min(i * 3, v.trail.length - 1)];
      s.visible = d.state !== 'removed';
      s.position.set(p[0], p[1] + Math.sin(time * 6 + i) * 0.12, p[2]);
      s.rotation.set(Math.sin(time * 4 + i) * 0.6, time * 2 + i * 0.4, 0);
    });
  }
  syncSet(views.charms, g.charms, buildCharm, (v, c) => {
    v.visible = c.available;
    v.position.set(c.x, c.y + 1 + Math.sin(time * 2) * 0.15, c.z);
    v.rotation.y = time * 1.5;
  });

  pulseT = Math.min(1, pulseT + dt / 0.4);
  const r = Math.max(0.01, pulseT * tuning.pulse_radius);
  pulseRing.scale.set(r, r, r);
  pulseRing.position.set(P.x, P.y + 0.1, P.z);
  pulseRing.material.opacity = (1 - pulseT) * 0.85;

  if (mode === 'bench') {
    const [cx, cy, cz] = benchCamera(bench.t0 === null ? 0 : (performance.now() - bench.t0) / 1000);
    camera.position.set(cx, cy, cz);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    return;
  }
  const th = (camYaw * Math.PI) / 180;
  const camDist = cameraDistance(P, th);
  const target = new THREE.Vector3(P.x - Math.sin(th) * camDist, Math.max(P.y, -2) + 5, P.z - Math.cos(th) * camDist);
  camera.position.lerp(target, Math.min(1, dt * 6));
  camera.lookAt(P.x, Math.max(P.y, -2) + 1.3, P.z);
  if (shakeT > 0) {
    shakeT = Math.max(0, shakeT - dt);
    const a = 0.35 * (shakeT / 0.35);
    camera.position.x += (Math.random() - 0.5) * a;
    camera.position.y += (Math.random() - 0.5) * a;
  }
  camera.updateMatrixWorld();
}
// Camera collision: pull the camera in while the bell tower would sit between it and Mây.
function cameraDistance(P, th) {
  const camY = Math.max(P.y, -2) + 5;
  for (let d = 9; d > 2; d -= 0.5) {
    const cx = P.x - Math.sin(th) * d;
    const cz = P.z - Math.cos(th) * d;
    const blocked = g.map.obstacles.some((o) => camY < o.top + 2 && segmentPointDist(P.x, P.z, cx, cz, o.x, o.z) < o.r + 0.8);
    if (!blocked) return d;
  }
  return 2;
}
function segmentPointDist(ax, az, bx, bz, px, pz) {
  const vx = bx - ax;
  const vz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz || 1)));
  return Math.hypot(ax + t * vx - px, az + t * vz - pz);
}

function syncSet(map, items, build, update) {
  const seen = new Set();
  for (const it of items) {
    seen.add(it.id);
    let v = map.get(it.id);
    if (!v) {
      v = build();
      scene.add(v);
      map.set(it.id, v);
    }
    update(v, it);
  }
  for (const [id, v] of map) {
    if (!seen.has(id)) {
      scene.remove(v);
      if (v.userData.beam) scene.remove(v.userData.beam);
      map.delete(id);
    }
  }
}

// ---------------------------------------------------------------- main loop
const fastTicks = replay && params.has('speed') ? Math.max(1, Number(params.get('speed')) | 0) : 0;
let last = performance.now();
let acc = 0;
const fpsWin = [];
let fps = 0;
function frame(now) {
  let dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  fpsWin.push(now);
  while (fpsWin.length && fpsWin[0] < now - 1000) fpsWin.shift();
  fps = fpsWin.length;
  const time = now / 1000;
  const turn = (held.has('ArrowLeft') ? 1 : 0) - (held.has('ArrowRight') ? 1 : 0);
  if (mode === 'playing' && g && !g.paused) camYaw += turn * 120 * dt * settings.sensitivity;

  if (g && mode === 'bench') {
    benchFrame(now);
    acc += dt;
    const budget = Math.min(8, Math.floor(acc * TICK_RATE)); // fixed 60 ticks/s, no input
    acc -= Math.floor(acc * TICK_RATE) / TICK_RATE;
    for (let i = 0; i < budget; i++) step(g, { move: [0, 0], cam_yaw_deg: 0 });
    sync(time, dt);
    updateHud();
    renderer.render(scene, camera);
    if (bench.firstFrameEpoch === null) bench.firstFrameEpoch = performance.timeOrigin + performance.now();
    requestAnimationFrame(frame);
    return;
  }
  if (g && (mode === 'playing' || mode === 'ending')) {
    if (mode === 'playing') {
      let budget;
      if (fastTicks) {
        budget = fastTicks;
        dt = fastTicks / TICK_RATE;
      } else {
        acc += dt;
        budget = Math.floor(acc * TICK_RATE);
        acc -= budget / TICK_RATE;
      }
      for (let i = 0; i < budget && mode === 'playing'; i++) {
        const jumpedBefore = g.player.jumpedAt;
        onEvents(step(g, replay && !replay.live && replay.night === campaign.night ? replayInput() : currentInput()));
        if (g.player.jumpedAt !== jumpedBefore) sfx.jump();
        if (replay && params.has('until') && g.tick >= Number(params.get('until'))) mode = 'frozen';
      }
    }
    sync(time, dt); // camera first, so the HUD arrow projects with this frame's camera
    updateHud();
  } else if (g && mode === 'frozen') {
    sync(time, dt);
    updateHud();
  } else {
    camera.position.set(Math.sin(time * 0.1) * 60, 30, Math.cos(time * 0.1) * 60);
    camera.lookAt(0, 0, 0);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// boot: menu by default; ?scenario=… replays a headless scenario; ?night=N&autostart jumps to a night
if (!world) {
  world = buildWorld(getNight(1), tuning);
  scene.add(world.group);
}
if (bench) startBench();
else if (replay) startNight(replay.night);
else if (params.has('autostart')) startNight(Number(params.get('night') || 1));
else showMenu();
requestAnimationFrame(frame);

window.__ddl = {
  get game() { return g; },
  get mode() { return mode; },
  get screen() { return screenEl.hidden ? null : screenKind; },
  get campaign() { return campaign; },
  get gamesStarted() { return gamesStarted; },
  get fps() { return fps; },
  get ambient() { return hemi.intensity; },
  get settings() { return settings; },
  startNight,
  showIntro,
  setCamYaw: (deg) => (camYaw = deg), // test hook (deterministic camera for the HUD arrow check)
  lanternView: (id) => world.lanternViews.get(id).userData, // test hooks (Ticket-03 visuals)
  shadeView: (id) => views.shades.get(id)?.userData,
  get fx() { return { ...fx, shakeT }; }, // Ticket-04 §4 checks (captions, reduced motion)
  showBoard,
};
