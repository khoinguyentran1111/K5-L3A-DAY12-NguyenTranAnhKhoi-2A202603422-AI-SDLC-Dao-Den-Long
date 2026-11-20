// Ticket-04 (Contract v1.3): bench/soak commands, soak output and thresholds, bench statistics.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { benchStats, benchCamera } from '../src/web/benchstats.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-release-'));
const contract = JSON.parse(fs.readFileSync(path.join(ROOT, 'game.contract.json'), 'utf8'));

test('contract v1.3 declares bench_cmd and soak_cmd (and keeps every v1.0–v1.2 key)', () => {
  assert.equal(contract.contract_version, '1.3');
  for (const k of ['team', 'build_cmd', 'run_cmd', 'headless_cmd', 'bench_cmd', 'soak_cmd', 'tuning']) assert.ok(contract[k], k);
  for (const k of ['bench_cmd', 'soak_cmd']) {
    const script = contract[k].split(' ').find((w) => w.endsWith('.mjs'));
    assert.ok(fs.existsSync(path.join(ROOT, script)), `${k}: ${script} exists`);
  }
});

test('soak: <soak_cmd> --seed 7 --nights N --out f -> required fields, no crash, RSS end ≤ 1.2 × start', () => {
  const out = path.join(TMP, 'soak.json');
  const [cmd, ...pre] = contract.soak_cmd.split(' ');
  assert.equal(cmd, 'node');
  const r = spawnSync(process.execPath, [...pre, '--seed', '7', '--nights', '4', '--out', out], { cwd: ROOT, encoding: 'utf8', timeout: 120000 });
  assert.equal(r.status, 0, r.stderr);
  const s = JSON.parse(fs.readFileSync(out, 'utf8'));
  for (const k of ['nights', 'crashes', 'results', 'mem_start_mb', 'mem_end_mb', 'duration_s']) assert.ok(k in s, k);
  assert.equal(s.nights, 4);
  assert.equal(s.crashes, 0);
  assert.equal(s.results.length, 4);
  for (const x of s.results) assert.ok(['won', 'lost'].includes(x), x);
  assert.deepEqual(s.per_night.map((n) => [n.night, n.seed]), [[1, 7], [2, 8], [3, 9], [1, 10]], 'nights rotate 1→2→3, night i uses seed 7 + i');
  assert.ok(s.mem_end_mb <= 1.2 * s.mem_start_mb, `${s.mem_end_mb} vs ${s.mem_start_mb}`);
  for (const n of s.per_night) assert.deepEqual(n.anomalies, [], `night ${n.night_index}`);
  // reproducible: same seed -> same results and ticks
  const out2 = path.join(TMP, 'soak2.json');
  spawnSync(process.execPath, [...pre, '--seed', '7', '--nights', '4', '--out', out2], { cwd: ROOT, encoding: 'utf8' });
  const s2 = JSON.parse(fs.readFileSync(out2, 'utf8'));
  assert.deepEqual(s2.per_night.map((n) => [n.result, n.ticks, n.score]), s.per_night.map((n) => [n.result, n.ticks, n.score]));
});

test('bench statistics follow the Ticket-04 definitions', () => {
  // 100 frames: 98 × 10 ms, 1 × 30 ms, 1 × 50 ms
  const dts = [...Array(98).fill(10), 30, 50];
  const s = benchStats(dts);
  assert.equal(s.frames, 100);
  assert.equal(s.avg_fps, Math.round((1000 * 100 / 1060) * 10) / 10); // 94.3
  assert.equal(s.p1_low_fps, 20); // k = 1 -> 1000 / 50
  assert.equal(s.frame_ms_p95, 10);
  const t = benchStats([...Array(250).fill(16), 40, 40, 40]); // N = 253 -> k = 3
  assert.equal(t.p1_low_fps, 25);
  assert.equal(benchStats([...Array(19).fill(10), 20]).frame_ms_p95, 10, 'nearest rank: ceil(0.95 × 20) = 19th value');
});

test('bench camera: (30, 15, 0) at t = 0, counter-clockwise from above, 15 s per lap', () => {
  const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
  assert.ok(near(benchCamera(0), [30, 15, 0]));
  assert.ok(near(benchCamera(3.75), [0, 15, -30]), 'quarter lap: +X -> −Z (counter-clockwise seen from +Y)');
  assert.ok(near(benchCamera(15), [30, 15, 0]));
  for (const t of [1, 5, 9.3]) assert.ok(Math.abs(Math.hypot(benchCamera(t)[0], benchCamera(t)[2]) - 30) < 1e-9);
});
