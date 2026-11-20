// Black-box checks of the headless CLI against Test Contract v1.0 (format, exit codes,
// tick model, determinism). Run: npm test
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
let n = 0;

function headless(args) {
  const r = spawnSync(process.execPath, ['src/headless.js', ...args], { cwd: ROOT, encoding: 'utf8' });
  return r;
}
function runOk(extra = [], { seed = 42, ticks = 600 } = {}) {
  const out = path.join(TMP, `out${n++}.jsonl`);
  const r = headless(['--seed', String(seed), '--night', '1', '--ticks', String(ticks), '--out', out, ...extra]);
  assert.equal(r.status, 0, r.stderr);
  const text = fs.readFileSync(out, 'utf8');
  return { text, lines: text.trim().split('\n').map((l) => JSON.parse(l)) };
}
function writeTmp(name, content) {
  const p = path.join(TMP, name);
  fs.writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content));
  return p;
}

test('game.contract.json has every v1.0 field and numeric tuning', () => {
  for (const k of ['contract_version', 'team', 'build_cmd', 'run_cmd', 'headless_cmd', 'tuning']) assert.ok(k in contract, k);
  assert.equal(contract.contract_version, '1.0');
  const keys = ['player_speed', 'carry_capacity', 'lantern_cost', 'lantern_count_night1', 'pickup_radius', 'interact_radius',
    'pulse_cost', 'pulse_radius', 'night1_duration_s', 'flames', 'invuln_s', 'hit_drop_ratio', 'pulse_stun_s',
    'pulse_push_m', 'pulse_cooldown_s', 'safe_radius', 'shade_speed', 'shade_hit_radius'];
  for (const k of keys) assert.equal(typeof contract.tuning[k], 'number', k);
  assert.equal(contract.tuning.fall_enabled, false);
  for (const k of ['per_mote', 'per_lantern', 'per_stun', 'per_second_left', 'per_flame_left']) {
    assert.equal(typeof contract.tuning.score[k], 'number', k);
  }
});

test('output: snapshot every 10 ticks from 0, events between, mandatory end line last', () => {
  const { lines } = runOk([], { ticks: 95 });
  const snaps = lines.filter((l) => l.type === 'snapshot').map((l) => l.tick);
  assert.deepEqual(snaps, [0, 10, 20, 30, 40, 50, 60, 70, 80, 90]);
  assert.deepEqual(lines.at(-1), { type: 'end', ticks: 95, state: lines.at(-1).state, score: lines.at(-1).score });
  assert.equal(lines.filter((l) => l.type === 'end').length, 1);
  for (const l of lines) assert.ok(['snapshot', 'event', 'end'].includes(l.type));
});

test('snapshot has every contract field with the right types', () => {
  const { lines } = runOk([], { ticks: 10 });
  const s = lines[0];
  for (const k of ['type', 'tick', 'sim_tick', 'state', 'time_left_s', 'score', 'player', 'lanterns', 'shades', 'motes_active']) {
    assert.ok(k in s, k);
  }
  assert.equal(s.tick, 0);
  assert.equal(s.sim_tick, s.tick);
  assert.equal(s.time_left_s, contract.tuning.night1_duration_s);
  assert.deepEqual(s.player, { pos: [0, 0, 0], flames: contract.tuning.flames, carried: 0 });
  assert.equal(s.lanterns.length, 5);
  for (const L of s.lanterns) assert.deepEqual(Object.keys(L).sort(), ['deposited', 'id', 'lit', 'pos']);
  for (const sh of s.shades) assert.ok(typeof sh.id === 'string' && sh.pos.length === 3 && typeof sh.state === 'string');
  assert.equal(s.motes_active, s.motes.length);
});

test('--snapshot-every is honoured', () => {
  const { lines } = runOk(['--snapshot-every', '25'], { ticks: 100 });
  assert.deepEqual(lines.filter((l) => l.type === 'snapshot').map((l) => l.tick), [0, 25, 50, 75, 100]);
});

