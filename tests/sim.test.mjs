// Unit tests for the pure simulation (src/core/sim.js, Test Contract v1.1 / Ticket-02). Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createGame, step, snapshot, ambientIntensity, SHADE_STATES, WORLD } from '../src/core/sim.js';
import { NIGHTS } from '../src/core/maps.js';

const tuning = JSON.parse(fs.readFileSync(new URL('../game.contract.json', import.meta.url))).tuning;
const OFF = { random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false, motes: [], shades: [], charms: [] };
const idle = { move: [0, 0], cam_yaw_deg: 0 };
const game = (scenario = {}, night = 1, seed = 1) => createGame({ tuning, seed, night, scenario: { ...OFF, ...scenario } });
const run = (g, n, input = idle) => {
  const ev = [];
  for (let i = 0; i < n; i++) ev.push(...step(g, input));
  return ev;
};
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

test('tuning equals the Ticket-02 standard numbers', () => {
  const want = {
    player_speed: 6, carry_capacity: 10, lantern_cost: 10, lantern_count_night1: 5, pickup_radius: 1, interact_radius: 2,
    pulse_cost: 3, pulse_radius: 5, night1_duration_s: 300, night2_duration_s: 330, night3_duration_s: 360, flames: 3,
    invuln_s: 1.5, hit_drop_ratio: 0.5, pulse_stun_s: 2, pulse_push_m: 4, pulse_cooldown_s: 3, safe_radius: 6,
    shade_speed: 4, shade_hit_radius: 1, fall_enabled: true, dash_speed: 14, dash_duration_s: 0.2, dash_cooldown_s: 1.5,
  };
  for (const [k, v] of Object.entries(want)) assert.equal(tuning[k], v, k);
  assert.deepEqual(tuning.score, { per_mote: 10, per_lantern: 100, per_stun: 5, per_second_left: 2, per_flame_left: 50 });
});

test('maps: point counts, lantern counts and Night 1 lanterns follow Ticket-02', () => {
  assert.equal(NIGHTS[1].motePoints.length, 24);
  assert.equal(NIGHTS[2].motePoints.length, 24);
  assert.equal(NIGHTS[3].motePoints.length, 30);
  assert.deepEqual([NIGHTS[1].shadePoints.length, NIGHTS[2].shadePoints.length, NIGHTS[3].shadePoints.length], [12, 16, 16]);
  assert.deepEqual(NIGHTS[1].lanterns.map((l) => l.pos), [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]]);
  assert.deepEqual([NIGHTS[1].shadeMax, NIGHTS[2].shadeMax, NIGHTS[3].shadeMax], [6, 8, 10]);
  for (const n of [1, 2, 3]) for (const p of NIGHTS[n].motePoints) assert.equal(NIGHTS[n].ground(p[0], p[2]), p[1], `night ${n} point ${p}`);
});

test('Night 3 terrain: tier heights, ramp mid-height, cloud sea outside', () => {
  const gr = NIGHTS[3].ground;
  assert.equal(gr(0, 5), 6);
  assert.equal(gr(0, 18), 3);
  assert.equal(gr(0, -18), 0, 'tier 1 only on the z > 0 half');
  assert.equal(gr(0, 10), 0, 'gap between tier 2 and tier 1');
  const a = Math.PI / 6;
  assert.ok(near(gr(27 * Math.cos(a), 27 * Math.sin(a)), 1.5));
  assert.equal(gr(46, 0), null);
  assert.equal(NIGHTS[2].ground(35, 2.5), null, 'no railing: off the bridge is cloud sea');
});

test('run speed 6.0 m/s, 7.2 m/s with the Wind Charm', () => {
  const g = game();
  run(g, 60, { move: [0, 1], cam_yaw_deg: 0 });
  assert.ok(near(g.player.z, 6));
  const h = game({ player: { charm_ticks: 600 } });
  run(h, 60, { move: [0, 1], cam_yaw_deg: 0 });
  assert.ok(near(h.player.z, 7.2));
});

test('move vectors longer than 1 are normalized; shorter ones are not (contract C)', () => {
  const g = game();
  run(g, 60, { move: [1, 1], cam_yaw_deg: 0 });
  assert.ok(near(Math.hypot(g.player.x, g.player.z), 6));
  const h = game();
  run(h, 60, { move: [0, 0.5], cam_yaw_deg: 0 });
  assert.ok(near(h.player.z, 3), 'half stick = half speed');
});

