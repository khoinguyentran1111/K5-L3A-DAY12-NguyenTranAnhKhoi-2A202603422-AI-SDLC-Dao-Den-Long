// Pure game logic for Đảo Đèn Lồng (Test Contract v1.2, Ticket-03 on top of Ticket-02), shared
// by the headless runner and the browser. Rules: no DOM, no Node APIs, no Date/Math.random —
// every random choice comes from the seeded RNG, so (seed, night, scenario, inputs) -> identical
// output. One call to step() = one tick, processed in the mandatory phases of Ticket-02, with the
// Ticket-03 additions (fuel in phase 2, lanterns going out right after phase 2, dawn rule in 11).
// Assumptions: B1..B25 in docs/notes/phase2.md, C1..C19 in docs/notes/phase3.md,
// design decision in docs/adr/0001-lantern-fuel-and-dawn-win.md.
import { mulberry32 } from './rng.js';
import { getNight, blockedByObstacle } from './maps.js';

export const TICK_RATE = 60;
export const SHADE_STATES = ['spawning', 'wander', 'chase', 'recoil', 'stunned', 'drain'];
// Fuel is kept in integer units of 1/60 (C1): 100 fuel = 6000 units, decay 1 unit per tick.
export const FUEL_UNIT = 60;

// Standard numbers of Ticket-02 that are not part of the contract `tuning` block.
export const WORLD = Object.freeze({
  jumpSpeed: 7,
  gravity: 20,
  stepUp: 0.3, // B4: higher ground than this is a wall; lower ground than this means falling
  pickupHeight: 1.5,
  hitHeight: 1.5,
  charmSpeed: 7.2,
  charmTicks: 600,
  charmRespawnTicks: 2700,
  initialMotes: 20,
  moteCap: 30,
  moteSpawnEvery: 240,
  dropRingMin: 1.5,
  dropRingMax: 2.5,
  dropTtl: 480,
  pulseCenterY: 0.8,
  pushTicks: 15,
  shadeHover: 1.0,
  detect: 12,
  lose: 18,
  wanderSpeed: 1.5, // B9
  wanderTurnTicks: 120,
  recoilMeters: 2,
  recoilTicks: 60,
  evictTicks: 30,
  safeEpsilon: 0.01, // B12
  shadeFirstSpawn: 300,
  shadeMinPlayerDist: 15,
  fallY: -10,
  respawnWait: 60,
  respawnInvuln: 90,
  drifterSpeed: 7,
  drifterIdleSpeed: 2,
  drifterIdleRadius: 4,
  drifterHover: 1.5,
  drifterMax: 2,
  drifterEvery: 1200,
  drifterChaseCarry: 5,
  drifterChaseDist: 15,
  drifterTouch: 1.2,
  drifterStealMax: 3,
  drifterFleeTicks: 240,
  drifterVanishTicks: 120,
  windEvery: 1800,
  windTicks: 300,
  windSpeed: 2,
  capacityPerLight: 2, // Ticket-03 §4: capacity = 10 + 2 × successful_lights
  drainReach: 2, // Ticket-03 §2: drain when ≤ 2 m (XZ) from the weak lantern
  drainBreak: 6, // Ticket-03 §2: drain -> chase when Mây comes within 6 m
  drainEventEvery: 60,
});

// Derived per-tick fuel numbers (integer units, C1).
export function fuelRules(t) {
  return {
    max: Math.round(t.fuel_max * FUEL_UNIT),
    decay: Math.round((t.fuel_decay_per_s * FUEL_UNIT) / TICK_RATE),
    drain: Math.round((t.drain_per_s * FUEL_UNIT) / TICK_RATE),
    perMote: Math.round(t.fuel_per_mote * FUEL_UNIT),
    low: Math.round(t.low_fuel_threshold * FUEL_UNIT),
  };
}
export const fuelOut = (u) => Math.round(u / 6) / 10; // units -> fuel with 1 decimal
export const litNeeded = (t, total) => Math.ceil(t.win_ratio * total - 1e-9);
export const capacityOf = (t, P) => Math.min(t.capacity_max, t.carry_capacity + WORLD.capacityPerLight * P.successfulLights);

export class ScenarioError extends Error {}

export const r3 = (v) => {
  const x = Math.round(v * 1000) / 1000;
  return Object.is(x, -0) ? 0 : x;
};
const T = (s) => Math.round(s * TICK_RATE);
const distXZ = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const idNum = (id) => Number(String(id).replace(/\D/g, '')) || 0;
const byId = (a, b) => idNum(a.id) - idNum(b.id) || String(a.id).localeCompare(String(b.id));
const unit = (dx, dz) => {
  const d = Math.hypot(dx, dz);
  return d < 1e-9 ? [1, 0] : [dx / d, dz / d]; // "trùng vị trí thì đẩy theo +X"
};

export function ambientIntensity(lit, total) {
  return 0.15 + 0.55 * (total > 0 ? lit / total : 0);
}

