#!/usr/bin/env node
// Sanity check that the test suite is not "always green": inject known bugs into
// src/core/sim.js one at a time, run `node --test`, and expect at least one failure.
// The original file is always restored (finally). Exit 1 if any mutant survives.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'src/core/sim.js');

const MUTANTS = [
  ['drop rounds up', 'Math.floor(P.carried * t.hit_drop_ratio)', 'Math.ceil(P.carried * t.hit_drop_ratio)'],
  ['short move vectors get normalized', 'if (len > 1) {', 'if (len > 0) {'],
  ['stunned shades still move', 'if (s.stun > 0) continue;', 'if (false) continue;'],
  ['pickup radius is strict <', 'distXZ(P, m) <= t.pickup_radius', 'distXZ(P, m) < t.pickup_radius - 0.05'],
  ['no per_mote score', 'g.score += t.score.per_mote;', ''],
  ['buttons are level- not edge-triggered', "const edge = (k) => !!input[k] && !g.prev[k];", 'const edge = (k) => !!input[k];'],
  ['no invulnerability', 'if (P.invuln === 0) {', 'if (true) {'],
  ['safe zone ignored', 'if (!L.lit) continue;', 'if (true) continue;'],
  ['win bonus missing', 't.score.per_second_left * Math.floor(timeLeft(g))', '0'],
  ['dawn one tick late', 'g.tick >= g.endTick', 'g.tick > g.endTick'],
];

const original = fs.readFileSync(FILE, 'utf8');
let survived = 0;
try {
  for (const [name, from, to] of MUTANTS) {
    if (!original.includes(from)) {
      console.log(`SKIP     ${name} (pattern not found — update scripts/mutation-check.mjs)`);
      survived++;
      continue;
    }
    fs.writeFileSync(FILE, original.replace(from, to));
    const r = spawnSync(process.execPath, ['--test'], { cwd: ROOT, encoding: 'utf8' });
    const fail = Number((r.stdout.match(/ℹ fail (\d+)/) || [])[1] || 0);
    console.log(`${fail > 0 ? 'KILLED  ' : 'SURVIVED'} ${name} (${fail} failing tests)`);
    if (fail === 0) survived++;
  }
} finally {
  fs.writeFileSync(FILE, original);
}
console.log(`\n${MUTANTS.length - survived}/${MUTANTS.length} mutants killed`);
process.exitCode = survived ? 1 : 0;