test('coordinates are rounded to at most 3 decimals', () => {
  const { lines } = runOk([], { ticks: 600 });
  const dec = (x) => (String(x).split('.')[1] || '').length;
  for (const s of lines.filter((l) => l.type === 'snapshot')) {
    for (const v of [...s.player.pos, ...s.shades.flatMap((x) => x.pos), ...s.lanterns.flatMap((x) => x.pos)]) {
      assert.ok(dec(v) <= 3, `${v}`);
    }
  }
});

test('tick model: events in step k are stamped k+1 and time_left_s = duration - steps/60', () => {
  const sc = writeTmp('tm.json', { random_motes: false, random_shades: false, motes: [[0, 0, 0.5]], shades: [] });
  const { lines } = runOk(['--scenario', sc], { ticks: 60 });
  const ev = lines.find((l) => l.type === 'event');
  assert.deepEqual(ev, { type: 'event', tick: 1, name: 'mote_picked', data: { carried: 1 } });
  const s60 = lines.find((l) => l.type === 'snapshot' && l.tick === 60);
  assert.equal(s60.time_left_s, contract.tuning.night1_duration_s - 1);
});

test('determinism: same seed/scenario/inputs -> byte-identical output (default random world)', () => {
  const inputs = writeTmp('det.json', { frames: [{ tick: 0, move: [0.3, 1], cam_yaw_deg: 30 }, { tick: 300, pulse: true }, { tick: 301, pulse: false }] });
  const a = runOk(['--inputs', inputs], { seed: 99, ticks: 6000 }).text;
  const b = runOk(['--inputs', inputs], { seed: 99, ticks: 6000 }).text;
  const c = runOk(['--inputs', inputs], { seed: 100, ticks: 6000 }).text;
  const h = (t) => crypto.createHash('sha256').update(t).digest('hex');
  assert.equal(h(a), h(b));
  assert.notEqual(h(a), h(c));
});

test('no inputs file means the player stands still', () => {
  const sc = writeTmp('still.json', { random_motes: false, random_shades: false, motes: [], shades: [] });
  const { lines } = runOk(['--scenario', sc], { ticks: 120 });
  assert.deepEqual(lines.filter((l) => l.type === 'snapshot').at(-1).player.pos, [0, 0, 0]);
});

test('malformed inputs / scenario -> exit code 2 with a message on stderr', () => {
  const bad = {
    'json.json': '{ not json',
    'order.json': { frames: [{ tick: 5 }, { tick: 5 }] },
    'move.json': { frames: [{ tick: 0, move: [2, 0] }] },
    'btn.json': { frames: [{ tick: 0, jump: 1 }] },
    'noframes.json': { foo: [] },
  };
  for (const [name, content] of Object.entries(bad)) {
    const r = headless(['--seed', '1', '--night', '1', '--ticks', '5', '--out', path.join(TMP, 'x.jsonl'), '--inputs', writeTmp(name, content)]);
    assert.equal(r.status, 2, name);
    assert.ok(r.stderr.length > 0, name);
  }
  const badScenarios = { 'sc1.json': { lanterns: [{ id: 'L9' }] }, 'sc2.json': { motes: [[0, 0]] }, 'sc3.json': [1, 2] };
  for (const [name, content] of Object.entries(badScenarios)) {
    const r = headless(['--seed', '1', '--night', '1', '--ticks', '5', '--out', path.join(TMP, 'x.jsonl'), '--scenario', writeTmp(name, content)]);
    assert.equal(r.status, 2, name);
  }
});

test('bad command line -> non-zero exit with stderr', () => {
  for (const args of [
    ['--night', '1', '--ticks', '5', '--out', path.join(TMP, 'y.jsonl')],
    ['--seed', 'abc', '--night', '1', '--ticks', '5', '--out', path.join(TMP, 'y.jsonl')],
    ['--seed', '1', '--night', '2', '--ticks', '5', '--out', path.join(TMP, 'y.jsonl')],
    ['--seed', '1', '--night', '1', '--ticks', '5'],
  ]) {
    const r = headless(args);
    assert.notEqual(r.status, 0, args.join(' '));
    assert.ok(r.stderr.length > 0);
  }
});

test('--ticks 0 writes snapshot 0 and the end line', () => {
  const { lines } = runOk([], { ticks: 0 });
  assert.equal(lines.length, 2);
  assert.deepEqual(lines[1], { type: 'end', ticks: 0, state: 'playing', score: 0 });
});
