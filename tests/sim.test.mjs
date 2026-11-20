// Unit tests for the pure simulation (src/core/sim.js). Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createGame, step, snapshot, defaultLanterns, WORLD } from '../src/core/sim.js';

const tuning = JSON.parse(fs.readFileSync(new URL('../game.contract.json', import.meta.url))).tuning;
const EMPTY = { random_motes: false, random_shades: false, motes: [], shades: [] };
const idle = { move: [0, 0], cam_yaw_deg: 0 };
const game = (scenario = {}, seed = 1) => createGame({ tuning, seed, scenario: { ...EMPTY, ...scenario } });
const run = (g, n, input = idle) => {
  const ev = [];
  for (let i = 0; i < n; i++) ev.push(...step(g, input));
  return ev;
};

test('contract tuning declares exactly 5 lanterns and the game builds 5 (L1 at 0,0,25)', () => {
  assert.equal(tuning.lantern_count_night1, 5);
  const L = defaultLanterns();
  assert.deepEqual(L.map((l) => l.id), ['L1', 'L2', 'L3', 'L4', 'L5']);
  assert.deepEqual([L[0].x, L[0].z], [0, 25]);
});

test('diagonal move [1,1] is normalized to player_speed', () => {
  const g = game();
  run(g, 60, { move: [1, 1], cam_yaw_deg: 0 });
  assert.ok(Math.abs(Math.hypot(g.player.x, g.player.z) - tuning.player_speed) < 1e-9);
});

test('short move vector [0,0.5] is NOT normalized (half speed)', () => {
  const g = game();
  run(g, 60, { move: [0, 0.5], cam_yaw_deg: 0 });
  assert.ok(Math.abs(g.player.z - tuning.player_speed / 2) < 1e-9);
});

test('move x=1 at yaw 0 goes +X; yaw 180 reverses', () => {
  const g = game();
  run(g, 60, { move: [1, 0], cam_yaw_deg: 0 });
  assert.ok(Math.abs(g.player.x - 6) < 1e-9);
  const h = game();
  run(h, 60, { move: [0, 1], cam_yaw_deg: 180 });
  assert.ok(Math.abs(h.player.z + 6) < 1e-9);
});

test('player is clamped to the island (fall_enabled = false, no fall event)', () => {
  const g = game();
  const ev = run(g, 60 * 20, { move: [0, 1], cam_yaw_deg: 0 });
  assert.ok(Math.hypot(g.player.x, g.player.z) <= WORLD.islandRadius + 1e-9);
  assert.equal(ev.filter((e) => e.name === 'player_hit').length, 0);
});

test('pickup respects pickup_radius boundary and carry_capacity', () => {
  const g = game({ motes: [[0, 0, tuning.pickup_radius + 0.01]] });
  assert.equal(run(g, 1).length, 0, 'just outside the radius: not picked');
  const motes = Array.from({ length: 10 }, () => [0, 0, 0.5]);
  const h = game({ motes });
  const ev = run(h, 1);
  assert.equal(h.player.carried, tuning.carry_capacity);
  assert.equal(ev.filter((e) => e.name === 'mote_picked').length, tuning.carry_capacity);
  assert.equal(h.motes.length, 10 - tuning.carry_capacity);
});

test('interact out of interact_radius does nothing; partial deposit keeps lantern unlit', () => {
  const far = game({ player: { pos: [0, 0, 25 - tuning.interact_radius - 0.1], carried: 3 } });
  assert.equal(run(far, 1, { ...idle, interact: true }).length, 0);
  const g = game({ player: { pos: [0, 0, 24], carried: 3 } });
  const ev = run(g, 1, { ...idle, interact: true });
  assert.deepEqual(ev.map((e) => e.name), ['deposit']);
  assert.deepEqual(ev[0].data, { lantern_id: 'L1', amount: 3, deposited: 3 });
  assert.equal(g.lanterns[0].lit, false);
});

test('deposit only takes what the lantern still needs', () => {
  const g = game({ player: { pos: [0, 0, 24], carried: 7 }, lanterns: [{ id: 'L1', deposited: 4 }] });
  const ev = run(g, 1, { ...idle, interact: true });
  assert.deepEqual(ev[0].data, { lantern_id: 'L1', amount: 1, deposited: 5 });
  assert.equal(g.player.carried, 6);
  assert.equal(ev[1].name, 'lantern_lit');
});

test('buttons trigger only on false -> true (holding interact deposits once)', () => {
  const g = game({ player: { pos: [0, 0, 24], carried: 2 } });
  const ev = run(g, 30, { ...idle, interact: true });
  assert.equal(ev.filter((e) => e.name === 'deposit').length, 1);
});