test('jump only from the ground (no double jump)', () => {
  const g = game();
  step(g, { ...idle, jump: true });
  step(g, idle);
  const vy = g.player.vy;
  step(g, { ...idle, jump: true });
  assert.ok(g.player.vy < vy, 'second press in the air did not add velocity');
});

test('dash from standing goes the way Mây faces (last move direction)', () => {
  const g = game();
  run(g, 10, { move: [1, 0], cam_yaw_deg: 0 });
  const x0 = g.player.x;
  step(g, { ...idle, dash: true });
  run(g, 20);
  assert.ok(near(g.player.x - x0, 2.8, 1e-9));
});

test('pickup: capacity 10; motes are only reachable from the next tick after they appear', () => {
  const g = game({ motes: Array.from({ length: 12 }, () => [0, 0, 0.5]) });
  run(g, 1);
  assert.equal(g.player.carried, tuning.carry_capacity);
  assert.equal(g.motes.length, 2);
});

test('interact: nearest unlit lantern, ties go to the smaller id; lit lanterns are skipped', () => {
  const g = game({ player: { carried: 4 }, lanterns: [{ id: 'L2', pos: [1.5, 0, 0] }, { id: 'L1', pos: [-1.5, 0, 0] }] });
  const ev = run(g, 1, { ...idle, interact: true });
  assert.equal(ev[0].data.lantern_id, 'L1');
  const h = game({ player: { carried: 4 }, lanterns: [{ id: 'L1', pos: [1, 0, 0], lit: true }, { id: 'L2', pos: [1.9, 0, 0] }] });
  assert.equal(run(h, 1, { ...idle, interact: true })[0].data.lantern_id, 'L2');
});

test('pulse with fewer than 3 motes does nothing (no event, no cooldown)', () => {
  const g = game({ player: { carried: 2 }, shades: [{ pos: [2, 0, 0] }] });
  assert.deepEqual(run(g, 1, { ...idle, pulse: true }).filter((e) => e.name === 'pulse'), []);
  assert.equal(g.player.pulseCd, 0);
  assert.equal(g.player.carried, 2);
});

test('pulse range is 3D from feet + 0.8 m (XZ 4.99 hits, XZ 5.0 misses because of the 0.2 m height)', () => {
  const g = game({ player: { carried: 3 }, shades: [{ id: 'S1', pos: [4.99, 0, 0], state: 'wander' }, { id: 'S2', pos: [0, 0, 5.0], state: 'wander' }] });
  const ev = run(g, 1, { ...idle, pulse: true });
  assert.deepEqual(ev.find((e) => e.name === 'pulse').data.stunned_ids, ['S1']);
});

test('stun lasts exactly 120 ticks; pulse on a stunned shade refreshes it and scores +5 again', () => {
  const g = game({ player: { carried: 6 }, shades: [{ id: 'S1', pos: [2, 0, 0] }] });
  run(g, 1, { ...idle, pulse: true });
  run(g, 119);
  assert.equal(snapshot(g).shades[0].state, 'stunned', 'tick 120: still stunned');
  const probe = createGame({ tuning, seed: 1, night: 1, scenario: { ...OFF, player: { carried: 3 }, shades: [{ id: 'S1', pos: [2, 0, 0] }] } });
  run(probe, 1, { ...idle, pulse: true });
  run(probe, 120);
  assert.notEqual(snapshot(probe).shades[0].state, 'stunned', 'tick 121: stun is over');
  g.player.pulseCd = 0;
  g.player.x = g.shades[0].x - 1;
  run(g, 1, { ...idle, pulse: true });
  assert.equal(g.shades[0].stateTicks, 120);
  assert.equal(g.score, 2 * tuning.score.per_stun);
});

test('at most one flame lost per tick even with two shades touching', () => {
  const g = game({ shades: [{ id: 'S1', pos: [0.5, 0, 0] }, { id: 'S2', pos: [-0.5, 0, 0] }] });
  const ev = run(g, 1);
  assert.equal(ev.filter((e) => e.name === 'player_hit').length, 1);
  assert.equal(g.shades.find((s) => s.id === 'S1').state, 'recoil', 'lowest id hits first');
  assert.equal(g.shades.find((s) => s.id === 'S2').state, 'chase');
});

