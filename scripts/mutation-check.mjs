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
  ['stun one tick short', 's.stateTicks = T(t.pulse_stun_s);', 's.stateTicks = T(t.pulse_stun_s) - 1;'],
  ['pickup radius is strict <', 'distXZ(P, o) <= t.pickup_radius', 'distXZ(P, o) < t.pickup_radius - 0.05'],
  ['pickup ignores height', 'Math.abs(P.y - o.y) <= WORLD.pickupHeight', 'true'],
  ['no score for deposited motes', 'g.score += t.score.per_mote * amount;', ''],
  ['buttons are level- not edge-triggered', 'for (const b of BUTTONS) edge[b] = !!input[b] && !g.prev[b];', 'for (const b of BUTTONS) edge[b] = !!input[b];'],
  ['no invulnerability', 'if (P.invuln > 0) return;', ''],
  ['safe zone ignored', 'if (!L.lit) continue;', 'if (true) continue;'],
  ['no eviction from a newly lit lantern', 'if (d < R) s.evict =', 'if (false) s.evict ='],
  ['win bonus missing', 't.score.per_second_left * Math.floor(timeLeft(g) + 1e-9)', '0'],
  ['dawn one tick late', 'g.simTick >= g.endSim', 'g.simTick > g.endSim'],
  ['pulse measured in XZ instead of 3D', 'Math.hypot(o.x - P.x, o.y - cy, o.z - P.z)', 'Math.hypot(o.x - P.x, o.z - P.z)'],
  ['dash has no cooldown', 'P.dashCd = P.charm > 0 ? 0 : T(t.dash_cooldown_s);', 'P.dashCd = 0;'],
  ['charm does not speed up', 'P.charm > 0 ? WORLD.charmSpeed : t.player_speed', 't.player_speed'],
  ['drifter steals everything', 'Math.min(WORLD.drifterStealMax, P.carried)', 'P.carried'],
  ['pause does not freeze the sim', 'if (g.paused) return events;', ''],
  ['never fall off the island', 'if (P.y < WORLD.fallY && !P.fallen) {', 'if (false) {'],
  ['wind ignored', 'hx += Math.cos(a) * WORLD.windSpeed;', 'hx += 0;'],
  ['no recoil after a hit', "Object.assign(hitter, { state: 'recoil'", "Object.assign({}, { state: 'recoil'"],
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
    // Decide by exit status (portable across Node versions/reporters); TAP gives the count.
    const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap'], { cwd: ROOT, encoding: 'utf8' });
    const fail = Number((r.stdout.match(/^# fail (\d+)/m) || [])[1] || 0);
    const killed = r.status !== 0;
    console.log(`${killed ? 'KILLED  ' : 'SURVIVED'} ${name} (${fail} failing tests)`);
    if (!killed) survived++;
  }
} finally {
  fs.writeFileSync(FILE, original);
}
console.log(`\n${MUTANTS.length - survived}/${MUTANTS.length} mutants killed`);
process.exitCode = survived ? 1 : 0;
