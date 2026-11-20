// Pure game logic for Đảo Đèn Lồng, shared by the headless runner and the browser.
// Rules: no DOM, no Node APIs, no Date/Math.random. All randomness comes from the
// seeded RNG, so the same (seed, scenario, inputs) always produces the same states.
// Fixed step: 60 ticks per second. Distances are measured on the XZ plane.
import { mulberry32 } from './rng.js';

export const TICK_RATE = 60;

// Game-design constants that are not part of the contract `tuning` block.
// Documented in docs/notes/phase1.md (assumptions).
export const WORLD = Object.freeze({
  islandRadius: 40, // round island, player is clamped inside (fall_enabled = false)
  lanternRingRadius: 25, // default lanterns sit on this ring, L1 at (0, 0, 25)
  shadeY: 1.0, // shades hover: shade.pos is the centre, 1 m above ground
  jumpSpeed: 7, // m/s
  gravity: 20, // m/s^2
  initialMotes: 30,
  moteMinActive: 15, // random mode: respawn one mote every moteRespawnTicks while below this
  moteRespawnTicks: 120,
  initialShades: 2,
  maxShades: 5,
  shadeSpawnTicks: 40 * 60, // random mode: a new shade every 40 s (up to maxShades)
  shadeSpawnMinDist: 15,
  dropDistance: 3, // dropped motes land on a ring this far from the player
  safeEpsilon: 0.01, // shades are kept strictly outside safe_radius
});

export const LANTERN_IDS = ['L1', 'L2', 'L3', 'L4', 'L5'];

export const r3 = (v) => {
  const x = Math.round(v * 1000) / 1000;
  return Object.is(x, -0) ? 0 : x;
};
const distXZ = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const secToTicks = (s) => Math.round(s * TICK_RATE);

export function defaultLanterns() {
  return LANTERN_IDS.map((id, i) => {
    const a = (i * 2 * Math.PI) / LANTERN_IDS.length;
    return {
      id,
      x: r3(WORLD.lanternRingRadius * Math.sin(a)),
      y: 0,
      z: r3(WORLD.lanternRingRadius * Math.cos(a)),
      lit: false,
      deposited: 0,
    };
  });
}

function clampToIsland(o) {
  const d = Math.hypot(o.x, o.z);
  if (d > WORLD.islandRadius) {
    o.x *= WORLD.islandRadius / d;
    o.z *= WORLD.islandRadius / d;
  }
}

function keepOutOfSafeZones(g, s) {
  const r = g.tuning.safe_radius;
  if (!(r > 0)) return;
  for (const L of g.lanterns) {
    if (!L.lit) continue;
    let dx = s.x - L.x;
    let dz = s.z - L.z;
    let d = Math.hypot(dx, dz);
    // Keep a margin so that the 3-decimal rounded output is also strictly > r.
    if (d >= r + WORLD.safeEpsilon) continue;
    if (d < 1e-9) {
      dx = 1;
      dz = 0;
      d = 1;
    }
    s.x = L.x + (dx / d) * (r + WORLD.safeEpsilon);
    s.z = L.z + (dz / d) * (r + WORLD.safeEpsilon);
  }
}

function randomIslandPoint(g, minR = 3, maxR = WORLD.islandRadius - 2) {
  const a = g.rng() * 2 * Math.PI;
  const r = Math.sqrt(minR * minR + g.rng() * (maxR * maxR - minR * minR));
  return { x: r * Math.sin(a), z: r * Math.cos(a) };
}

function addMote(g, x, z) {
  const m = { id: `M${g.nextMote++}`, x, z };
  g.motes.push(m);
  return m;
}

function nextShadeId(g) {
  let id;
  do id = `S${g.nextShade++}`;
  while (g.shades.some((s) => s.id === id));
  return id;
}

function addShade(g, x, z, id) {
  const s = { id: id ?? nextShadeId(g), x, z, stun: 0 };
  g.shades.push(s);
  return s;
}

function spawnRandomShade(g) {
  for (let i = 0; i < 30; i++) {
    const p = randomIslandPoint(g, 5);
    if (distXZ(p, g.player) < WORLD.shadeSpawnMinDist) continue;
    if (g.lanterns.some((L) => L.lit && distXZ(p, L) <= g.tuning.safe_radius + 1)) continue;
    return addShade(g, p.x, p.z);
  }
  return null;
}

/**
 * Build the initial state (snapshot tick 0). `scenario` must already be validated
 * (see io.js). Scenario setup emits no events and awards no points.
 */