// ---------------------------------------------------------------- setup
export function createGame({ tuning, seed = 1, night = 1, scenario = {} }) {
  const map = getNight(night);
  const sc = scenario || {};
  const p = sc.player || {};
  const pos = p.pos || map.start;
  const timeStart = sc.time_left_s ?? tuning[map.durationKey];
  const g = {
    tuning,
    map,
    night,
    rng: mulberry32(seed),
    tick: 0,
    simTick: 0,
    paused: false,
    timeStart,
    endSim: Math.max(0, Math.ceil(timeStart * TICK_RATE - 1e-9)),
    state: 'playing',
    result: null,
    reason: null,
    score: 0,
    player: {
      x: pos[0], y: pos[1], z: pos[2], vx: 0, vy: 0, vz: 0, grounded: false, facing: 0,
      flames: p.flames ?? tuning.flames,
      carried: p.carried ?? 0,
      invuln: p.invuln_ticks ?? 0,
      dashCd: p.dash_cd_ticks ?? 0,
      pulseCd: p.pulse_cd_ticks ?? 0,
      charm: p.charm_ticks ?? 0,
      successfulLights: p.successful_lights ?? 0,
      dashTicks: 0, dashDir: [0, 1], launch: null, fallen: false, respawnWait: 0, jumpedAt: -1,
    },
    prev: { jump: false, interact: false, pulse: false, dash: false, pause: false },
    fuel: fuelRules(tuning),
    lanterns: map.lanterns.map((L) => ({
      id: L.id, x: L.pos[0], y: L.pos[1], z: L.pos[2], lit: false, deposited: 0, fuel: 0, everLit: false, relitCount: 0,
    })),
    bench: null, // Ticket-04 benchmark scene switches (see createBenchGame); null in normal play
    motes: [],
    nextMote: 1,
    shades: [],
    nextShade: 1,
    drifters: [],
    nextDrifter: 1,
    charms: [],
    randomMotes: sc.random_motes ?? true,
    randomShades: sc.random_shades ?? true,
    randomDrifters: sc.random_drifters ?? map.drifters,
    windEnabled: sc.wind_enabled ?? map.wind,
    wind: { ticks: 0, dir: 0 },
    lastPulseTick: -Infinity,
  };
  const P = g.player;
  const gr = map.ground(P.x, P.z);
  if (gr !== null && P.y <= gr + 1e-6) {
    P.y = gr;
    P.grounded = true;
  }

  for (const l of sc.lanterns || []) {
    const L = g.lanterns.find((x) => x.id === l.id);
    if (!L) throw new ScenarioError(`scenario.lanterns: night ${night} has no lantern ${l.id}`);
    if (l.pos) [L.x, L.y, L.z] = l.pos;
    if (l.deposited != null) L.deposited = l.deposited;
    if (l.lit != null) L.lit = l.lit;
    // C6: lit without fuel -> 100; ever_lit defaults to lit; an unlit lantern has fuel 0
    L.everLit = l.ever_lit ?? L.lit;
    L.fuel = L.lit ? Math.round((l.fuel ?? tuning.fuel_max) * FUEL_UNIT) : 0;
    if (L.lit && l.deposited == null) L.deposited = tuning.lantern_cost;
  }

  if (Array.isArray(sc.motes)) for (const m of sc.motes) addMote(g, m[0], m[1], m[2], 'random', null);
  else if (g.randomMotes) {
    const free = map.motePoints.map((_, i) => i);
    for (let i = 0; i < WORLD.initialMotes && free.length; i++) {
      const k = free.splice(Math.floor(g.rng() * free.length), 1)[0];
      const [x, y, z] = map.motePoints[k];
      addMote(g, x, y, z, 'random', k);
    }
  }

  if (Array.isArray(sc.shades)) {
    const reserved = new Set(sc.shades.filter((s) => s.id != null).map((s) => s.id));
    for (const s of sc.shades) {
      let id = s.id;
      if (id == null) {
        do id = `S${g.nextShade++}`;
        while (reserved.has(id) || g.shades.some((x) => x.id === id));
      }
      const sh = addShade(g, s.pos[0], s.pos[2], id, 'wander', 0);
      sh.state = s.state ?? decideState(g, sh);
      if (s.target_lantern_id != null) {
        if (!g.lanterns.some((L) => L.id === s.target_lantern_id)) {
          throw new ScenarioError(`scenario.shades: night ${night} has no lantern ${s.target_lantern_id}`);
        }
        sh.target = s.target_lantern_id;
      } else if (sh.state === 'drain') {
        sh.target = [...g.lanterns].sort((a, b) => distXZ(sh, a) - distXZ(sh, b) || byId(a, b))[0].id; // C16
      }
      const left = s.state_ticks_left ?? (sh.state === 'stunned' ? T(tuning.pulse_stun_s) : sh.state === 'recoil' ? WORLD.recoilTicks : sh.state === 'spawning' ? 1 : 0);
      if (sh.state === 'recoil') {
        sh.recoilMoves = left;
        sh.recoilDir = unit(sh.x - P.x, sh.z - P.z);
      } else sh.stateTicks = left;
    }
    g.nextShade = Math.max(g.nextShade, ...g.shades.map((s) => idNum(s.id) + 1), 1);
  }

  if (Array.isArray(sc.drifters)) {
    for (const d of sc.drifters) {
      const dr = addDrifter(g, d.pos[0], d.pos[2], d.id);
      dr.state = d.state ?? 'idle';
      dr.stolen = d.stolen ?? 0;
      dr.hasStolen = dr.stolen > 0;
      if (dr.state === 'flee') dr.fleeTicks = d.state_ticks_left ?? WORLD.drifterFleeTicks;
    }
    g.nextDrifter = Math.max(g.nextDrifter, ...g.drifters.map((d) => idNum(d.id) + 1), 1);
  }

  const charmList = Array.isArray(sc.charms) ? sc.charms : map.charms.map((pos) => ({ pos }));
  charmList.forEach((c, i) => {
    const pos = c.pos ?? map.charms[i] ?? [0, 0, 0];
    g.charms.push({
      id: c.id ?? `C${i + 1}`, x: pos[0], y: pos[1], z: pos[2],
      available: c.available ?? true, respawn: c.respawn_ticks ?? 0, born: -1,
    });
  });
  return g;
}

