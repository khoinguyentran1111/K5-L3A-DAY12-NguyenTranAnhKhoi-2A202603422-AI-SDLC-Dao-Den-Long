// Black-box checks of the headless CLI against Test Contract v1.1 + v1.2 (format, exit codes,
// tick model, nights, fuel fields and events, determinism, time limit). Run: npm test
// Phase 3: the night durations changed (Ticket-03 §3: 240/270/300 s) and a night now always
// runs to dawn unless the flames run out, so the duration/full-night checks were updated.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-contract-'));
const contract = JSON.parse(fs.readFileSync(path.join(ROOT, 'game.contract.json'), 'utf8'));
const OFF = { random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false, motes: [], shades: [] };
let n = 0;

const headless = (args) => spawnSync(process.execPath, ['src/headless.js', ...args], { cwd: ROOT, encoding: 'utf8' });
function runOk(extra = [], { seed = 42, ticks = 600, night = 1 } = {}) {
  const out = path.join(TMP, `out${n++}.jsonl`);
  const t0 = Date.now();
  const r = headless(['--seed', String(seed), '--night', String(night), '--ticks', String(ticks), '--out', out, ...extra]);
  const ms = Date.now() - t0;
  assert.equal(r.status, 0, r.stderr);
  const text = fs.readFileSync(out, 'utf8');
  return { text, ms, lines: text.trim().split('\n').map((l) => JSON.parse(l)) };
}
function writeTmp(name, content) {
  const p = path.join(TMP, name);
  fs.writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content));
  return p;
}

test('game.contract.json is v1.2+ with every tuning key (v1.1 keys + Ticket-03 fuel keys)', () => {
  for (const k of ['contract_version', 'team', 'build_cmd', 'run_cmd', 'headless_cmd', 'tuning']) assert.ok(k in contract, k);
  assert.ok(Number(contract.contract_version) >= 1.2, contract.contract_version);
  const keys = ['player_speed', 'carry_capacity', 'lantern_cost', 'lantern_count_night1', 'pickup_radius', 'interact_radius',
    'pulse_cost', 'pulse_radius', 'night1_duration_s', 'night2_duration_s', 'night3_duration_s', 'flames', 'invuln_s',
    'hit_drop_ratio', 'pulse_stun_s', 'pulse_push_m', 'pulse_cooldown_s', 'safe_radius', 'shade_speed', 'shade_hit_radius',
    'dash_speed', 'dash_duration_s', 'dash_cooldown_s',
    'fuel_max', 'fuel_decay_per_s', 'fuel_per_mote', 'relight_cost', 'win_ratio', 'drain_per_s', 'low_fuel_threshold', 'capacity_max'];
  for (const k of keys) assert.equal(typeof contract.tuning[k], 'number', k);
  assert.equal(contract.tuning.fall_enabled, true);
});

test('output: snapshot 0, night_start, snapshots every 10 ticks, end line last', () => {
  const { lines } = runOk([], { ticks: 95 });
  assert.equal(lines[0].type, 'snapshot');
  assert.deepEqual(lines[1], { type: 'event', tick: 0, name: 'night_start', data: { night: 1 } });
  assert.deepEqual(lines.filter((l) => l.type === 'snapshot').map((l) => l.tick), [0, 10, 20, 30, 40, 50, 60, 70, 80, 90]);
  assert.equal(lines.at(-1).type, 'end');
  assert.equal(lines.at(-1).ticks, 95);
  assert.equal(lines.filter((l) => l.type === 'end').length, 1);
});

test('v1.1 snapshot fields and types', () => {
  const { lines } = runOk([], { ticks: 10, night: 3 });
  const s = lines[0];
  for (const k of ['type', 'tick', 'sim_tick', 'night', 'state', 'time_left_s', 'score', 'wind', 'player', 'lanterns', 'shades', 'motes_active', 'motes', 'drifters', 'charms']) {
    assert.ok(k in s, k);
  }
  assert.equal(s.night, 3);
  assert.deepEqual(Object.keys(s.wind).sort(), ['active', 'dir_deg']);
  const p = s.player;
  assert.equal(p.vel.length, 3);
  assert.equal(typeof p.grounded, 'boolean');
  for (const k of ['invuln', 'dash_cd_s', 'pulse_cd_s', 'charm_s', 'flames', 'carried']) assert.equal(typeof p[k], 'number', k);
  for (const m of s.motes) {
    assert.deepEqual(Object.keys(m).sort(), ['id', 'kind', 'pos', 'ttl_s']);
    assert.ok(['random', 'dropped'].includes(m.kind));
  }
  for (const c of s.charms) for (const k of ['id', 'available', 'respawn_s']) assert.ok(k in c, k);
  assert.equal(s.motes_active, s.motes.length);
});