export function createGame({ tuning, seed = 1, scenario = {} }) {
  const t = tuning;
  const sc = scenario || {};
  const p = sc.player || {};
  const pos = p.pos || [0, 0, 0];
  const timeStart = sc.time_left_s ?? t.night1_duration_s;
  const g = {
    tuning: t,
    rng: mulberry32(seed),
    tick: 0,
    timeStart,
    endTick: Math.max(0, Math.ceil(timeStart * TICK_RATE - 1e-9)),
    state: 'playing',
    result: null,
    reason: null,
    score: 0,
    player: {
      x: pos[0],
      y: pos[1],
      z: pos[2],
      vy: 0,
      grounded: pos[1] <= 0,
      facing: 0,
      flames: p.flames ?? t.flames,
      carried: p.carried ?? 0,
      invuln: 0,
      pulseCd: 0,
    },
    prev: { jump: false, interact: false, pulse: false },
    lanterns: defaultLanterns(),
    motes: [],
    nextMote: 1,
    shades: [],
    nextShade: 1,
    randomMotes: sc.random_motes ?? true,
    randomShades: sc.random_shades ?? true,
    moteTimer: 0,
    shadeTimer: 0,
    lastPulseTick: -Infinity,
  };

  for (const l of sc.lanterns || []) {
    const L = g.lanterns.find((x) => x.id === l.id);
    if (l.pos) [L.x, L.y, L.z] = l.pos;
    if (l.deposited != null) L.deposited = l.deposited;
    if (l.lit != null) {
      L.lit = l.lit;
      if (l.lit && l.deposited == null) L.deposited = t.lantern_cost;
    }
  }

  if (Array.isArray(sc.motes)) for (const m of sc.motes) addMote(g, m[0], m[2]);
  else if (g.randomMotes) {
    for (let i = 0; i < WORLD.initialMotes; i++) {
      const q = randomIslandPoint(g);
      addMote(g, q.x, q.z);
    }
  }

  if (Array.isArray(sc.shades)) {
    const reserved = sc.shades.filter((s) => s.id != null);
    for (const s of sc.shades) {
      let id = s.id;
      if (id == null) {
        do id = `S${g.nextShade++}`;
        while (reserved.some((r) => r.id === id) || g.shades.some((x) => x.id === id));
      }
      addShade(g, s.pos[0], s.pos[2], id);
    }
  } else if (g.randomShades) {
    for (let i = 0; i < WORLD.initialShades; i++) spawnRandomShade(g);
  }
  return g;
}

/**
 * Advance one tick. `input` is the full current input state
 * { move:[x,z], cam_yaw_deg, jump, interact, pulse }. Buttons trigger on false->true.
 * Returns the events produced in this step (tick = previous tick + 1).
 */