// Ticket-04 §1 benchmark scene: Night 1, Mây still at (0,0,0), L1–L3 lit with fuel 100,
// exactly 200 wandering shades and 100 motes spread uniformly over the island (seed 42).
// Spawns, damage, pickups, fuel use and the end of the night are switched off; shades keep
// moving by the normal wander rule (Mây is not a chase target: there is no player in the bench).
export const BENCH = Object.freeze({ shades: 200, motes: 100, litLanterns: ['L1', 'L2', 'L3'] });

export function createBenchGame({ tuning, seed = 42 }) {
  const g = createGame({
    tuning, seed, night: 1,
    scenario: {
      player: { pos: [0, 0, 0] }, random_motes: false, random_shades: false, motes: [], shades: [], charms: [],
      lanterns: BENCH.litLanterns.map((id) => ({ id, lit: true, fuel: tuning.fuel_max })),
    },
  });
  g.bench = { noFuel: true };
  const isl = g.map.islands[0];
  const R = tuning.safe_radius + WORLD.safeEpsilon;
  const spot = () => {
    const r = isl.r * Math.sqrt(g.rng()); // uniform over the disc
    const a = g.rng() * Math.PI * 2;
    return [isl.x + r * Math.cos(a), isl.z + r * Math.sin(a)];
  };
  while (g.shades.length < BENCH.shades) {
    const [x, z] = spot();
    if (g.lanterns.some((L) => L.lit && Math.hypot(x - L.x, z - L.z) < R)) continue; // safe zones stay empty
    addShade(g, x, z, null, 'wander', 0);
  }
  for (let i = 0; i < BENCH.motes; i++) {
    const [x, z] = spot();
    addMote(g, x, g.map.ground(x, z) ?? 0, z, 'random', null);
  }
  return g;
}

function addMote(g, x, y, z, kind, point, ttl = null) {
  const m = { id: `M${g.nextMote++}`, x, y, z, kind, point, ttl, born: g.simTick };
  g.motes.push(m);
  return m;
}

function addShade(g, x, z, id, state, stateTicks) {
  const s = {
    id: id ?? `S${g.nextShade++}`, x, z, y: hoverY(g, x, z, WORLD.shadeHover), state, stateTicks,
    pushTicks: 0, pushDir: [1, 0], recoilMoves: 0, recoilDir: [1, 0], evict: null,
    wanderDir: [1, 0], wanderT: 0, target: null, drainTicks: 0,
  };
  g.shades.push(s);
  return s;
}

function addDrifter(g, x, z, id) {
  const d = {
    id: id ?? `D${g.nextDrifter++}`, x, z, y: hoverY(g, x, z, WORLD.drifterHover),
    state: 'idle', stolen: 0, hasStolen: false, fleeTicks: 0, angle: 0,
    anchor: { x: x - WORLD.drifterIdleRadius, z },
  };
  g.drifters.push(d);
  return d;
}

function hoverY(g, x, z, h) {
  return (g.map.ground(x, z) ?? 0) + h;
}

function decideState(g, s) {
  const P = g.player;
  return !P.fallen && distXZ(s, P) <= WORLD.detect ? 'chase' : 'wander';
}

// ---------------------------------------------------------------- one tick
const BUTTONS = ['jump', 'interact', 'pulse', 'dash', 'pause'];

export function step(g, input) {
  if (g.state === 'won' || g.state === 'lost') return [];
  const tick = ++g.tick;
  const events = [];
  const emit = (name, data = {}) => events.push({ type: 'event', tick, name, data });
  const edge = {};
  for (const b of BUTTONS) edge[b] = !!input[b] && !g.prev[b];
  for (const b of BUTTONS) g.prev[b] = !!input[b];

  // 1. input: pause first; a tick that pauses (or stays paused) stops here
  if (edge.pause) {
    g.paused = !g.paused;
    emit(g.paused ? 'paused' : 'resumed');
    g.state = g.paused ? 'paused' : 'playing';
  }
  if (g.paused) return events;

  const ctx = { g, input, edge, emit, safeOn: [] };
  phase2Counters(ctx);
  phase2bLanternsOut(ctx);
  phase3MovePlayer(ctx);
  phase4Pickup(ctx);
  phase5Interact(ctx);
  phase6SafeZones(ctx);
  phase7Pulse(ctx);
  phase8MoveEnemies(ctx);
  phase9Contacts(ctx);
  phase10Spawn(ctx);
  phase11WinLose(ctx);
  return events;
}

