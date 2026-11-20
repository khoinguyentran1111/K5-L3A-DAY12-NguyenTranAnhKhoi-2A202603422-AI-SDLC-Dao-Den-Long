// Browser client: renders the shared simulation (src/core/sim.js) with Three.js.
// The game logic runs at a fixed 60 ticks/s exactly like headless; this file only
// turns keyboard/mouse into contract-style inputs and draws the state.
import * as THREE from 'three';
import { createGame, step, timeLeft, TICK_RATE, WORLD } from '../core/sim.js';
import { unlockAudio, toggleMute, sfx } from './audio.js';

const tuning = (await (await fetch('/game.contract.json')).json()).tuning;
const $ = (id) => document.getElementById(id);
$('capacity').textContent = tuning.carry_capacity;
$('r-cap').textContent = tuning.carry_capacity;
$('r-cost').textContent = tuning.lantern_cost;
$('r-pulse').textContent = tuning.pulse_cost;

// ---------- renderer / scene ----------
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const NIGHT = new THREE.Color('#0b0614');
const DUSK = new THREE.Color('#3a2a52');
scene.background = NIGHT.clone();
scene.fog = new THREE.FogExp2(NIGHT.clone(), 0.03);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);

const hemi = new THREE.HemisphereLight('#8a7bd1', '#1a1026', 0.5);
scene.add(hemi);
const moon = new THREE.DirectionalLight('#b9b4ff', 0.35);
moon.position.set(-20, 40, -10);
scene.add(moon);

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------- static world ----------
const island = new THREE.Mesh(
  new THREE.CylinderGeometry(WORLD.islandRadius, WORLD.islandRadius - 6, 6, 72),
  new THREE.MeshStandardMaterial({ color: '#2d4537', roughness: 0.95 }),
);
island.position.y = -3;
scene.add(island);
const rim = new THREE.Mesh(
  new THREE.RingGeometry(WORLD.islandRadius - 1.2, WORLD.islandRadius, 72),
  new THREE.MeshStandardMaterial({ color: '#6b5b45', roughness: 1 }),
);
rim.rotation.x = -Math.PI / 2;
rim.position.y = 0.01;
scene.add(rim);

const sea = new THREE.Mesh(
  new THREE.CircleGeometry(300, 48),
  new THREE.MeshStandardMaterial({ color: '#2b2047', roughness: 1 }),
);
sea.rotation.x = -Math.PI / 2;
sea.position.y = -6;
scene.add(sea);

// Deterministic decoration (bushes, rocks, cloud puffs) — cosmetic only.
let decoSeed = 7;
const drand = () => ((decoSeed = (decoSeed * 16807) % 2147483647) / 2147483647);
const bushMat = new THREE.MeshStandardMaterial({ color: '#1f3a2c', roughness: 1 });
const rockMat = new THREE.MeshStandardMaterial({ color: '#4a4458', roughness: 1 });
const lanternSpots = createGame({ tuning, seed: 1, scenario: { random_motes: false, random_shades: false } }).lanterns;
for (let i = 0; i < 60; i++) {
  const a = drand() * Math.PI * 2;
  const r = 6 + drand() * (WORLD.islandRadius - 8);
  const x = r * Math.sin(a);
  const z = r * Math.cos(a);
  if (lanternSpots.some((L) => Math.hypot(L.x - x, L.z - z) < 4)) continue;
  const isRock = drand() < 0.35;
  const m = isRock
    ? new THREE.Mesh(new THREE.DodecahedronGeometry(0.4 + drand() * 0.6), rockMat)
    : new THREE.Mesh(new THREE.ConeGeometry(0.6 + drand() * 0.5, 1.4 + drand() * 1.6, 7), bushMat);
  m.position.set(x, isRock ? 0.2 : 0.7, z);
  m.rotation.y = drand() * Math.PI;
  scene.add(m);
}
const cloudMat = new THREE.MeshStandardMaterial({ color: '#5a4a80', roughness: 1, transparent: true, opacity: 0.85 });
for (let i = 0; i < 40; i++) {
  const a = drand() * Math.PI * 2;
  const r = 52 + drand() * 70;
  const puff = new THREE.Mesh(new THREE.SphereGeometry(3 + drand() * 5, 12, 10), cloudMat);
  puff.position.set(r * Math.sin(a), -5 + drand() * 2.5, r * Math.cos(a));
  puff.scale.y = 0.45;
  scene.add(puff);
}