test('a shade touching Mây during invulnerability does nothing (no recoil)', () => {
  const g = game({ player: { invuln_ticks: 50 }, shades: [{ id: 'S1', pos: [0.5, 0, 0] }] });
  assert.deepEqual(run(g, 10), []);
  assert.equal(g.shades[0].state, 'chase');
});

test('a shade on another tier (height difference > 1.5) cannot hit', () => {
  const g = createGame({ tuning, seed: 1, night: 3, scenario: { ...OFF, player: { pos: [0, 0, 24.6] }, shades: [{ id: 'S1', pos: [0, 0, 23.8], state: 'wander' }] } });
  assert.equal(g.shades[0].y, 4, 'shade hovers 1 m above tier 1');
  g.shades[0].wanderT = 1e9;
  g.shades[0].wanderDir = [0, 0];
  assert.equal(run(g, 1).filter((e) => e.name === 'player_hit').length, 0);
});

test('detect at ≤ 12 m, give up only beyond 18 m (hysteresis)', () => {
  const g = game({ shades: [{ id: 'S1', pos: [12.5, 0, 0] }], player: { pos: [0, 0, 0] } });
  const s = g.shades[0];
  assert.equal(s.state, 'wander');
  s.wanderDir = [0, 0];
  s.wanderT = 1e9;
  g.player.x = 1;
  run(g, 1);
  assert.equal(s.state, 'chase');
  g.player.x = s.x - 17.5;
  run(g, 1);
  assert.equal(s.state, 'chase', '17.5 m < 18 m: keeps chasing');
  g.player.x = s.x - 19;
  run(g, 1);
  assert.equal(s.state, 'wander');
});

test('shades use only the 5 v1.1 state names over a long random run on every night', () => {
  for (const night of [1, 2, 3]) {
    const g = createGame({ tuning, seed: 2, night, scenario: { player: { flames: 99 } } });
    for (let i = 0; i < 6000 && g.state === 'playing'; i++) {
      step(g, { move: [Math.sin(i / 90), Math.cos(i / 70)], cam_yaw_deg: 0, pulse: i % 200 === 0, dash: i % 150 === 0 });
      for (const s of g.shades) assert.ok(SHADE_STATES.includes(s.state), `night ${night}: ${s.state}`);
    }
  }
});

test('Night 3 shades are faster (4.5 m/s)', () => {
  const g = createGame({ tuning, seed: 1, night: 3, scenario: { ...OFF, player: { pos: [0, 0, -30] }, shades: [{ id: 'S1', pos: [10, 0, -30] }] } });
  run(g, 60);
  assert.ok(near(g.shades[0].x, 10 - 4.5, 1e-9));
});

test('spawn schedule: Night 2 every 420 ticks up to 8, Night 3 every 360 up to 10', () => {
  for (const [night, every, max] of [[2, 420, 8], [3, 360, 10]]) {
    const g = createGame({ tuning, seed: 4, night, scenario: { random_motes: false, random_drifters: false, wind_enabled: false, player: { flames: 999 } } });
    const ticks = run(g, 300 + every * (max + 2)).filter((e) => e.name === 'shade_spawned').map((e) => e.tick);
    const want = [300, 300, ...Array.from({ length: max - 2 }, (_, i) => 300 + every * (i + 1))];
    assert.deepEqual(ticks, want, `night ${night}`);
  }
});

test('drifters: none on Night 1; on Night 2 at ticks 1200, 2400 (max 2 alive) with ids D1, D2', () => {
  const g1 = createGame({ tuning, seed: 1, night: 1, scenario: { random_motes: false, random_shades: false } });
  run(g1, 2500);
  assert.equal(g1.drifters.length, 0);
  const g2 = createGame({ tuning, seed: 1, night: 2, scenario: { random_motes: false, random_shades: false } });
  run(g2, 1199);
  assert.equal(g2.drifters.length, 0);
  run(g2, 1);
  assert.deepEqual(g2.drifters.map((d) => d.id), ['D1']);
  run(g2, 1200);
  assert.deepEqual(g2.drifters.map((d) => d.id), ['D1', 'D2']);
  run(g2, 1200);
  assert.equal(g2.drifters.filter((d) => d.state !== 'removed').length, 2, 'cap 2 alive');
});