// 2. counters: time, cooldowns, invulnerability, stun, charm, dropped-mote TTL, charm respawn,
//    and (Ticket-03) fuel: every lit lantern decays, every shade in `drain` takes its share (C2)
function phase2Counters({ g, emit }) {
  const P = g.player;
  g.simTick++;
  for (const k of ['invuln', 'dashCd', 'pulseCd', 'charm', 'respawnWait']) if (P[k] > 0) P[k]--;
  for (const s of g.shades) if (s.stateTicks > 0 && (s.state === 'stunned' || s.state === 'spawning')) s.stateTicks--;
  g.motes = g.motes.filter((m) => m.ttl === null || --m.ttl > 0);
  for (const c of g.charms) if (!c.available && c.respawn > 0) c.respawn--;
  for (const d of g.drifters) {
    if (d.state === 'flee' && d.fleeTicks > 0 && --d.fleeTicks === 0) d.state = 'removed';
  }
  if (g.wind.ticks > 0) g.wind.ticks--;
  if (g.windEnabled && g.simTick % WORLD.windEvery === 0) {
    g.wind = { ticks: WORLD.windTicks, dir: Math.floor(g.rng() * 360) };
  }

  if (g.bench?.noFuel) return;
  const F = g.fuel;
  for (const L of g.lanterns) if (L.lit) L.fuel = Math.max(0, L.fuel - F.decay);
  const due = [];
  for (const s of [...g.shades].sort(byId)) {
    if (s.state !== 'drain') continue;
    const L = g.lanterns.find((l) => l.id === s.target);
    if (!L || !L.lit) continue;
    L.fuel = Math.max(0, L.fuel - F.drain); // several shades add up (Ticket-03 §2)
    if (++s.drainTicks % WORLD.drainEventEvery === 0) due.push([L, s]); // C3
  }
  for (const [L, s] of due) emit('fuel_drain', { lantern_id: L.id, shade_id: s.id, fuel: fuelOut(L.fuel) });
}

// 2b. (Ticket-03) right after phase 2: a lit lantern with fuel ≤ 0 goes out
function phase2bLanternsOut({ g, emit }) {
  for (const L of g.lanterns) {
    if (!L.lit || L.fuel > 0) continue;
    Object.assign(L, { lit: false, deposited: 0, fuel: 0 }); // everLit stays true
    emit('lantern_out', { lantern_id: L.id });
  }
}

// 3. move Mây: jump, dash, jump pads, wind; then the fall check
function phase3MovePlayer({ g, input, edge, emit }) {
  const t = g.tuning;
  const P = g.player;
  const map = g.map;
  if (P.fallen) {
    P.vx = P.vy = P.vz = 0;
    if (P.respawnWait > 0) return;
    [P.x, P.y, P.z] = map.start;
    Object.assign(P, { fallen: false, grounded: true, facing: 0, launch: null, dashTicks: 0, invuln: WORLD.respawnInvuln });
    return;
  }
  let [mx, mz] = input.move || [0, 0];
  const len = Math.hypot(mx, mz);
  if (len > 1) {
    mx /= len;
    mz /= len;
  }
  const th = ((input.cam_yaw_deg || 0) * Math.PI) / 180;
  const wx = mx * Math.cos(th) + mz * Math.sin(th);
  const wz = -mx * Math.sin(th) + mz * Math.cos(th);
  if ((wx !== 0 || wz !== 0) && !P.launch) P.facing = Math.atan2(wx, wz);

  if (edge.dash && P.dashTicks === 0 && (P.dashCd === 0 || P.charm > 0)) {
    P.dashDir = wx !== 0 || wz !== 0 ? unit(wx, wz) : [Math.sin(P.facing), Math.cos(P.facing)];
    P.dashTicks = T(t.dash_duration_s);
    P.dashCd = P.charm > 0 ? 0 : T(t.dash_cooldown_s);
    if (!P.grounded) P.vy = 0;
    emit('dash');
  }
  if (edge.jump && P.grounded && P.dashTicks === 0) {
    P.vy = WORLD.jumpSpeed;
    P.grounded = false;
    P.jumpedAt = g.tick;
  }

  let hx;
  let hz;
  const dashing = P.dashTicks > 0;
  if (dashing) {
    hx = P.dashDir[0] * t.dash_speed;
    hz = P.dashDir[1] * t.dash_speed;
    P.dashTicks--;
  } else if (P.launch) {
    hx = P.launch.vx;
    hz = P.launch.vz;
  } else {
    const sp = P.charm > 0 ? WORLD.charmSpeed : t.player_speed;
    hx = wx * sp;
    hz = wz * sp;
  }
  if (g.wind.ticks > 0) {
    const a = (g.wind.dir * Math.PI) / 180;
    hx += Math.cos(a) * WORLD.windSpeed;
    hz += Math.sin(a) * WORLD.windSpeed;
  }

  const prevY = P.y;
  let vyEff = 0;
  if (!dashing && !P.grounded) {
    P.y += P.vy / TICK_RATE;
    vyEff = P.vy;
    P.vy -= WORLD.gravity / TICK_RATE;
  }

  const can = (x, z) => {
    const gr = map.ground(x, z);
    if (gr !== null && gr > P.y + WORLD.stepUp) return false; // vertical wall (B4)
    return !blockedByObstacle(map, x, z, P.y);
  };
  const nx = P.x + hx / TICK_RATE;
  const nz = P.z + hz / TICK_RATE;
  if (can(nx, nz)) [P.x, P.z] = [nx, nz];
  else if (can(nx, P.z)) P.x = nx;
  else if (can(P.x, nz)) P.z = nz;

  const gr = map.ground(P.x, P.z);
  if (P.grounded) {
    if (gr === null || gr < P.y - WORLD.stepUp) {
      P.grounded = false; // walked/dashed off a ledge or into the cloud sea (a dash keeps its altitude)
      P.vy = 0;
    } else P.y = gr; // follow the ground, including ramps
  } else if (gr !== null && P.y <= gr && prevY >= gr - WORLD.stepUp) {
    P.y = gr;
    P.vy = 0;
    P.grounded = true;
    P.launch = null;
  }

  if (P.grounded && !dashing) {
    for (const pad of map.pads) {
      if (Math.hypot(P.x - pad.pos[0], P.z - pad.pos[2]) <= 1.0 && Math.abs(P.y - pad.pos[1]) < 0.05) {
        const [dx, dz] = pad.dir ?? unit(pad.target[0] - pad.pos[0], pad.target[2] - pad.pos[2]);
        P.launch = { vx: dx * pad.vh, vz: dz * pad.vh };
        P.vy = pad.vy;
        P.grounded = false;
        break;
      }
    }
  }
  P.vx = hx;
  P.vz = hz;
  P.vy = P.grounded ? 0 : P.vy;
  P.vyOut = vyEff;

  if (P.y < WORLD.fallY && !P.fallen) {
    P.flames--;
    const lost = P.carried;
    P.carried = 0;
    Object.assign(P, { fallen: true, respawnWait: WORLD.respawnWait, launch: null, dashTicks: 0, vy: 0 });
    emit('player_hit', { by: 'fall', flames: P.flames, dropped: 0, lost });
  }
}