test('v1.2 fields: lantern fuel (1 decimal, 0 when unlit), ever_lit, relit_count; player capacity', () => {
  const sc = writeTmp('v12.json', { ...OFF, lanterns: [{ id: 'L1', lit: true, fuel: 33.33 }, { id: 'L2', lit: true }, { id: 'L3', ever_lit: true }] });
  const { lines } = runOk(['--scenario', sc], { ticks: 10 });
  const [L1, L2, L3, L4] = lines[0].lanterns;
  assert.deepEqual([L1.fuel, L1.ever_lit, L1.relit_count], [33.3, true, 0]);
  assert.equal(L2.fuel, 100, 'lit without fuel -> 100');
  assert.deepEqual([L3.lit, L3.fuel, L3.ever_lit], [false, 0, true]);
  assert.deepEqual([L4.fuel, L4.ever_lit], [0, false]);
  assert.equal(lines[0].player.capacity, 10);
  for (const s of lines.filter((l) => l.type === 'snapshot')) for (const L of s.lanterns) assert.ok((String(L.fuel).split('.')[1] || '').length <= 1, `${L.fuel}`);
});

test('v1.2 events: refuel, lantern_lit.relight, lantern_out, fuel_drain, game_over dawn_survived', () => {
  // Hand-derived: tick 1 refuels L1 (75 = 4500 units, minus 1 decay = 4499; used = ceil(1501/600) = 3)
  // -> carried 6; walk 2.5 m to L4 (ever lit) and relight it with 5 at tick 31; L3 (fuel 0.5 = 30 units)
  // goes out at tick 30; S1 drains L2 from tick 1, the 60th drain tick is tick 60: 1740 − 60 − 300 = 1380 = 23.0;
  // dawn at tick 90 with L1, L2, L4 lit = 3 ≥ ceil(0.6 × 5) -> won.
  const sc = writeTmp('v12ev.json', {
    ...OFF, time_left_s: 1.5, player: { pos: [0, 0, 0], carried: 9 },
    lanterns: [{ id: 'L1', pos: [0, 0, 1], lit: true, fuel: 75 }, { id: 'L2', lit: true, fuel: 29 }, { id: 'L3', lit: true, fuel: 0.5 }, { id: 'L4', pos: [0, 0, -4], ever_lit: true }],
    shades: [{ id: 'S1', pos: [21.8, 1, 7.7], state: 'drain', target_lantern_id: 'L2' }],
  });
  const inp = writeTmp('v12in.json', { frames: [{ tick: 0, interact: true }, { tick: 1, interact: false, move: [0, -1] }, { tick: 26, move: [0, 0] }, { tick: 30, interact: true }] });
  const ev = runOk(['--scenario', sc, '--inputs', inp], { ticks: 200 }).lines.filter((l) => l.type === 'event');
  const by = (name) => ev.filter((e) => e.name === name);
  assert.deepEqual(by('refuel')[0], { type: 'event', tick: 1, name: 'refuel', data: { lantern_id: 'L1', amount: 3, fuel: 100 } });
  assert.deepEqual(by('deposit')[0].data, { lantern_id: 'L4', amount: 5, deposited: 5 });
  assert.deepEqual(by('lantern_lit')[0].data, { lantern_id: 'L4', relight: true });
  assert.deepEqual(by('lantern_out')[0], { type: 'event', tick: 30, name: 'lantern_out', data: { lantern_id: 'L3' } });
  assert.deepEqual(by('fuel_drain')[0], { type: 'event', tick: 60, name: 'fuel_drain', data: { lantern_id: 'L2', shade_id: 'S1', fuel: 23 } });
  assert.deepEqual(by('game_over')[0].data, { result: 'won', reason: 'dawn_survived' });
  assert.equal(ev.some((e) => e.data && e.data.reason === 'all_lit'), false);
});

test('--night 1/2/3 select the map (lantern count, Ticket-03 duration); other nights are rejected', () => {
  for (const [night, lanterns, secs] of [[1, 5, 240], [2, 6, 270], [3, 7, 300]]) {
    const s = runOk([], { night, ticks: 0 }).lines[0];
    assert.equal(s.lanterns.length, lanterns);
    assert.equal(s.time_left_s, secs);
  }
  const r = headless(['--seed', '1', '--night', '4', '--ticks', '5', '--out', path.join(TMP, 'x.jsonl')]);
  assert.notEqual(r.status, 0);
});

test('tick model: events in step k are stamped k+1; time_left_s = duration - sim_tick/60', () => {
  const sc = writeTmp('tm.json', { ...OFF, motes: [[0, 0, 0.5]] });
  const { lines } = runOk(['--scenario', sc], { ticks: 60 });
  assert.deepEqual(lines.find((l) => l.type === 'event' && l.name === 'mote_picked'), { type: 'event', tick: 1, name: 'mote_picked', data: { carried: 1 } });
  assert.equal(lines.find((l) => l.type === 'snapshot' && l.tick === 60).time_left_s, 239);
});

test('coordinates are rounded to at most 3 decimals', () => {
  const dec = (x) => (String(x).split('.')[1] || '').length;
  for (const night of [1, 2, 3]) {
    const { lines } = runOk([], { ticks: 900, night });
    for (const s of lines.filter((l) => l.type === 'snapshot')) {
      const vals = [...s.player.pos, ...s.player.vel, ...s.shades.flatMap((x) => x.pos), ...s.motes.flatMap((x) => x.pos), ...s.drifters.flatMap((x) => x.pos)];
      for (const v of vals) assert.ok(dec(v) <= 3, `${v}`);
    }
  }
});

