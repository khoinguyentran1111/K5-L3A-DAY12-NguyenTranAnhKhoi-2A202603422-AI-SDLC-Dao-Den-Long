#!/usr/bin/env node
// Soak test (Ticket-04 §2): N nights back to back in ONE process, nights 1 → 2 → 3 → 1 …,
// night i (i = 0 … N−1) uses seed + i; random inputs from a seeded RNG (assumption E2):
// a new move direction every 30 ticks; each tick 5 % jump, 3 % dash, 2 % pulse, 10 % interact.
// Each night runs until it ends or for its standard duration. Memory = process RSS.
//   node scripts/soak.mjs --seed 7 --nights 10 --out soak.json
//
// V8 flags (assumption E3, see README): RSS is measured right after Night 1 is loaded, before
// any tick; the first night then adds a one-off ~6–10 MB (JIT-optimised code + the young
// generation growing from 1 to 16 MB), which is not a leak: without flags RSS stays flat at
// ~47–49 MB from night 2 to night 30. `--max-semi-space-size=1 --no-opt` keeps that one-off
// cost small so the 1.2× rule measures leaks. Run without them: DDL_SOAK_PLAIN=1.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createGame, step, snapshot, TICK_RATE } from '../src/core/sim.js';
import { mulberry32 } from '../src/core/rng.js';

export const SOAK_V8_FLAGS = ['--expose-gc', '--max-semi-space-size=1', '--no-opt'];
if (typeof globalThis.gc !== 'function' && !process.env.DDL_SOAK_PLAIN && !process.env.DDL_SOAK_CHILD) {
  // re-run this file once with the flags; all nights still run inside that single process
  const r = spawnSync(process.execPath, [...SOAK_V8_FLAGS, fileURLToPath(import.meta.url), ...process.argv.slice(2)], {
    stdio: 'inherit', env: { ...process.env, DDL_SOAK_CHILD: '1' },
  });
  process.exit(r.status ?? 1);
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const seed = Number(arg('seed', 7));
const nights = Number(arg('nights', 10));
const out = arg('out', 'soak.json');
if (!Number.isInteger(seed) || !Number.isInteger(nights) || nights < 1) {
  process.stderr.write('usage: node --expose-gc scripts/soak.mjs --seed <int> --nights <int ≥ 1> --out <file.json>\n');
  process.exit(1);
}
const tuning = JSON.parse(fs.readFileSync(path.join(ROOT, 'game.contract.json'), 'utf8')).tuning;
const mb = () => Math.round((process.memoryUsage().rss / 2 ** 20) * 10) / 10;
const gc = () => {
  if (typeof globalThis.gc === 'function') globalThis.gc();
};

// Random player for one night. Separate RNG stream from the simulation (seed XOR a constant),
// so the inputs are reproducible from the seed but do not shift the world's random sequence.
function randomPlayer(nightSeed) {
  const r = mulberry32((nightSeed ^ 0x5eed5eed) >>> 0);
  let move = [0, 0];
  return (k) => {
    if (k % 30 === 0) {
      const a = r() * Math.PI * 2;
      move = [Math.cos(a), Math.sin(a)];
    }
    return { move, cam_yaw_deg: 0, jump: r() < 0.05, dash: r() < 0.03, pulse: r() < 0.02, interact: r() < 0.1 };
  };
}

// Light sanity checks while running: a NaN position or a broken counter is reported as an anomaly.
function anomalies(g) {
  const s = snapshot(g);
  const bad = [];
  const num = (v) => Number.isFinite(v);
  if (![...s.player.pos, s.score, s.time_left_s].every(num)) bad.push('non-finite player/score/time');
  if (s.player.carried > s.player.capacity || s.player.carried < 0) bad.push(`carried ${s.player.carried} / capacity ${s.player.capacity}`);
  for (const L of s.lanterns) if (L.fuel < 0 || L.fuel > tuning.fuel_max) bad.push(`${L.id} fuel ${L.fuel}`);
  for (const sh of s.shades) if (!sh.pos.every(num)) bad.push(`${sh.id} position`);
  return bad;
}

const t0 = process.hrtime.bigint();
const results = [];
const details = [];
let crashes = 0;
let memStart = null;
let peak = 0;
let g = null;
for (let i = 0; i < nights; i++) {
  const night = (i % 3) + 1;
  const nightSeed = seed + i;
  const info = { night_index: i, night, seed: nightSeed };
  try {
    g = createGame({ tuning, seed: nightSeed, night });
    if (i === 0) {
      gc();
      memStart = mb(); // RSS after the first night is loaded
    }
    const input = randomPlayer(nightSeed);
    const limit = Math.ceil(tuning[`night${night}_duration_s`] * TICK_RATE) + 1;
    const found = new Set();
    let k = 0;
    for (; k < limit && g.state === 'playing'; k++) {
      step(g, input(k));
      if (k % 600 === 0) {
        for (const a of anomalies(g)) found.add(a);
        peak = Math.max(peak, mb());
      }
    }
    for (const a of anomalies(g)) found.add(a);
    const result = g.state === 'won' || g.state === 'lost' ? g.state : 'timeout';
    results.push(result);
    Object.assign(info, { result, reason: g.reason, ticks: g.tick, score: g.score, lit_at_end: g.lanterns.filter((L) => L.lit).length, anomalies: [...found] });
  } catch (e) {
    crashes++;
    results.push('crash');
    info.error = String(e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e);
  }
  g = null; // reset: drop every reference to the finished night
  gc();
  info.rss_after_reset_mb = mb();
  details.push(info);
}
gc();
const memEnd = mb(); // RSS after the last night has been reset
const report = {
  nights,
  crashes,
  results,
  mem_start_mb: memStart,
  mem_end_mb: memEnd,
  duration_s: Math.round(Number(process.hrtime.bigint() - t0) / 1e7) / 100,
  // extra fields (not required by the contract): reproducibility and diagnostics
  seed,
  gc_exposed: typeof globalThis.gc === 'function',
  v8_flags: process.execArgv,
  mem_peak_mb: Math.max(peak, memEnd),
  pass: crashes === 0 && memEnd <= 1.2 * memStart,
  node: process.version,
  per_night: details,
};
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(`soak: ${nights} nights, ${crashes} crashes, results ${results.join(',')}, RSS ${memStart} -> ${memEnd} MB (limit ${(1.2 * memStart).toFixed(1)}), ${report.duration_s} s -> ${out}`);
process.exitCode = 0;