// 4. pick up motes and charms
function phase4Pickup({ g, emit }) {
  const P = g.player;
  if (P.fallen || g.bench) return;
  const t = g.tuning;
  const reach = (o) => o.born < g.simTick && distXZ(P, o) <= t.pickup_radius && Math.abs(P.y - o.y) <= WORLD.pickupHeight;
  const cap = capacityOf(t, P);
  for (let i = 0; i < g.motes.length && P.carried < cap; ) {
    if (reach(g.motes[i])) {
      g.motes.splice(i, 1);
      P.carried++;
      emit('mote_picked', { carried: P.carried });
    } else i++;
  }
  for (const c of g.charms) {
    if (c.available && reach(c)) {
      c.available = false;
      c.respawn = WORLD.charmRespawnTicks;
      P.charm = WORLD.charmTicks;
      emit('charm_picked', { charm_id: c.id, charm_ticks: WORLD.charmTicks });
    }
  }
}

// 5. interact with lanterns. Ticket-03: candidates are lanterns that can take motes (unlit, or
//    lit but not full); nearest within 2 m, ties -> smaller id. Lit -> refuel; unlit -> deposit.
function phase5Interact(ctx) {
  const { g, edge, emit } = ctx;
  const P = g.player;
  const t = g.tuning;
  const F = g.fuel;
  if (!edge.interact || P.carried <= 0 || P.fallen) return;
  const L = g.lanterns
    .filter((l) => (!l.lit || l.fuel < F.max) && distXZ(P, l) <= t.interact_radius)
    .sort((a, b) => distXZ(P, a) - distXZ(P, b) || byId(a, b))[0];
  if (!L) return;
  if (L.lit) {
    const used = Math.min(P.carried, Math.ceil((F.max - L.fuel) / F.perMote));
    P.carried -= used;
    L.fuel = Math.min(F.max, L.fuel + F.perMote * used);
    g.score += t.score.per_mote * used;
    emit('refuel', { lantern_id: L.id, amount: used, fuel: fuelOut(L.fuel) });
    if (L.fuel >= F.low) ctx.safeOn.push(L); // C11: the safe zone is (back) on
    return;
  }
  const cost = L.everLit ? t.relight_cost : t.lantern_cost;
  const amount = Math.min(P.carried, cost - L.deposited);
  if (amount <= 0) return;
  P.carried -= amount;
  L.deposited += amount;
  g.score += t.score.per_mote * amount;
  emit('deposit', { lantern_id: L.id, amount, deposited: L.deposited });
  if (L.deposited >= cost) {
    const relight = L.everLit;
    Object.assign(L, { lit: true, fuel: F.max, everLit: true });
    if (relight) L.relitCount++;
    g.score += relight ? t.score.per_relight : t.score.per_lantern;
    P.successfulLights++;
    ctx.safeOn.push(L);
    emit('lantern_lit', { lantern_id: L.id, relight });
  }
}

// 6. safe zones: shades inside a lantern that was just lit, or refuelled to ≥ 30, are evicted
//    (≤ 30 ticks, no damage meanwhile); a draining shade gives up and becomes `wander`
function phase6SafeZones({ g, safeOn }) {
  const R = g.tuning.safe_radius + WORLD.safeEpsilon;
  for (const L of safeOn) {
    for (const s of g.shades) {
      const d = distXZ(s, L);
      if (d >= R) continue;
      s.evict = { x: L.x, z: L.z, left: WORLD.evictTicks, dir: unit(s.x - L.x, s.z - L.z) };
      if (s.state === 'drain') Object.assign(s, { state: 'wander', target: null });
    }
  }
}