// ---------- Mây ----------
function buildMay() {
  const g = new THREE.Group();
  const robe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.5, 1.0, 16),
    new THREE.MeshStandardMaterial({ color: '#6f8fd8', roughness: 0.8 }),
  );
  robe.position.y = 0.5;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 20, 16),
    new THREE.MeshStandardMaterial({ color: '#f1d1b5', roughness: 0.7 }),
  );
  head.position.y = 1.25;
  const hat = new THREE.Mesh(
    new THREE.ConeGeometry(0.78, 0.38, 28, 1, true),
    new THREE.MeshStandardMaterial({ color: '#e3c98f', roughness: 0.9, side: THREE.DoubleSide }),
  );
  hat.position.y = 1.55;
  const string = new THREE.Mesh(
    new THREE.CylinderGeometry(0.01, 0.01, 0.35, 4),
    new THREE.MeshBasicMaterial({ color: '#3a2a1a' }),
  );
  string.position.set(0, 1.25, 0.68);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 14, 12),
    new THREE.MeshStandardMaterial({ color: '#ffb347', emissive: '#ff9a2e', emissiveIntensity: 2 }),
  );
  lamp.scale.y = 1.25;
  lamp.position.set(0, 1.02, 0.68);
  const light = new THREE.PointLight('#ffb15c', 1.2, 9, 1.6);
  light.position.copy(lamp.position);
  g.add(robe, head, hat, string, lamp, light);
  g.userData = { lamp, light };
  return g;
}
const may = buildMay();
scene.add(may);

// Creativity: carried fireflies orbit Mây (diegetic "carried" counter).
const orbitMat = new THREE.MeshBasicMaterial({ color: '#fff2a0' });
const orbiters = Array.from({ length: tuning.carry_capacity }, () => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), orbitMat);
  scene.add(m);
  return m;
});

// ---------- lanterns ----------
const safeMat = new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.22, side: THREE.DoubleSide });
function buildLantern() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: '#4b3426', roughness: 0.9 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 3, 10), wood);
  post.position.y = 1.5;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.9), wood);
  arm.position.set(0, 3.0, 0);
  const bodyMat = new THREE.MeshStandardMaterial({ color: '#3a2f4a', emissive: '#ff8c2a', emissiveIntensity: 0, roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 16), bodyMat);
  body.scale.y = 1.25;
  body.position.y = 3.6;
  const light = new THREE.PointLight('#ffa64d', 0, 20, 1.4);
  light.position.y = 3.6;
  const safe = new THREE.Mesh(new THREE.RingGeometry(tuning.safe_radius - 0.12, tuning.safe_radius, 72), safeMat);
  safe.rotation.x = -Math.PI / 2;
  safe.position.y = 0.03;
  safe.visible = false;
  const pips = [];
  const pipGeo = new THREE.SphereGeometry(0.11, 8, 6);
  for (let i = 0; i < tuning.lantern_cost; i++) {
    const a = (i / tuning.lantern_cost) * Math.PI * 2;
    const pip = new THREE.Mesh(pipGeo, new THREE.MeshBasicMaterial({ color: '#4a3d5c' }));
    pip.position.set(Math.sin(a) * 0.9, 0.15, Math.cos(a) * 0.9);
    pips.push(pip);
    g.add(pip);
  }
  g.add(post, arm, body, light, safe);
  g.userData = { bodyMat, light, safe, pips, glow: 0 };
  return g;
}

// ---------- dynamic entities ----------
const moteGeo = new THREE.SphereGeometry(0.13, 10, 8);
const moteMat = new THREE.MeshBasicMaterial({ color: '#fff0a0' });
const haloGeo = new THREE.SphereGeometry(0.35, 10, 8);
const haloMat = new THREE.MeshBasicMaterial({ color: '#ffd966', transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending });
function buildMote() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(moteGeo, moteMat), new THREE.Mesh(haloGeo, haloMat));
  return g;
}

const shadeGeo = new THREE.SphereGeometry(0.75, 20, 16);
const eyeGeo = new THREE.SphereGeometry(0.11, 8, 6);
function buildShade() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: '#1b0a29', emissive: '#4b1a7a', emissiveIntensity: 0.35, roughness: 0.4, transparent: true, opacity: 0.92 });
  const body = new THREE.Mesh(shadeGeo, bodyMat);
  body.scale.set(1, 1.15, 1);
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#d79bff' });
  const e1 = new THREE.Mesh(eyeGeo, eyeMat);
  const e2 = new THREE.Mesh(eyeGeo, eyeMat);
  e1.position.set(-0.25, 0.2, 0.62);
  e2.position.set(0.25, 0.2, 0.62);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.9, 12), bodyMat);
  tail.rotation.x = Math.PI;
  tail.position.y = -0.85;
  g.add(body, e1, e2, tail);
  g.userData = { bodyMat, eyeMat };
  return g;
}

