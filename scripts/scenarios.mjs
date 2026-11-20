#!/usr/bin/env node
// Black-box scenario runner: runs the real headless CLI (like the grader does) for every
// scenarios/<name>/ folder and compares the JSONL output with scenarios/<name>/expect.json.
// Expectations are derived by hand from the rules (see "why" in each expect.json), never
// copied from program output.
//   node scripts/scenarios.mjs [--out <dir>]     (exit 1 if any scenario fails)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { getNight } from '../src/core/maps.js';
import { SHADE_STATES } from '../src/core/sim.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SCENARIO_DIR = path.join(ROOT, 'scenarios');
const TUNING = JSON.parse(fs.readFileSync(path.join(ROOT, 'game.contract.json'), 'utf8')).tuning;

export function listScenarios() {
  return fs
    .readdirSync(SCENARIO_DIR)
    .filter((d) => fs.existsSync(path.join(SCENARIO_DIR, d, 'expect.json')))
    .sort();
}

function partial(actual, expected, at, failures) {
  if (expected !== null && typeof expected === 'object' && 'approx' in expected) {
    // {"approx": v, "tol": t}: for values whose exact float tick/landing is not meaningful
    if (typeof actual !== 'number' || Math.abs(actual - expected.approx) > (expected.tol ?? 1e-6)) {
      failures.push(`${at}: expected ${expected.approx} ± ${expected.tol}, got ${JSON.stringify(actual)}`);
    }
    return;
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) {
      failures.push(`${at}: expected array of length ${expected.length}, got ${JSON.stringify(actual)}`);
      return;
    }
    expected.forEach((e, i) => partial(actual[i], e, `${at}[${i}]`, failures));
  } else if (expected !== null && typeof expected === 'object') {
    if (actual === null || typeof actual !== 'object') {
      failures.push(`${at}: expected object, got ${JSON.stringify(actual)}`);
      return;
    }
    for (const k of Object.keys(expected)) partial(actual[k], expected[k], `${at}.${k}`, failures);
  } else if (typeof expected === 'number') {
    if (typeof actual !== 'number' || Math.abs(actual - expected) > 1e-9) {
      failures.push(`${at}: expected ${expected}, got ${JSON.stringify(actual)}`);
    }
  } else if (actual !== expected) {
    failures.push(`${at}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const near = (a, b, tol = 0.011) => Math.abs(a[0] - b[0]) <= tol && Math.abs(a[2] - b[2]) <= tol;
const snaps = (lines) => lines.filter((l) => l.type === 'snapshot');

const INVARIANTS = {
  shades_outside_safe_radius_of_lit_lanterns(lines, failures) {
    for (const s of snaps(lines)) {
      for (const L of s.lanterns.filter((x) => x.lit)) {
        for (const sh of s.shades) {
          const d = Math.hypot(sh.pos[0] - L.pos[0], sh.pos[2] - L.pos[2]);
          if (d <= TUNING.safe_radius) failures.push(`tick ${s.tick}: ${sh.id} is ${d.toFixed(3)} m from lit ${L.id}`);
        }
      }
    }
  },
  shade_states_valid(lines, failures) {
    for (const s of snaps(lines)) for (const sh of s.shades) if (!SHADE_STATES.includes(sh.state)) failures.push(`tick ${s.tick}: ${sh.id} state ${sh.state}`);
  },
  shades_spawn_on_points(lines, failures, night) {
    const pts = getNight(night).shadePoints;
    const seen = new Set();
    for (const s of snaps(lines)) {
      for (const sh of s.shades) {
        if (seen.has(sh.id)) continue;
        seen.add(sh.id);
        if (!pts.some((p) => near(p, sh.pos))) failures.push(`${sh.id} spawned at ${sh.pos} (not a night-${night} shade point)`);
        if (Math.hypot(sh.pos[0] - s.player.pos[0], sh.pos[2] - s.player.pos[2]) < 15) failures.push(`${sh.id} spawned < 15 m from the player`);
      }
    }
  },
  random_motes_on_points_distinct(lines, failures, night) {
    const pts = getNight(night).motePoints;
    for (const s of snaps(lines)) {
      const rnd = s.motes.filter((m) => m.kind === 'random');
      for (const m of rnd) if (!pts.some((p) => near(p, m.pos, 0.001) && Math.abs(p[1] - m.pos[1]) < 1e-9)) failures.push(`tick ${s.tick}: ${m.id} not on a spawn point`);
      const keys = new Set(rnd.map((m) => m.pos.join(',')));
      if (keys.size !== rnd.length) failures.push(`tick ${s.tick}: two random motes share a point`);
    }
  },
  dropped_motes_in_ring(lines, failures) {
    const seen = new Set();
    for (const s of snaps(lines)) {
      for (const m of s.motes.filter((x) => x.kind === 'dropped' && !seen.has(x.id))) {
        seen.add(m.id);
        const d = Math.hypot(m.pos[0] - s.player.pos[0], m.pos[2] - s.player.pos[2]);
        if (d < 1.5 - 0.01 || d > 2.5 + 0.01) failures.push(`${m.id} dropped ${d.toFixed(3)} m from Mây (want 1.5–2.5)`);
      }
    }
  },
  wind_push_10m(lines, failures) {
    const S = snaps(lines);
    const i = S.findIndex((s) => s.wind.active);
    const j = S.findIndex((s, k) => k > i && !s.wind.active);
    if (i < 1 || j < 0) return failures.push('no complete gust in the run');
    const a = S[i - 1].player.pos;
    const b = S[j].player.pos;
    const dir = (S[i].wind.dir_deg * Math.PI) / 180;
    const want = [a[0] + 10 * Math.cos(dir), a[2] + 10 * Math.sin(dir)];
    if (Math.hypot(b[0] - want[0], b[2] - want[1]) > 0.05) failures.push(`gust ${S[i].wind.dir_deg}°: moved ${a} -> ${b}, expected ~(${want.map((v) => v.toFixed(2))})`);
  },
};

export function runScenario(name, outFile) {
  const dir = path.join(SCENARIO_DIR, name);
  const expect = JSON.parse(fs.readFileSync(path.join(dir, 'expect.json'), 'utf8'));
  const a = expect.args || {};
  const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');
  const cli = ['src/headless.js', '--seed', String(a.seed ?? 1), '--night', String(a.night ?? 1), '--ticks', String(a.ticks)];
  for (const f of ['scenario', 'inputs']) {
    const p = path.join(dir, `${f}.json`);
    if (fs.existsSync(p)) cli.push(`--${f}`, rel(p));
  }
  cli.push('--out', outFile, '--snapshot-every', String(a.snapshot_every ?? 10));
  const command = `node ${cli.map((x) => (x === outFile ? rel(x) : x)).join(' ')}`;

  const failures = [];
  const r = spawnSync(process.execPath, cli, { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) {
    failures.push(`exit code ${r.status}: ${r.stderr.trim()}`);
    return { name, requirement: expect.requirement, command, pass: false, failures, lines: [] };
  }
  const lines = fs.readFileSync(outFile, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const events = lines.filter((l) => l.type === 'event');
  const end = lines[lines.length - 1];

  if (end.type !== 'end') failures.push('last line is not {"type":"end"}');
  if (expect.end) partial(end, expect.end, 'end', failures);

  let from = 0;
  for (const e of expect.events || []) {
    const idx = events.findIndex((x, i) => {
      if (i < from) return false;
      const f = [];
      partial(x, e, 'event', f);
      return f.length === 0;
    });
    if (idx < 0) failures.push(`missing event (in order): ${JSON.stringify(e)}`);
    else from = idx + 1;
  }
  for (const [n, count] of Object.entries(expect.event_counts || {})) {
    const got = events.filter((x) => x.name === n).length;
    if (got !== count) failures.push(`event_counts.${n}: expected ${count}, got ${got}`);
  }
  for (const [tick, exp] of Object.entries(expect.snapshots || {})) {
    const s = lines.find((l) => l.type === 'snapshot' && l.tick === Number(tick));
    if (!s) failures.push(`no snapshot at tick ${tick}`);
    else partial(s, exp, `snapshot@${tick}`, failures);
  }
  for (const inv of expect.invariants || []) {
    if (!INVARIANTS[inv]) failures.push(`unknown invariant ${inv}`);
    else INVARIANTS[inv](lines, failures, a.night ?? 1);
  }
  return { name, requirement: expect.requirement, command, pass: failures.length === 0, failures, lines };
}

function main() {
  const i = process.argv.indexOf('--out');
  const outDir = i > 0 ? path.resolve(process.argv[i + 1]) : fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-'));
  fs.mkdirSync(outDir, { recursive: true });
  let failed = 0;
  for (const name of listScenarios()) {
    const res = runScenario(name, path.join(outDir, `${name}.jsonl`));
    console.log(`${res.pass ? 'PASS' : 'FAIL'}  ${name}`);
    for (const f of res.failures) console.log(`      - ${f}`);
    if (!res.pass) failed++;
  }
  console.log(`\n${listScenarios().length - failed}/${listScenarios().length} scenarios passed (outputs in ${outDir})`);
  process.exitCode = failed ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