// 7. pulse ("Tỏa Sáng")
function phase7Pulse({ g, edge, emit }) {
  const P = g.player;
  const t = g.tuning;
  if (!edge.pulse || P.pulseCd > 0 || P.carried < t.pulse_cost || P.fallen) return;
  P.carried -= t.pulse_cost;
  P.pulseCd = T(t.pulse_cooldown_s);
  g.lastPulseTick = g.tick;
  const cy = P.y + WORLD.pulseCenterY;
  const in3d = (o) => Math.hypot(o.x - P.x, o.y - cy, o.z - P.z) <= t.pulse_radius;
  const hit = g.shades.filter(in3d).sort(byId);
  for (const s of hit) {
    // Ticket-03 §5: +5 per shade, +15 in total if it was draining right before
    g.score += s.state === 'drain' ? t.score.per_stun_drain : t.score.per_stun;
    s.target = null;
    s.state = 'stunned';
    s.stateTicks = T(t.pulse_stun_s);
    s.pushTicks = WORLD.pushTicks;
    s.pushDir = unit(s.x - P.x, s.z - P.z);
    s.recoilMoves = 0;
  }
  emit('pulse', { stunned_ids: hit.map((s) => s.id) });
  for (const d of g.drifters.filter((x) => x.state !== 'removed' && in3d(x)).sort(byId)) {
    if (d.state === 'chase') {
      d.state = 'flee';
      d.fleeTicks = WORLD.drifterFleeTicks;
    } else if (d.state === 'flee' && d.stolen > 0) {
      const y = g.map.ground(d.x, d.z);
      const [x, z, gy] = y === null ? [P.x, P.z, P.y] : [d.x, d.z, y];
      for (let i = 0; i < d.stolen; i++) addMote(g, x, gy, z, 'dropped', null, WORLD.dropTtl);
      emit('drifter_drop', { drifter_id: d.id, amount: d.stolen });
      d.stolen = 0;
      d.fleeTicks = WORLD.drifterVanishTicks;
    }
  }
}

// 8. move shades and drifters
function moveShade(g, s, dx, dz) {
  const map = g.map;
  const R = g.tuning.safe_radius + WORLD.safeEpsilon;
  const ok = (x, z) => map.ground(x, z) !== null && !blockedByObstacle(map, x, z, -Infinity);
  let nx = s.x + dx;
  let nz = s.z + dz;
  for (const L of g.lanterns) {
    if (!L.lit || L.fuel < g.fuel.low) continue; // Ticket-03: fuel < 30 -> no safe zone (exactly 30 keeps it)
    const d = Math.hypot(nx - L.x, nz - L.z);
    if (d < R) {
      const [ux, uz] = unit(nx - L.x, nz - L.z);
      nx = L.x + ux * R;
      nz = L.z + uz * R;
    }
  }
  if (ok(nx, nz)) [s.x, s.z] = [nx, nz];
  else if (ok(nx, s.z)) s.x = nx;
  else if (ok(s.x, nz)) s.z = nz;
  else return false;
  return true;
}

// Ticket-03 §2 (C8): a wandering shade heads for the nearest lit lantern with fuel < 30 (ties ->
// smaller id) and starts draining once ≤ 2 m away; otherwise it heads for the nearest unlit
// lantern and lingers once ≤ 2 m away; with no such lantern it roams randomly (B9).
export function wanderTarget(g, s) {
  const near = (list) => list.sort((a, b) => distXZ(s, a) - distXZ(s, b) || byId(a, b))[0] ?? null;
  return near(g.lanterns.filter((L) => L.lit && L.fuel < g.fuel.low)) ?? near(g.lanterns.filter((L) => !L.lit));
}

function wanderMove(g, s) {
  const v = WORLD.wanderSpeed / TICK_RATE;
  const L = wanderTarget(g, s);
  s.target = L ? L.id : null;
  if (!L) {
    if (--s.wanderT <= 0) {
      const a = g.rng() * Math.PI * 2;
      s.wanderDir = [Math.cos(a), Math.sin(a)];
      s.wanderT = WORLD.wanderTurnTicks;
    }
    if (!moveShade(g, s, s.wanderDir[0] * v, s.wanderDir[1] * v)) s.wanderT = 0;
    return;
  }
  const dist = distXZ(s, L);
  if (dist > WORLD.drainReach) {
    const [ux, uz] = unit(L.x - s.x, L.z - s.z);
    const m = Math.min(v, dist);
    moveShade(g, s, ux * m, uz * m);
  }
  if (L.lit && distXZ(s, L) <= WORLD.drainReach) Object.assign(s, { state: 'drain', drainTicks: 0 });
}