const pulseRing = new THREE.Mesh(
  new THREE.RingGeometry(0.85, 1, 64),
  new THREE.MeshBasicMaterial({ color: '#ffe2a8', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
);
pulseRing.rotation.x = -Math.PI / 2;
pulseRing.position.y = 0.1;
scene.add(pulseRing);

// ---------- game session ----------
let g = null;
let gamesStarted = 0;
let mode = 'title'; // title | playing | over
const lanternViews = new Map();
const moteViews = new Map();
const shadeViews = new Map();
let pulseT = 1;

function clearDynamic() {
  for (const m of [...lanternViews.values(), ...moteViews.values(), ...shadeViews.values()]) scene.remove(m);
  lanternViews.clear();
  moteViews.clear();
  shadeViews.clear();
}

// Replay mode: ?scenario=<folder in scenarios/>&seed=N plays the exact headless
// scenario + inputs file in 3D (keyboard ignored), e.g. for reproducible screenshots.
const params = new URLSearchParams(location.search);
let replay = null;
if (params.has('scenario')) {
  const name = params.get('scenario').replace(/[^\w-]/g, '');
  const get = async (f) => {
    const r = await fetch(`/scenarios/${name}/${f}`);
    return r.ok ? r.json() : null;
  };
  replay = { scenario: (await get('scenario.json')) || {}, inputs: (await get('inputs.json')) || { frames: [] } };
}

function replayInput() {
  const cur = replay.cur;
  const frames = replay.inputs.frames;
  while (replay.fi < frames.length && frames[replay.fi].tick <= g.tick) {
    const { tick: _t, ...fields } = frames[replay.fi++];
    Object.assign(cur, fields);
  }
  camYaw = cur.cam_yaw_deg || 0;
  return { ...cur };
}

function newGame() {
  gamesStarted++;
  clearDynamic();
  const seed = params.has('seed') ? Number(params.get('seed')) : (Date.now() ^ (Math.random() * 1e9)) >>> 0;
  if (replay) {
    replay.cur = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false };
    replay.fi = 0;
  }
  g = createGame({ tuning, seed, scenario: replay ? replay.scenario : {} });
  for (const L of g.lanterns) {
    const v = buildLantern();
    v.position.set(L.x, L.y, L.z);
    scene.add(v);
    lanternViews.set(L.id, v);
  }
  camYaw = 0;
  mode = 'playing';
  $('overlay').hidden = true;
  $('hud').hidden = false;
}

// ---------- input ----------
const held = new Set();
const latched = { jump: false, interact: false, pulse: false };
let camYaw = 0; // degrees, same meaning as cam_yaw_deg in the contract
let dragging = false;
let lastX = 0;
const KEY_ACTION = { Space: 'jump', KeyE: 'interact', KeyF: 'pulse' };

window.addEventListener('keydown', (e) => {
  unlockAudio();
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  if (e.repeat) return;
  held.add(e.code);
  if (KEY_ACTION[e.code]) latched[KEY_ACTION[e.code]] = true;
  if (e.code === 'KeyM') toggleMute();
  if ((e.code === 'Enter' || e.code === 'KeyR') && mode !== 'playing') newGame();
});
window.addEventListener('keyup', (e) => held.delete(e.code));
window.addEventListener('blur', () => held.clear());
canvas.addEventListener('pointerdown', (e) => {
  unlockAudio();
  dragging = true;
  lastX = e.clientX;
  if (e.button === 0 && mode === 'playing') latched.pulse = true;
});
window.addEventListener('pointerup', () => (dragging = false));
window.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  camYaw -= (e.clientX - lastX) * 0.3;
  lastX = e.clientX;
});
$('overlay').addEventListener('click', () => {
  unlockAudio();
  if (mode !== 'playing') newGame();
});

function currentInput() {
  const k = (c) => (held.has(c) ? 1 : 0);
  // Screen-right is world -X at yaw 0 for a camera looking down +Z, so D maps to move x = -1.
  const x = k('KeyA') - k('KeyD');
  const z = k('KeyW') + k('ArrowUp') - k('KeyS') - k('ArrowDown');
  const input = {
    move: [x, z],
    cam_yaw_deg: camYaw,
    jump: held.has('Space') || latched.jump,
    interact: held.has('KeyE') || latched.interact,
    pulse: held.has('KeyF') || latched.pulse,
  };
  latched.jump = latched.interact = latched.pulse = false;
  return input;
}

