// Black-box checks of the headless CLI against Test Contract v1.1 (format, exit codes,
// tick model, nights, determinism, time limit). Run: npm test
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

test('game.contract.json is v1.1 with every tuning key (incl. dash_* and night2/3 durations)', () => {
  for (const k of ['contract_version', 'team', 'build_cmd', 'run_cmd', 'headless_cmd', 'tuning']) assert.ok(k in contract, k);
  assert.equal(contract.contract_version, '1.1');
  const keys = ['player_speed', 'carry_capacity', 'lantern_cost', 'lantern_count_night1', 'pickup_radius', 'interact_radius',
    'pulse_cost', 'pulse_radius', 'night1_duration_s', 'night2_duration_s', 'night3_duration_s', 'flames', 'invuln_s',
    'hit_drop_ratio', 'pulse_stun_s', 'pulse_push_m', 'pulse_cooldown_s', 'safe_radius', 'shade_speed', 'shade_hit_radius',
    'dash_speed', 'dash_duration_s', 'dash_cooldown_s'];
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

test('--night 1/2/3 select the map (lantern count, duration); other nights are rejected', () => {
  for (const [night, lanterns, secs] of [[1, 5, 300], [2, 6, 330], [3, 7, 360]]) {
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
  assert.equal(lines.find((l) => l.type === 'snapshot' && l.tick === 60).time_left_s, 299);
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

test('a full night (21,600 ticks max) finishes well within 30 s on every night', () => {
  const sc = writeTmp('long.json', { player: { flames: 999 } });
  for (const night of [1, 2, 3]) {
    const { ms, lines } = runOk(['--scenario', sc], { ticks: 21600, night });
    assert.ok(ms < 30000, `night ${night}: ${ms} ms`);
    assert.ok(lines.at(-1).ticks > 17000);
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
