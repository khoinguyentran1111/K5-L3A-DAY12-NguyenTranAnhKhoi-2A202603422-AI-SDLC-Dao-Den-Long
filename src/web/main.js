// Browser client: the 3-night campaign around the shared simulation (src/core/sim.js).
// Logic runs at a fixed 60 ticks/s exactly like headless; this file turns keyboard/mouse into
// contract-style inputs (incl. dash and pause) and draws the state with the Ticket-02 palette.
import * as THREE from 'three';
import { createGame, step, timeLeft, ambientIntensity, TICK_RATE, WORLD } from '../core/sim.js';
import { getNight } from '../core/maps.js';
import { PALETTE } from './palette.js';
import { buildWorld } from './world.js';
import { loadSettings, saveSettings } from './settings.js';
import { unlockAudio, setVolume, startMusic, sfx } from './audio.js';

const tuning = (await (await fetch('/game.contract.json')).json()).tuning;
const params = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
let settings = loadSettings();
setVolume(settings.volume);

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
  1: { quote: 'Mây à, sương đen đã phủ kín Bến. Gom đom đóm, thắp lại năm ngọn đèn cho dân chài nhé. Nhớ lời ông: Bóng Mực sợ ánh đèn.', tips: ['Shift để lướt, F để tỏa sáng (tốn 3 đom đóm).', 'Mép đảo là biển mây, rơi xuống là mất một Ngọn Lửa.'] },
  2: { quote: 'Hai hòn Cau nối nhau bằng cây cầu tre không lan can. Bục nhảy vàng sẽ đưa con qua biển mây. Coi chừng Gió Lạc, chúng mê đom đóm lắm.', tips: ['Gió Lạc (dải lụa xám xanh) cướp đom đóm khi con mang từ 5 con trở lên. Tỏa sáng để đòi lại.', 'Bùa Gió đỏ trên cầu giúp con chạy nhanh và lướt liên tục.'] },
  3: { quote: 'Đảo Chuông có ba tầng. Leo dốc lên tầng giữa, đứng lên bục để tới đỉnh tháp. Gió ở đây mạnh lắm, nghe lá xào xạc là phải đứng vững, con nhé.', tips: ['Bóng Mực ở đây nhanh hơn (4.5 m/s).', 'Mỗi 30 giây có một cơn gió kéo dài 5 giây.'] },
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
const orbiters = Array.from({ length: tuning.carry_capacity }, () => {
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
  const rim = new THREE.Mesh(rimGeo, new THREE.MeshBasicMaterial({ color: PALETTE.shadeRim, side: THREE.BackSide }));
  body.scale.set(1, 1.15, 1);
  rim.scale.set(1, 1.15, 1);
  const eyeMat = new THREE.MeshBasicMaterial({ color: PALETTE.shadeRim });
  const e1 = new THREE.Mesh(eyeGeo, eyeMat);
  const e2 = new THREE.Mesh(eyeGeo, eyeMat);
  e1.position.set(-0.25, 0.2, 0.66);
  e2.position.set(0.25, 0.2, 0.66);
  g.add(rim, body, e1, e2);
  g.userData = { bodyMat, eyeMat };
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
const campaign = { night: 1, total: 0, scores: {} };
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
  };
}