// ---------- events -> feedback ----------
function onEvents(events) {
  for (const e of events) {
    switch (e.name) {
      case 'mote_picked':
        sfx.pickup(e.data.carried);
        break;
      case 'deposit':
        sfx.deposit();
        break;
      case 'lantern_lit':
        sfx.lanternLit();
        lanternViews.get(e.data.lantern_id).userData.glow = 0.01;
        break;
      case 'pulse':
        sfx.pulse();
        pulseT = 0;
        break;
      case 'player_hit':
        sfx.hit();
        flashPanel();
        break;
      case 'shade_spawned':
        sfx.shadeSpawn();
        break;
      case 'game_over':
        showGameOver(e.data);
        break;
      default:
    }
  }
}

function flashPanel() {
  const p = $('flames').parentElement;
  p.classList.remove('flash');
  void p.offsetWidth;
  p.classList.add('flash');
}

function showGameOver({ result, reason }) {
  mode = 'over';
  (result === 'won' ? sfx.win : sfx.lose)();
  const titles = { all_lit: 'Đảo đã sáng trở lại!', dawn: 'Bình minh đã đến…', no_flames: 'Ngọn lửa của Mây đã tắt…' };
  const texts = {
    all_lit: 'Cả 5 Đèn Lồng Lớn đã cháy rực. Sương đen tan dần trên Đảo Bến.',
    dawn: 'Trời sáng trước khi các đèn được thắp hết. Sương đen vẫn còn bám trên đảo.',
    no_flames: 'Bóng Mực đã chạm vào Mây quá nhiều lần.',
  };
  $('ov-title').textContent = titles[reason] || 'Kết thúc';
  $('ov-text').textContent = `${texts[reason] || ''} Điểm: ${g.score}.`;
  $('ov-rules').hidden = true;
  $('ov-cta').innerHTML = 'Nhấn <b>Enter</b> hoặc <b>R</b> để chơi lại';
  $('overlay').hidden = false;
}

// ---------- HUD ----------
function updateHud() {
  const P = g.player;
  const fl = $('flames');
  if (fl.childElementCount !== Math.max(tuning.flames, P.flames)) {
    fl.innerHTML = '';
    for (let i = 0; i < Math.max(tuning.flames, P.flames); i++) fl.appendChild(document.createElement('div')).className = 'flame';
  }
  [...fl.children].forEach((c, i) => c.classList.toggle('out', i >= P.flames));
  $('carried').textContent = P.carried;
  $('lit').textContent = g.lanterns.filter((L) => L.lit).length;
  const t = Math.ceil(timeLeft(g));
  $('time').textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  $('score').textContent = g.score;

  let hint = '';
  const near = g.lanterns
    .filter((L) => !L.lit && Math.hypot(L.x - P.x, L.z - P.z) <= tuning.interact_radius)
    .sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z))[0];
  if (near) hint = P.carried > 0 ? `Nhấn E để nạp ánh sáng vào ${near.id} (${near.deposited}/${tuning.lantern_cost})` : `${near.id} cần ${tuning.lantern_cost - near.deposited} đom đóm nữa`;
  else if (P.carried >= tuning.carry_capacity) hint = 'Túi đầy! Mang đom đóm về một Đèn Lồng Lớn';
  else if (g.shades.some((s) => s.stun === 0 && Math.hypot(s.x - P.x, s.z - P.z) < tuning.pulse_radius)) {
    hint = P.carried >= tuning.pulse_cost ? 'Bóng Mực ở gần! Nhấn F để tỏa sáng' : 'Bóng Mực ở gần! Chạy về vòng sáng của đèn đã thắp';
  }
  $('hint').textContent = hint;
}