function phase8MoveEnemies({ g }) {
  const P = g.player;
  const t = g.tuning;
  const speed = (g.map.shadeSpeed ?? t.shade_speed) / TICK_RATE;
  for (const s of g.shades) {
    if (s.state === 'spawning') {
      if (s.stateTicks > 0) continue;
      s.state = decideState(g, s);
    }
    if (s.evict) {
      const d = Math.hypot(s.x - s.evict.x, s.z - s.evict.z);
      const target = t.safe_radius + WORLD.safeEpsilon;
      const stepLen = Math.max(0, (target - d) / s.evict.left);
      s.x += s.evict.dir[0] * stepLen;
      s.z += s.evict.dir[1] * stepLen;
      if (--s.evict.left <= 0) s.evict = null;
      if (s.state === 'stunned' && s.stateTicks === 0) s.state = 'wander'; // Ticket-03: stun ends -> wander
      s.y = hoverY(g, s.x, s.z, WORLD.shadeHover);
      continue;
    }
    if (s.state === 'stunned') {
      if (s.pushTicks > 0) {
        if (!moveShade(g, s, (s.pushDir[0] * t.pulse_push_m) / WORLD.pushTicks, (s.pushDir[1] * t.pulse_push_m) / WORLD.pushTicks)) s.pushTicks = 1;
        s.pushTicks--;
      }
      if (s.stateTicks > 0) {
        s.y = hoverY(g, s.x, s.z, WORLD.shadeHover);
        continue;
      }
      s.state = 'wander'; // Ticket-03: stun ends -> wander (the chase check below still applies this tick)
    }
    if (s.state === 'recoil') {
      if (s.recoilMoves > 0) {
        moveShade(g, s, (s.recoilDir[0] * WORLD.recoilMeters) / WORLD.recoilTicks, (s.recoilDir[1] * WORLD.recoilMeters) / WORLD.recoilTicks);
        s.recoilMoves--;
        if (s.recoilMoves === 0) s.state = decideState(g, s);
      } else s.state = decideState(g, s);
      s.y = hoverY(g, s.x, s.z, WORLD.shadeHover);
      continue;
    }
    const d = P.fallen || g.bench ? Infinity : distXZ(s, P); // bench: Mây is not a target
    if (s.state === 'drain') {
      // Ticket-03 §2: drain -> chase (Mây ≤ 6 m) | wander (lantern out, refuelled ≥ 30, or > 2 m away)
      const L = g.lanterns.find((l) => l.id === s.target);
      if (d <= WORLD.drainBreak) Object.assign(s, { state: 'chase', target: null });
      else if (!L || !L.lit || L.fuel >= g.fuel.low || distXZ(s, L) > WORLD.drainReach) Object.assign(s, { state: 'wander', target: null });
      else {
        s.y = hoverY(g, s.x, s.z, WORLD.shadeHover);
        continue; // stays still; it drains in phase 2 of the next tick
      }
    }
    if (s.state === 'chase' && d > WORLD.lose) s.state = 'wander';
    else if (s.state === 'wander' && d <= WORLD.detect) s.state = 'chase';
    if (s.state === 'chase') {
      s.target = null; // a chasing shade does not change target (Mây)
      const [ux, uz] = unit(P.x - s.x, P.z - s.z);
      const m = Math.min(speed, d);
      moveShade(g, s, ux * m, uz * m);
    } else wanderMove(g, s);
    s.y = hoverY(g, s.x, s.z, WORLD.shadeHover);
  }

  for (const d of g.drifters) {
    if (d.state === 'removed') continue;
    if (d.state === 'idle' || d.state === 'chase') {
      const want = !P.fallen && !d.hasStolen && P.carried >= WORLD.drifterChaseCarry && distXZ(d, P) <= WORLD.drifterChaseDist;
      if (d.state === 'idle' && want) d.state = 'chase';
      else if (d.state === 'chase' && !want) {
        d.state = 'idle';
        d.anchor = { x: d.x - Math.cos(d.angle) * WORLD.drifterIdleRadius, z: d.z - Math.sin(d.angle) * WORLD.drifterIdleRadius };
      }
    }
    const v = WORLD.drifterSpeed / TICK_RATE;
    if (d.state === 'idle') {
      d.angle += WORLD.drifterIdleSpeed / TICK_RATE / WORLD.drifterIdleRadius;
      d.x = d.anchor.x + Math.cos(d.angle) * WORLD.drifterIdleRadius;
      d.z = d.anchor.z + Math.sin(d.angle) * WORLD.drifterIdleRadius;
    } else if (d.state === 'chase') {
      const dist = distXZ(d, P);
      const [ux, uz] = unit(P.x - d.x, P.z - d.z);
      d.x += ux * Math.min(v, dist);
      d.z += uz * Math.min(v, dist);
    } else if (d.state === 'flee') {
      const [ux, uz] = unit(d.x - P.x, d.z - P.z);
      d.x += ux * v;
      d.z += uz * v;
    }
    d.y = hoverY(g, d.x, d.z, WORLD.drifterHover);
  }
}

// 9. contacts: drifters steal first, then shades hit (ascending id), at most one hit per tick
function phase9Contacts({ g, emit }) {
  const P = g.player;
  const t = g.tuning;
  if (P.fallen) return;
  for (const d of [...g.drifters].sort(byId)) {
    if (d.state !== 'chase' || distXZ(d, P) > WORLD.drifterTouch) continue;
    const amount = Math.min(WORLD.drifterStealMax, P.carried);
    P.carried -= amount;
    Object.assign(d, { stolen: amount, hasStolen: true, state: 'flee', fleeTicks: WORLD.drifterFleeTicks });
    emit('drifter_steal', { drifter_id: d.id, amount, carried: P.carried });
  }
  if (P.invuln > 0 || g.bench) return; // bench: no damage
  const hitter = [...g.shades]
    .sort(byId)
    .find((s) => (s.state === 'chase' || s.state === 'wander') && !s.evict && distXZ(s, P) <= t.shade_hit_radius && Math.abs(s.y - P.y) <= WORLD.hitHeight);
  if (!hitter) return;
  P.flames--;
  const dropped = Math.floor(P.carried * t.hit_drop_ratio);
  P.carried -= dropped;
  for (let i = 0; i < dropped; i++) {
    let spot = null;
    for (let k = 0; k < 12 && !spot; k++) {
      const a = g.rng() * Math.PI * 2;
      const r = WORLD.dropRingMin + g.rng() * (WORLD.dropRingMax - WORLD.dropRingMin);
      const x = P.x + Math.cos(a) * r;
      const z = P.z + Math.sin(a) * r;
      const gy = g.map.ground(x, z);
      if (gy !== null && !blockedByObstacle(g.map, x, z, -Infinity)) spot = [x, gy, z];
    }
    spot ??= [P.x, P.y, P.z];
    addMote(g, spot[0], spot[1], spot[2], 'dropped', null, WORLD.dropTtl);
  }
  P.invuln = T(t.invuln_s);
  Object.assign(hitter, { state: 'recoil', recoilMoves: WORLD.recoilTicks, recoilDir: unit(hitter.x - P.x, hitter.z - P.z) });
  emit('player_hit', { by: 'shade', flames: P.flames, dropped });
}