test('pulse cooldown blocks a second pulse before pulse_cooldown_s', () => {
  const g = game({ player: { carried: 8 } });
  const cd = Math.round(tuning.pulse_cooldown_s * 60);
  const press = (n) => [...step(g, { ...idle, pulse: true }), ...run(g, n - 1, idle)];
  const first = press(cd - 1); // pulse at step 0, release, wait until step cd-1
  const early = step(g, { ...idle, pulse: true }); // step cd-1: still cooling down
  step(g, idle);
  const late = step(g, { ...idle, pulse: true }); // step cd+1: allowed
  assert.equal(first.filter((e) => e.name === 'pulse').length, 1);
  assert.equal(early.filter((e) => e.name === 'pulse').length, 0);
  assert.equal(late.filter((e) => e.name === 'pulse').length, 1);
  assert.equal(g.player.carried, 8 - 2 * tuning.pulse_cost);
});

test('pulse with no shade in range still fires (empty stunned_ids) and scores 0', () => {
  const g = game({ player: { carried: 2 }, shades: [{ id: 'S9', pos: [tuning.pulse_radius + 0.5, 0, 0] }] });
  const ev = run(g, 1, { ...idle, pulse: true });
  assert.deepEqual(ev[0], { type: 'event', tick: 1, name: 'pulse', data: { stunned_ids: [] } });
  assert.equal(g.score, 0);
});

test('invulnerability: after a hit, no second hit before invuln_s', () => {
  const g = game({ player: { flames: 3 }, shades: [{ pos: [0.5, 0, 0] }] });
  const inv = Math.round(tuning.invuln_s * 60);
  const ev = run(g, inv + 1);
  const hits = ev.filter((e) => e.name === 'player_hit');
  assert.deepEqual(hits.map((h) => h.tick), [1, 1 + inv]);
});

test('a stunned shade does not hurt the player', () => {
  const g = game({ player: { carried: 2 }, shades: [{ pos: [0.5, 0, 0] }] });
  const ev = run(g, 1, { ...idle, pulse: true });
  assert.equal(ev.filter((e) => e.name === 'player_hit').length, 0);
  assert.equal(snapshot(g).shades[0].state, 'stunned');
});

test('UNLIT lanterns are not safe zones (assumption A6)', () => {
  const g = game({ player: { pos: [0, 0, 25] }, shades: [{ pos: [0, 0, 30] }] });
  const ev = run(g, 200);
  assert.ok(ev.some((e) => e.name === 'player_hit'));
});

test('dropped motes land back on the island and keep the total conserved', () => {
  const g = game({ player: { pos: [39, 0, 0], carried: 8 }, shades: [{ pos: [39.5, 0, 0] }] });
  const ev = run(g, 1);
  const hit = ev.find((e) => e.name === 'player_hit');
  assert.equal(hit.data.dropped, 4);
  assert.equal(g.player.carried + g.motes.length, 8);
  for (const m of g.motes) assert.ok(Math.hypot(m.x, m.z) <= WORLD.islandRadius + 1e-9);
});

test('dropped = floor(carried * hit_drop_ratio) for odd counts (assumption A8)', () => {
  const g = game({ player: { carried: 3 }, shades: [{ pos: [0.5, 0, 0] }] });
  const hit = run(g, 1).find((e) => e.name === 'player_hit');
  assert.equal(hit.data.dropped, Math.floor(3 * tuning.hit_drop_ratio));
  assert.equal(g.player.carried, 3 - Math.floor(3 * tuning.hit_drop_ratio));
});

test('random mode spawns shades over time with shade_spawned events and unique ids', () => {
  const g = createGame({ tuning, seed: 7 });
  const ev = run(g, WORLD.shadeSpawnTicks * 2 + 1, { move: [0, 0], cam_yaw_deg: 0 });
  const ids = g.shades.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  if (g.state === 'playing') assert.ok(ev.some((e) => e.name === 'shade_spawned'));
});

test('scenario shades: explicit ids are kept, auto ids skip them', () => {
  const g = game({ shades: [{ pos: [10, 0, 0] }, { id: 'S1', pos: [20, 0, 0] }] });
  assert.deepEqual(g.shades.map((s) => s.id), ['S2', 'S1']);
});

test('same seed -> identical run; different seed -> different world', () => {
  const play = (seed) => {
    const g = createGame({ tuning, seed });
    const out = [JSON.stringify(snapshot(g))];
    for (let i = 0; i < 3000; i++) out.push(JSON.stringify(step(g, { move: [Math.sin(i / 50), 1], cam_yaw_deg: i % 360 })));
    out.push(JSON.stringify(snapshot(g)));
    return out.join('\n');
  };
  assert.equal(play(123), play(123));
  assert.notEqual(play(123), play(124));
});

test('no event or score is produced after game over', () => {
  const g = game({ time_left_s: 0.5 });
  run(g, 30);
  assert.equal(g.state, 'lost');
  assert.deepEqual(run(g, 10), []);
});