function clearViews() {
  for (const v of [...views.motes.values(), ...views.shades.values(), ...views.charms.values()]) scene.remove(v);
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
  const seed = useReplay ? replay.seed : params.has('seed') ? Number(params.get('seed')) : (Date.now() ^ (Math.random() * 1e9)) >>> 0;
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
  mode = 'playing';
  hideScreen();
  $('hud').hidden = false;
  $('nightLabel').textContent = `Đêm ${n} · ${map.name}`;
  buildMoteBar();
  startMusic();
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
  showScreen('menu', `
    <h1>Đảo Đèn Lồng</h1>
    <h2>Ba hòn đảo · ba đêm</h2>
    <p>Sương đen đã nuốt ánh sáng của ba hòn đảo giữa biển mây. Giúp Mây, người giữ đèn nhỏ tuổi, gom đom đóm và thắp lại các Đèn Lồng Lớn trước bình minh.</p>
    <ul>
      <li><b>WASD</b> đi · <b>Space</b> nhảy · <b>Shift</b> lướt · <b>E</b> nạp đèn · <b>F</b>/chuột trái tỏa sáng</li>
      <li>Kéo chuột hoặc <b>←/→</b> xoay camera · <b>Esc</b>/<b>P</b> tạm dừng</li>
    </ul>
    <p class="hint">Nhấn Enter để bắt đầu</p>`, [['Bắt đầu', () => showIntro(1), 'btnStart'], ['Cài đặt', () => showSettings(showMenu), 'btnSettings']]);
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
    <p class="hint">${map.lanterns.length} Đèn Lồng Lớn · ${tuning[map.durationKey]} giây tới bình minh</p>`, [['Vào Đêm', () => startNight(n), 'btnPlay'], ['Về menu', showMenu]]);
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
  showScreen('settings', `
    <h1>Cài đặt</h1>
    <div class="row"><label for="vol">Âm lượng</label><input id="vol" type="range" min="0" max="1" step="0.05" value="${settings.volume}"><span id="volV">${Math.round(settings.volume * 100)}%</span></div>
    <div class="row"><label for="sens">Độ nhạy chuột</label><input id="sens" type="range" min="0.2" max="3" step="0.1" value="${settings.sensitivity}"><span id="sensV">${settings.sensitivity.toFixed(1)}×</span></div>
    <p class="hint">Cài đặt được lưu lại cho những lần mở game sau.</p>`, [['Quay lại', back, 'btnBack']]);
  const save = () => {
    settings = { volume: Number($('vol').value), sensitivity: Number($('sens').value) };
    $('volV').textContent = `${Math.round(settings.volume * 100)}%`;
    $('sensV').textContent = `${settings.sensitivity.toFixed(1)}×`;
    setVolume(settings.volume);
    saveSettings(settings);
  };
  $('vol').addEventListener('input', save);
  $('sens').addEventListener('input', save);
}

const REASONS = {
  all_lit: 'Mọi Đèn Lồng Lớn đã cháy rực.',
  dawn: 'Trời sáng trước khi các đèn được thắp hết.',
  no_flames: 'Ngọn Lửa của Mây đã tắt.',
};
function showResult() {
  mode = 'result';
  const n = campaign.night;
  const lit = g.lanterns.filter((L) => L.lit).length;
  if (g.result === 'won') {
    campaign.scores[n] = g.score;
    campaign.total = Object.values(campaign.scores).reduce((a, b) => a + b, 0);
    if (n === 3) return showDawn();
    showScreen('result', `
      <h2>Đêm ${n} · ${getNight(n).name}</h2><h1>Đảo đã sáng!</h1>
      <p>${REASONS.all_lit} Còn ${Math.floor(timeLeft(g))} giây và ${g.player.flames} Ngọn Lửa.</p>
      <p>Điểm Đêm này: <span class="big">${g.score}</span><br>Tổng: <b>${campaign.total}</b></p>`, [['Đêm kế tiếp', () => showIntro(n + 1), 'btnNext'], ['Về menu', showMenu]]);
  } else {
    showScreen('result', `
      <h2>Đêm ${n} · ${getNight(n).name}</h2><h1>Chưa thành…</h1>
      <p>${REASONS[g.reason] || ''} Đã thắp ${lit}/${g.lanterns.length} đèn.</p>
      <p class="quote">“Không sao đâu Mây, mình thử lại nhé.” Ông Đăng</p>`, [['Chơi lại Đêm', () => startNight(n), 'btnRetry'], ['Về menu', showMenu]]);
  }
}
function showDawn() {
  mode = 'dawn';
  $('hud').hidden = true;
  showScreen('dawn', `
    <h2>Bình Minh</h2><h1>Ba hòn đảo đã sáng trở lại</h1>
    <p class="quote">“Con làm được rồi, Mây. Nghe tiếng chuông kìa: biển mây đang hồng lên.” Ông Đăng</p>
    <p>Đêm 1: ${campaign.scores[1] ?? 0} · Đêm 2: ${campaign.scores[2] ?? 0} · Đêm 3: ${campaign.scores[3] ?? 0}</p>
    <p>Tổng điểm: <span class="big" id="dawnTotal">${campaign.total}</span></p>`, [['Về menu', showMenu, 'btnMenu']]);
}

// ---------------------------------------------------------------- input
const held = new Set();
const latched = { jump: false, interact: false, pulse: false, dash: false, pause: false };
const KEY_ACTION = { Space: 'jump', KeyE: 'interact', KeyF: 'pulse', ShiftLeft: 'dash', ShiftRight: 'dash', Escape: 'pause', KeyP: 'pause' };
let dragging = false;
let lastX = 0;

window.addEventListener('keydown', (e) => {
  unlockAudio();
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  if (e.repeat) return;
  held.add(e.code);
  if (e.code === 'Enter' && !screenEl.hidden && primaryAction && screenKind !== 'settings') {
    sfx.ui();
    primaryAction();
    return;
  }
  if (mode !== 'playing') return;
  if ((e.code === 'Escape' || e.code === 'KeyP') && !screenEl.hidden && screenKind === 'settings') return showPause();
  if (KEY_ACTION[e.code]) latched[KEY_ACTION[e.code]] = true;
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
  const k = (c) => (held.has(c) ? 1 : 0);
  const input = {
    // Screen-right is world -X at yaw 0 for a camera looking down +Z, so D maps to move x = -1.
    move: [k('KeyA') - k('KeyD'), k('KeyW') + k('ArrowUp') - k('KeyS') - k('ArrowDown')],
    cam_yaw_deg: camYaw,
    jump: held.has('Space') || latched.jump,
    interact: held.has('KeyE') || latched.interact,
    pulse: held.has('KeyF') || latched.pulse,
    dash: held.has('ShiftLeft') || held.has('ShiftRight') || latched.dash,
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
      case 'pulse': sfx.pulse(); pulseT = 0; break;
      case 'player_hit': sfx.hit(); flashFlames(); break;
      case 'shade_spawned': sfx.shadeSpawn(); break;
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
function flashFlames() {
  const p = $('flames');
  p.animate([{ background: 'rgba(255,90,95,.7)' }, { background: 'rgba(14,20,48,.72)' }], { duration: 400 });
}

// ---------------------------------------------------------------- HUD
function buildMoteBar() {
  const bar = $('moteBar');
  bar.innerHTML = '';
  for (let i = 0; i < tuning.carry_capacity; i++) bar.appendChild(document.createElement('div')).className = 'mote-cell';
}
const v3 = new THREE.Vector3();
function updateHud() {
  const P = g.player;
  const fl = $('flames');
  const nFl = Math.max(tuning.flames, P.flames);
  if (fl.childElementCount !== nFl) {
    fl.innerHTML = '';
    for (let i = 0; i < nFl; i++) fl.appendChild(document.createElement('div')).className = 'flame';
  }
  [...fl.children].forEach((c, i) => c.classList.toggle('out', i >= P.flames));
  const tl = timeLeft(g);
  const t = Math.ceil(tl - 1e-9);
  $('clock').textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  $('clock').classList.toggle('danger', tl <= 30);
  const lit = g.lanterns.filter((L) => L.lit).length;
  $('lamps').textContent = `${lit}/${g.lanterns.length}`;
  $('score').textContent = g.score;
  [...$('moteBar').children].forEach((c, i) => c.classList.toggle('on', i < P.carried));
  const setCd = (id, frac) => {
    const el = $(id);
    el.querySelector('.cd-fill').style.setProperty('--p', `${Math.round(frac * 100)}%`);
    el.classList.toggle('ready', frac <= 0);
  };
  setCd('cdDash', P.charm > 0 ? 0 : P.dashCd / Math.round(tuning.dash_cooldown_s * TICK_RATE));
  const pulseFrac = P.pulseCd / Math.round(tuning.pulse_cooldown_s * TICK_RATE);
  setCd('cdPulse', P.carried < tuning.pulse_cost ? Math.max(pulseFrac, 0.999) : pulseFrac);
  $('charmInd').hidden = P.charm <= 0;
  $('charmS').textContent = Math.ceil(P.charm / TICK_RATE);

  const unlit = g.lanterns.filter((L) => !L.lit).sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z));
  const near = unlit.find((L) => Math.hypot(L.x - P.x, L.z - P.z) <= tuning.interact_radius);
  $('prompt').hidden = !near;
  if (near) $('prompt').innerHTML = `<kbd>E</kbd> — Nạp ánh sáng (${near.deposited}/${tuning.lantern_cost})`;

  // arrow to the nearest unlit lantern when it is off-screen
  const target = unlit[0];
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
    }
    if ((warn || g.wind.ticks > 0) && Math.random() < 0.25) spawnLeaf(g.wind.ticks > 0 ? g.wind.dir : 0);
  } else $('windWarn').hidden = true;

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

  for (const L of g.lanterns) {
    const u = world.lanternViews.get(L.id).userData;
    if (L.lit) u.glow = Math.min(1, u.glow + dt * 1.5);
    u.bodyMat.color.set(L.lit ? PALETTE.lanternLit : PALETTE.lanternOff);
    u.bodyMat.emissiveIntensity = u.glow * 0.9;
    u.coreMat.opacity = u.glow;
    u.light.intensity = u.glow * 3;
    u.safe.visible = L.lit;
    u.pips.forEach((pip, i) => pip.material.color.set(i < L.deposited ? PALETTE.moteHalo : PALETTE.lanternOff));
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
    v.userData.eyeMat.color.set(stunned ? PALETTE.uiText : PALETTE.shadeRim);
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

  const th = (camYaw * Math.PI) / 180;
  const camDist = cameraDistance(P, th);
  const target = new THREE.Vector3(P.x - Math.sin(th) * camDist, Math.max(P.y, -2) + 5, P.z - Math.cos(th) * camDist);
  camera.position.lerp(target, Math.min(1, dt * 6));
  camera.lookAt(P.x, Math.max(P.y, -2) + 1.3, P.z);
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
        onEvents(step(g, replay && replay.night === campaign.night ? replayInput() : currentInput()));
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
if (replay) startNight(replay.night);
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
};
