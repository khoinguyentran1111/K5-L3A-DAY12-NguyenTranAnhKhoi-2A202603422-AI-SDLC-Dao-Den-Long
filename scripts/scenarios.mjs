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

const INVARIANTS = {
  shades_outside_safe_radius_of_lit_lanterns(lines, failures) {
    for (const s of lines.filter((l) => l.type === 'snapshot')) {
      for (const L of s.lanterns.filter((x) => x.lit)) {
        for (const sh of s.shades) {
          const d = Math.hypot(sh.pos[0] - L.pos[0], sh.pos[2] - L.pos[2]);
          if (d <= TUNING.safe_radius) failures.push(`tick ${s.tick}: ${sh.id} is ${d.toFixed(3)} m from lit ${L.id}`);
        }
      }
    }
  },
};

export function runScenario(name, outFile) {
  const dir = path.join(SCENARIO_DIR, name);
  const expect = JSON.parse(fs.readFileSync(path.join(dir, 'expect.json'), 'utf8'));
  const a = expect.args || {};
  const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');
  const cli = ['src/headless.js', '--seed', String(a.seed ?? 1), '--night', '1', '--ticks', String(a.ticks)];
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
    else INVARIANTS[inv](lines, failures);
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