export function step(g, input) {
  if (g.state !== 'playing') return [];
  const t = g.tuning;
  const P = g.player;
  const tick = g.tick + 1;
  const events = [];
  const emit = (name, data) => events.push({ type: 'event', tick, name, data });
  const edge = (k) => !!input[k] && !g.prev[k];
  const jumpEdge = edge('jump');
  const interactEdge = edge('interact');
  const pulseEdge = edge('pulse');
  g.prev = { jump: !!input.jump, interact: !!input.interact, pulse: !!input.pulse };
  let over = null;

  // 0. timers (an N-tick timer set during step k blocks steps k+1 .. k+N-1)
  if (P.invuln > 0) P.invuln--;
  if (P.pulseCd > 0) P.pulseCd--;
  for (const s of g.shades) if (s.stun > 0) s.stun--;

  // 1. movement relative to camera yaw (contract C)
  let [mx, mz] = input.move || [0, 0];
  const len = Math.hypot(mx, mz);
  if (len > 1) {
    mx /= len;
    mz /= len;
  }
  const th = ((input.cam_yaw_deg || 0) * Math.PI) / 180;
  const c = Math.cos(th);
  const sn = Math.sin(th);
  const wx = mx * c + mz * sn;
  const wz = -mx * sn + mz * c;
  const v = t.player_speed / TICK_RATE;
  P.x += wx * v;
  P.z += wz * v;
  if (wx !== 0 || wz !== 0) P.facing = Math.atan2(wx, wz);
  clampToIsland(P);

  if (jumpEdge && P.grounded) {
    P.vy = WORLD.jumpSpeed;
    P.grounded = false;
  }
  if (!P.grounded) {
    P.y += P.vy / TICK_RATE;
    P.vy -= WORLD.gravity / TICK_RATE;
    if (P.y <= 0) {
      P.y = 0;
      P.vy = 0;
      P.grounded = true;
    }
  }

  // 2. pick up motes (automatic, within pickup_radius, while below carry_capacity)
  for (let i = 0; i < g.motes.length && P.carried < t.carry_capacity; ) {
    const m = g.motes[i];
    if (distXZ(P, m) <= t.pickup_radius) {
      g.motes.splice(i, 1);
      P.carried++;
      g.score += t.score.per_mote;
      emit('mote_picked', { carried: P.carried });
    } else i++;
  }

  // 3. interact: deposit carried motes into the nearest unlit lantern in range
  if (interactEdge && P.carried > 0) {
    const cands = g.lanterns
      .filter((L) => !L.lit && distXZ(P, L) <= t.interact_radius)
      .sort((a, b) => distXZ(P, a) - distXZ(P, b) || a.id.localeCompare(b.id));
    const L = cands[0];
    const amount = L ? Math.min(P.carried, t.lantern_cost - L.deposited) : 0;
    if (amount > 0) {
      P.carried -= amount;
      L.deposited += amount;
      emit('deposit', { lantern_id: L.id, amount, deposited: L.deposited });
      if (L.deposited >= t.lantern_cost) {
        L.lit = true;
        g.score += t.score.per_lantern;
        emit('lantern_lit', { lantern_id: L.id });
      }
    }
  }
  if (g.lanterns.every((L) => L.lit)) over = ['won', 'all_lit'];

  if (!over) {
    // 4. pulse: costs carried light, stuns + pushes shades in pulse_radius
    if (pulseEdge && P.pulseCd === 0 && P.carried >= t.pulse_cost) {
      P.carried -= t.pulse_cost;
      P.pulseCd = secToTicks(t.pulse_cooldown_s);
      g.lastPulseTick = tick;
      const hit = g.shades.filter((s) => distXZ(P, s) <= t.pulse_radius);
      for (const s of hit) {
        s.stun = secToTicks(t.pulse_stun_s);
        let dx = s.x - P.x;
        let dz = s.z - P.z;
        let d = Math.hypot(dx, dz);
        if (d < 1e-9) {
          dx = 1;
          dz = 0;
          d = 1;
        }
        s.x += (dx / d) * t.pulse_push_m;
        s.z += (dz / d) * t.pulse_push_m;
        clampToIsland(s);
        keepOutOfSafeZones(g, s);
      }
      g.score += t.score.per_stun * hit.length;
      emit('pulse', { stunned_ids: hit.map((s) => s.id) });
    }

    // 5. shades chase the player, never entering a lit lantern's safe_radius
    const sv = t.shade_speed / TICK_RATE;
    for (const s of g.shades) {
      if (s.stun > 0) continue;
      const dx = P.x - s.x;
      const dz = P.z - s.z;
      const d = Math.hypot(dx, dz);
      if (d > 1e-9) {
        const m = Math.min(sv, d);
        s.x += (dx / d) * m;
        s.z += (dz / d) * m;
      }
      clampToIsland(s);
      keepOutOfSafeZones(g, s);
    }

    // 6. contact with an active shade: lose a flame, drop part of the carried light
    if (P.invuln === 0) {
      const s = g.shades.find((x) => x.stun === 0 && distXZ(P, x) <= t.shade_hit_radius);
      if (s) {
        P.flames--;
        const dropped = Math.floor(P.carried * t.hit_drop_ratio);
        P.carried -= dropped;
        const base = g.rng() * 2 * Math.PI;
        for (let i = 0; i < dropped; i++) {
          const a = base + (i * 2 * Math.PI) / dropped;
          const m = { x: P.x + WORLD.dropDistance * Math.sin(a), z: P.z + WORLD.dropDistance * Math.cos(a) };
          clampToIsland(m);
          addMote(g, m.x, m.z);
        }
        P.invuln = secToTicks(t.invuln_s);
        emit('player_hit', { by: 'shade', flames: P.flames, dropped });
      }
    }
    if (P.flames <= 0) over = ['lost', 'no_flames'];
  }

  if (!over) {
    // 7. random spawning (only when the scenario allows it)
    if (g.randomMotes && ++g.moteTimer >= WORLD.moteRespawnTicks) {
      g.moteTimer = 0;
      if (g.motes.length < WORLD.moteMinActive) {
        const q = randomIslandPoint(g);
        addMote(g, q.x, q.z);
      }
    }
    if (g.randomShades && ++g.shadeTimer >= WORLD.shadeSpawnTicks) {
      g.shadeTimer = 0;
      if (g.shades.length < WORLD.maxShades) {
        const s = spawnRandomShade(g);
        if (s) emit('shade_spawned', { id: s.id });
      }
    }
  }

  // 8. time
  g.tick = tick;
  if (!over && g.tick >= g.endTick) over = ['lost', 'dawn'];
  if (over) {
    [g.result, g.reason] = over;
    g.state = g.result;
    if (g.result === 'won') {
      g.score += t.score.per_second_left * Math.floor(timeLeft(g)) + t.score.per_flame_left * P.flames;
    }
    emit('game_over', { result: g.result, reason: g.reason });
  }
  return events;
}

export function timeLeft(g) {
  return Math.max(0, g.timeStart - g.tick / TICK_RATE);
}

export function snapshot(g) {
  const P = g.player;
  return {
    type: 'snapshot',
    tick: g.tick,
    sim_tick: g.tick,
    state: g.state,
    time_left_s: r3(timeLeft(g)),
    score: g.score,
    player: { pos: [r3(P.x), r3(P.y), r3(P.z)], flames: P.flames, carried: P.carried },
    lanterns: g.lanterns.map((L) => ({
      id: L.id,
      pos: [r3(L.x), r3(L.y), r3(L.z)],
      lit: L.lit,
      deposited: L.deposited,
    })),
    shades: g.shades.map((s) => ({
      id: s.id,
      pos: [r3(s.x), WORLD.shadeY, r3(s.z)],
      state: s.stun > 0 ? 'stunned' : 'chase',
    })),
    motes_active: g.motes.length,
    motes: g.motes.map((m) => ({ id: m.id, pos: [r3(m.x), 0, r3(m.z)] })),
  };
}