test('determinism on every night: same seed -> byte-identical, other seed -> different', () => {
  const inputs = writeTmp('det.json', { frames: [{ tick: 0, move: [0.3, 1], cam_yaw_deg: 30 }, { tick: 300, pulse: true, dash: true }, { tick: 301, pulse: false, dash: false }] });
  const h = (t) => crypto.createHash('sha256').update(t).digest('hex');
  for (const night of [1, 2, 3]) {
    const a = runOk(['--inputs', inputs], { seed: 99, ticks: 5000, night }).text;
    const b = runOk(['--inputs', inputs], { seed: 99, ticks: 5000, night }).text;
    const c = runOk(['--inputs', inputs], { seed: 100, ticks: 5000, night }).text;
    assert.equal(h(a), h(b), `night ${night}`);
    assert.notEqual(h(a), h(c), `night ${night}`);
  }
});

test('a full night (runs to dawn: 14,400 / 16,200 / 18,000 ticks) finishes well within 30 s on every night', () => {
  const sc = writeTmp('long.json', { player: { flames: 999 } });
  for (const [night, secs] of [[1, 240], [2, 270], [3, 300]]) {
    const { ms, lines } = runOk(['--scenario', sc], { ticks: 21600, night });
    assert.ok(ms < 30000, `night ${night}: ${ms} ms`);
    assert.equal(lines.at(-1).ticks, secs * 60, 'no early end any more: the night lasts until dawn');
  }
});

test('malformed inputs / scenario -> exit code 2 with a message on stderr', () => {
  const badInputs = {
    'json.json': '{ not json', 'order.json': { frames: [{ tick: 5 }, { tick: 5 }] }, 'move.json': { frames: [{ tick: 0, move: [2, 0] }] },
    'btn.json': { frames: [{ tick: 0, dash: 1 }] }, 'pause.json': { frames: [{ tick: 0, pause: 'yes' }] }, 'noframes.json': { foo: [] },
  };
  for (const [name, content] of Object.entries(badInputs)) {
    const r = headless(['--seed', '1', '--night', '1', '--ticks', '5', '--out', path.join(TMP, 'x.jsonl'), '--inputs', writeTmp(name, content)]);
    assert.equal(r.status, 2, name);
    assert.ok(r.stderr.length > 0, name);
  }
  const badScenarios = {
    'sc1.json': { lanterns: [{ id: 'L9' }] }, 'sc2.json': { motes: [[0, 0]] }, 'sc3.json': [1, 2],
    'sc4.json': { shades: [{ pos: [1, 0, 1], state: 'angry' }] }, 'sc5.json': { player: { invuln_ticks: -1 } },
    'sc6.json': { lanterns: [{ id: 'L7', lit: true }] }, // L7 exists only on night 3
    'sc7.json': { lanterns: [{ id: 'L1', lit: true, fuel: 120 }] }, // v1.2: fuel in [0, 100]
    'sc8.json': { lanterns: [{ id: 'L1', ever_lit: 'yes' }] },
    'sc9.json': { shades: [{ pos: [1, 0, 1], state: 'drain', target_lantern_id: 'L9' }] },
    'sc10.json': { shades: [{ pos: [1, 0, 1], target_lantern_id: 'L6' }] }, // L6 does not exist on night 1
    'sc11.json': { player: { successful_lights: 1.5 } },
  };
  for (const [name, content] of Object.entries(badScenarios)) {
    const r = headless(['--seed', '1', '--night', '1', '--ticks', '5', '--out', path.join(TMP, 'x.jsonl'), '--scenario', writeTmp(name, content)]);
    assert.equal(r.status, 2, name);
  }
});

test('bad command line -> non-zero exit with stderr', () => {
  for (const args of [
    ['--night', '1', '--ticks', '5', '--out', path.join(TMP, 'y.jsonl')],
    ['--seed', 'abc', '--night', '1', '--ticks', '5', '--out', path.join(TMP, 'y.jsonl')],
    ['--seed', '1', '--night', '1', '--ticks', '5'],
  ]) {
    const r = headless(args);
    assert.notEqual(r.status, 0, args.join(' '));
    assert.ok(r.stderr.length > 0);
  }
});

test('--ticks 0 writes snapshot 0, night_start and the end line', () => {
  const { lines } = runOk([], { ticks: 0 });
  assert.equal(lines.length, 3);
  assert.deepEqual(lines[2], { type: 'end', ticks: 0, state: 'playing', score: 0 });
});

test('paused snapshots: tick advances, sim_tick and time do not; end counts all ticks', () => {
  const inputs = writeTmp('pause.json', { frames: [{ tick: 5, pause: true }] });
  const { lines } = runOk(['--inputs', inputs, '--snapshot-every', '5'], { ticks: 30 });
  const s30 = lines.find((l) => l.type === 'snapshot' && l.tick === 30);
  assert.equal(s30.state, 'paused');
  assert.equal(s30.sim_tick, 5);
  assert.equal(lines.at(-1).ticks, 30);
  assert.equal(lines.at(-1).state, 'paused');
});