// ---------- sync visuals ----------
const tmpColor = new THREE.Color();
function syncScene(time, dt) {
  const P = g.player;
  const lit = g.lanterns.filter((L) => L.lit).length;
  const k = lit / g.lanterns.length;

  // the island brightens as lanterns are lit
  tmpColor.copy(NIGHT).lerp(DUSK, k);
  scene.background.copy(tmpColor);
  scene.fog.color.copy(tmpColor);
  scene.fog.density = 0.03 - 0.018 * k;
  hemi.intensity = 0.5 + 0.9 * k;

  may.position.set(P.x, P.y, P.z);
  may.rotation.y = P.facing;
  may.visible = !(P.invuln > 0 && Math.floor(time * 12) % 2 === 0);
  may.userData.light.intensity = 0.8 + 0.25 * P.carried;
  orbiters.forEach((o, i) => {
    o.visible = i < P.carried;
    const a = time * 2.2 + (i / Math.max(1, P.carried)) * Math.PI * 2;
    o.position.set(P.x + Math.sin(a) * 0.85, P.y + 1.0 + Math.sin(time * 3 + i) * 0.12, P.z + Math.cos(a) * 0.85);
  });

  for (const L of g.lanterns) {
    const v = lanternViews.get(L.id);
    const u = v.userData;
    if (L.lit) u.glow = Math.min(1, u.glow + dt * 1.5);
    u.bodyMat.emissiveIntensity = u.glow * 2.2 + (L.lit ? Math.sin(time * 2 + v.position.x) * 0.15 : 0);
    u.bodyMat.color.set(L.lit ? '#ffcf8a' : '#3a2f4a');
    u.light.intensity = u.glow * 3;
    u.safe.visible = L.lit;
    u.pips.forEach((pip, i) => pip.material.color.set(i < L.deposited ? '#ffcf5a' : '#4a3d5c'));
  }

  const seenM = new Set();
  for (const m of g.motes) {
    seenM.add(m.id);
    let v = moteViews.get(m.id);
    if (!v) {
      v = buildMote();
      scene.add(v);
      moteViews.set(m.id, v);
    }
    const ph = Number(m.id.slice(1)) * 1.7;
    v.position.set(m.x + Math.sin(time + ph) * 0.15, 0.9 + Math.sin(time * 2.5 + ph) * 0.2, m.z + Math.cos(time * 0.8 + ph) * 0.15);
  }
  for (const [id, v] of moteViews) if (!seenM.has(id)) {
    scene.remove(v);
    moteViews.delete(id);
  }

  const seenS = new Set();
  for (const s of g.shades) {
    seenS.add(s.id);
    let v = shadeViews.get(s.id);
    if (!v) {
      v = buildShade();
      scene.add(v);
      shadeViews.set(s.id, v);
    }
    const stunned = s.stun > 0;
    v.position.set(s.x, WORLD.shadeY + Math.sin(time * 3 + s.x) * 0.12, s.z);
    v.rotation.y = Math.atan2(P.x - s.x, P.z - s.z);
    v.userData.eyeMat.color.set(stunned ? '#ffffff' : '#d79bff');
    v.userData.bodyMat.emissive.set(stunned ? '#8f7bb8' : '#4b1a7a');
    const wob = stunned ? 1 + Math.sin(time * 18) * 0.06 : 1;
    v.scale.set(wob, 1 / wob, wob);
  }
  for (const [id, v] of shadeViews) if (!seenS.has(id)) {
    scene.remove(v);
    shadeViews.delete(id);
  }

  pulseT = Math.min(1, pulseT + dt / 0.4);
  const r = Math.max(0.01, pulseT * tuning.pulse_radius);
  pulseRing.scale.set(r, r, r);
  pulseRing.position.set(P.x, 0.1, P.z);
  pulseRing.material.opacity = (1 - pulseT) * 0.8;

  // third-person camera behind Mây, looking along the camera yaw
  const th = (camYaw * Math.PI) / 180;
  const target = new THREE.Vector3(P.x - Math.sin(th) * 9, P.y + 5, P.z - Math.cos(th) * 9);
  camera.position.lerp(target, Math.min(1, dt * 6));
  camera.lookAt(P.x, P.y + 1.3, P.z);
}

// ---------- main loop (fixed 60 Hz simulation, render every frame) ----------
// Replay only: ?speed=N advances N ticks per rendered frame (fast-forward for screenshots).
const fastTicks = replay && params.has('speed') ? Math.max(1, Number(params.get('speed')) | 0) : 0;
let last = performance.now();
let acc = 0;
function frame(now) {
  let dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  const time = now / 1000;
  const turn = (held.has('ArrowLeft') ? 1 : 0) - (held.has('ArrowRight') ? 1 : 0);
  camYaw += turn * 120 * dt;

  if (g) {
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
        onEvents(step(g, replay ? replayInput() : currentInput()));
        if (replay && params.has('until') && g.tick >= Number(params.get('until'))) mode = 'paused';
      }
      updateHud();
    }
    syncScene(time, dt);
  } else {
    // title screen: slow orbit over the dark island
    camera.position.set(Math.sin(time * 0.1) * 55, 26, Math.cos(time * 0.1) * 55);
    camera.lookAt(0, 0, 0);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ?autostart (or replay mode) skips the title card.
if (params.has('autostart') || replay) newGame();

// Small debug hook (used for screenshots / manual checks in the console).
window.__ddl = { get game() { return g; }, get mode() { return mode; }, get gamesStarted() { return gamesStarted; }, newGame };