test('mote cap is 30 (Night 3 has 30 points: reaches 30 at tick 2400 and stays)', () => {
  const g = createGame({ tuning, seed: 9, night: 3, scenario: { random_shades: false, random_drifters: false, wind_enabled: false } });
  run(g, 2399);
  assert.equal(g.motes.length, 29);
  run(g, 1);
  assert.equal(g.motes.length, 30);
  run(g, 480);
  assert.equal(g.motes.length, 30);
});

test('dropped motes vanish after 480 ticks', () => {
  const g = game({ player: { carried: 4 }, shades: [{ pos: [0.5, 0, 0] }] });
  run(g, 1);
  g.shades = []; // only measure the TTL (otherwise the shade comes back and hits again)
  assert.equal(g.motes.filter((m) => m.kind === 'dropped').length, 2);
  run(g, 479); // dropped at tick 1 -> present on ticks 1..480 (480 ticks)
  assert.equal(g.motes.filter((m) => m.kind === 'dropped').length, 2);
  run(g, 1); // tick 481
  assert.equal(g.motes.filter((m) => m.kind === 'dropped').length, 0);
});

test('win on the very tick time runs out; no_flames beats all_lit in the same tick', () => {
  const g = game({ time_left_s: 0.5, player: { carried: 10 }, lanterns: [1, 2, 3, 4].map((i) => ({ id: `L${i}`, lit: true })).concat([{ id: 'L5', pos: [0, 0, 1] }]) });
  run(g, 29);
  const ev = run(g, 1, { ...idle, interact: true });
  assert.equal(g.simTick, g.endSim);
  assert.deepEqual(ev.at(-1).data, { result: 'won', reason: 'all_lit' });
  // A shade next to a lantern that is being lit is evicted and cannot hit (S7), so the priority
  // is checked with a constructed state: no flames left while every lantern is lit -> lost.
  const h = game({ player: { flames: 0 }, lanterns: [1, 2, 3, 4, 5].map((i) => ({ id: `L${i}`, lit: true })) });
  assert.deepEqual(run(h, 1).at(-1).data, { result: 'lost', reason: 'no_flames' });
  // and the evicted shade really does not hit while the last lantern is lit
  const k = game({ player: { carried: 10, flames: 1 }, shades: [{ pos: [0.5, 0, 0] }], lanterns: [1, 2, 3, 4].map((i) => ({ id: `L${i}`, lit: true })).concat([{ id: 'L5', pos: [0, 0, 1] }]) });
  assert.deepEqual(run(k, 1, { ...idle, interact: true }).at(-1).data, { result: 'won', reason: 'all_lit' });
});

test('pause freezes cooldowns and time; other buttons do nothing while paused', () => {
  const g = game({ player: { carried: 9, pulse_cd_ticks: 50 } });
  step(g, { ...idle, pause: true });
  run(g, 100, { ...idle, pause: true, pulse: true });
  assert.equal(g.player.pulseCd, 50);
  assert.equal(g.simTick, 0);
  assert.equal(g.tick, 101);
  assert.equal(snapshot(g).state, 'paused');
});

test('same seed -> identical run on every night; different seed -> different', () => {
  const play = (night, seed) => {
    const g = createGame({ tuning, seed, night });
    const out = [];
    for (let i = 0; i < 4000; i++) out.push(JSON.stringify(step(g, { move: [Math.sin(i / 40), 1], cam_yaw_deg: i % 360, pulse: i % 240 === 0, dash: i % 97 === 0 })));
    out.push(JSON.stringify(snapshot(g)));
    return out.join('\n');
  };
  for (const n of [1, 2, 3]) {
    assert.equal(play(n, 77), play(n, 77));
    assert.notEqual(play(n, 77), play(n, 78));
  }
});

test('ambient light intensity = 0.15 + 0.55 × lit/total (F9)', () => {
  assert.equal(ambientIntensity(0, 5), 0.15);
  assert.ok(near(ambientIntensity(5, 5), 0.7));
  assert.ok(near(ambientIntensity(3, 6), 0.425));
});

test('no event and no state change after game over', () => {
  const g = game({ time_left_s: 0.5 });
  run(g, 30);
  assert.equal(g.state, 'lost');
  assert.deepEqual(run(g, 10), []);
  assert.equal(WORLD.moteCap, 30);
});