// 10. scheduled spawns (new entities only interact from the next tick)
function phase10Spawn({ g, emit }) {
  if (g.bench) return; // bench: no new entities
  const map = g.map;
  const st = g.simTick;
  if (g.randomMotes && st % WORLD.moteSpawnEvery === 0 && g.motes.length < WORLD.moteCap) {
    const used = new Set(g.motes.filter((m) => m.point !== null).map((m) => m.point));
    const free = map.motePoints.map((_, i) => i).filter((i) => !used.has(i));
    if (free.length) {
      const k = free[Math.floor(g.rng() * free.length)];
      const [x, y, z] = map.motePoints[k];
      addMote(g, x, y, z, 'random', k);
    }
  }
  if (g.randomShades) {
    let n = 0;
    if (st === WORLD.shadeFirstSpawn) n = 2;
    else if (st > WORLD.shadeFirstSpawn && (st - WORLD.shadeFirstSpawn) % map.shadeInterval === 0) n = 1;
    const valid = map.shadePoints.filter(([x, , z]) => Math.hypot(x - g.player.x, z - g.player.z) >= WORLD.shadeMinPlayerDist);
    for (let i = 0; i < n && g.shades.length < map.shadeMax && valid.length; i++) {
      const [x, , z] = valid.splice(Math.floor(g.rng() * valid.length), 1)[0];
      let id;
      do id = `S${g.nextShade++}`;
      while (g.shades.some((s) => s.id === id));
      addShade(g, x, z, id, 'spawning', 1);
      emit('shade_spawned', { id });
    }
  }
  if (g.randomDrifters && st % WORLD.drifterEvery === 0 && g.drifters.filter((d) => d.state !== 'removed').length < WORLD.drifterMax) {
    const [x, , z] = map.shadePoints[Math.floor(g.rng() * map.shadePoints.length)];
    let id;
    do id = `D${g.nextDrifter++}`;
    while (g.drifters.some((d) => d.id === id));
    addDrifter(g, x, z, id);
  }
  for (const c of g.charms) {
    if (!c.available && c.respawn === 0) {
      c.available = true;
      c.born = st;
    }
  }
}

// 11. win / lose, after every other update of the tick (Ticket-03 §3): no flames -> lost
//     (always first, even on the dawn tick); dawn -> won if lit lanterns ≥ ceil(0.6 × total)
function phase11WinLose({ g, emit }) {
  if (g.bench) return; // bench: the night never ends
  const P = g.player;
  const t = g.tuning;
  let over = null;
  if (P.flames <= 0) over = ['lost', 'no_flames'];
  else if (g.simTick >= g.endSim) {
    const lit = g.lanterns.filter((L) => L.lit).length;
    over = lit >= litNeeded(t, g.lanterns.length) ? ['won', 'dawn_survived'] : ['lost', 'dawn'];
  }
  if (!over) return;
  [g.result, g.reason] = over;
  g.state = g.result;
  if (g.result === 'won') g.score += dawnBonus(g);
  emit('game_over', { result: g.result, reason: g.reason });
}

// Ticket-03 §5: per lit lantern 50 + floor(fuel); per flame left 50 (no time bonus any more)
export function dawnBonus(g) {
  const s = g.tuning.score;
  let b = s.per_flame_left * g.player.flames;
  for (const L of g.lanterns) if (L.lit) b += s.per_lit_lantern_dawn + Math.floor(L.fuel / FUEL_UNIT);
  return b;
}

export function timeLeft(g) {
  return Math.max(0, g.timeStart - g.simTick / TICK_RATE);
}

// ---------------------------------------------------------------- output
export function snapshot(g) {
  const P = g.player;
  const s = (ticks) => r3(ticks / TICK_RATE);
  return {
    type: 'snapshot',
    tick: g.tick,
    sim_tick: g.simTick,
    night: g.night,
    state: g.state,
    time_left_s: r3(timeLeft(g)),
    score: g.score,
    wind: { active: g.wind.ticks > 0, dir_deg: g.wind.dir },
    player: {
      pos: [r3(P.x), r3(P.y), r3(P.z)],
      vel: [r3(P.vx), r3(P.vyOut ?? 0), r3(P.vz)],
      grounded: P.grounded,
      flames: P.flames,
      carried: P.carried,
      invuln: s(P.invuln),
      dash_cd_s: s(P.dashCd),
      pulse_cd_s: s(P.pulseCd),
      charm_s: s(P.charm),
      capacity: capacityOf(g.tuning, P),
    },
    lanterns: g.lanterns.map((L) => ({
      id: L.id, pos: [r3(L.x), r3(L.y), r3(L.z)], lit: L.lit, deposited: L.deposited,
      fuel: L.lit ? fuelOut(L.fuel) : 0, ever_lit: L.everLit, relit_count: L.relitCount,
    })),
    shades: g.shades.map((x) => ({ id: x.id, pos: [r3(x.x), r3(x.y), r3(x.z)], state: x.state, target_lantern_id: x.target })),
    motes_active: g.motes.length,
    motes: g.motes.map((m) => ({ id: m.id, pos: [r3(m.x), r3(m.y), r3(m.z)], kind: m.kind, ttl_s: m.ttl === null ? null : s(m.ttl) })),
    drifters: g.drifters.map((d) => ({ id: d.id, pos: [r3(d.x), r3(d.y), r3(d.z)], state: d.state, stolen: d.stolen })),
    charms: g.charms.map((c) => ({ id: c.id, pos: [r3(c.x), r3(c.y), r3(c.z)], available: c.available, respawn_s: s(c.respawn) })),
  };
}
