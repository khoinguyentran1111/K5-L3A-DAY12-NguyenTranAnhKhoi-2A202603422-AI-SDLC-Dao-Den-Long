#!/usr/bin/env node
// Sanity check that the test suite is not "always green": inject known bugs into
// src/core/sim.js one at a time (Ticket-02 and Ticket-03 rules), run `node --test`, and expect at least one failure.
// Mutants are applied to a throw-away COPY of the project (temp dir), never to the working tree:
// in Phase 3 the Stop hook ran `npm test` while a mutant sat in src/core/sim.js and saw red tests.
// Exit 1 if any mutant survives.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-mutation-'));
for (const p of ['src', 'tests', 'scenarios', 'scripts', '.claude', 'game.contract.json', 'package.json']) {
  if (fs.existsSync(path.join(REPO, p))) fs.cpSync(path.join(REPO, p), path.join(ROOT, p), { recursive: true });
}
const FILE = path.join(ROOT, 'src/core/sim.js');

const MUTANTS = [
  ['drop rounds up', 'Math.floor(P.carried * t.hit_drop_ratio)', 'Math.ceil(P.carried * t.hit_drop_ratio)'],
  ['short move vectors get normalized', 'if (len > 1) {', 'if (len > 0) {'],
  ['stun one tick short', 's.stateTicks = T(t.pulse_stun_s);', 's.stateTicks = T(t.pulse_stun_s) - 1;'],
  ['pickup radius is strict <', 'distXZ(P, o) <= t.pickup_radius', 'distXZ(P, o) < t.pickup_radius - 0.05'],
  ['pickup ignores height', 'Math.abs(P.y - o.y) <= WORLD.pickupHeight', 'true'],
  ['no score for deposited motes', 'g.score += t.score.per_mote * amount;', ''],
  ['buttons are level- not edge-triggered', 'for (const b of BUTTONS) edge[b] = !!input[b] && !g.prev[b];', 'for (const b of BUTTONS) edge[b] = !!input[b];'],
  ['no invulnerability', 'if (P.invuln > 0 || g.bench) return;', 'if (g.bench) return;'],
  ['safe zone ignored', 'if (!L.lit || L.fuel < g.fuel.low) continue;', 'if (true) continue;'],
  ['no eviction from a newly lit lantern', 'if (d >= R) continue;', 'continue;'],
  ['dawn bonus ignores fuel', '+ Math.floor(L.fuel / FUEL_UNIT)', ''],
  ['dawn one tick late', 'g.simTick >= g.endSim', 'g.simTick > g.endSim'],
  ['pulse measured in XZ instead of 3D', 'Math.hypot(o.x - P.x, o.y - cy, o.z - P.z)', 'Math.hypot(o.x - P.x, o.z - P.z)'],
  ['dash has no cooldown', 'P.dashCd = P.charm > 0 ? 0 : T(t.dash_cooldown_s);', 'P.dashCd = 0;'],
  ['charm does not speed up', 'P.charm > 0 ? WORLD.charmSpeed : t.player_speed', 't.player_speed'],
  ['drifter steals everything', 'Math.min(WORLD.drifterStealMax, P.carried)', 'P.carried'],
  ['pause does not freeze the sim', 'if (g.paused) return events;', ''],
  ['never fall off the island', 'if (P.y < WORLD.fallY && !P.fallen) {', 'if (false) {'],
  ['wind ignored', 'hx += Math.cos(a) * WORLD.windSpeed;', 'hx += 0;'],
  ['no recoil after a hit', "Object.assign(hitter, { state: 'recoil'", "Object.assign({}, { state: 'recoil'"],
  // Ticket-03 (Phase 3)
  ['low-fuel lanterns keep their safe zone', 'if (!L.lit || L.fuel < g.fuel.low) continue;', 'if (!L.lit) continue;'],
  ['exactly 30 counts as weak', 'L.lit && L.fuel < g.fuel.low)) ?? near', 'L.lit && L.fuel <= g.fuel.low)) ?? near'],
  ['fuel does not decay', 'if (L.lit) L.fuel = Math.max(0, L.fuel - F.decay);', ''],
  ['drain does not stack', 'L.fuel = Math.max(0, L.fuel - F.drain);', 'L.fuel = Math.max(0, L.fuel - (s === g.shades[0] ? F.drain : 0));'],
  ['refuel rounds down', 'Math.ceil((F.max - L.fuel) / F.perMote)', 'Math.floor((F.max - L.fuel) / F.perMote)'],
  ['full lantern is still chosen', '(!l.lit || l.fuel < F.max)', '(!l.lit || l.fuel <= F.max)'],
  ['relight costs 10', 'const cost = L.everLit ? t.relight_cost : t.lantern_cost;', 'const cost = t.lantern_cost;'],
  ['relight scores like a first light', 'g.score += relight ? t.score.per_relight : t.score.per_lantern;', 'g.score += t.score.per_lantern;'],
  ['capacity does not grow', 'P.successfulLights++;', ''],
  ['capacity has no cap', 'Math.min(t.capacity_max, t.carry_capacity', 'Math.max(t.capacity_max * 0, t.carry_capacity'],
  ['draining shade scores +5 only', "s.state === 'drain' ? t.score.per_stun_drain : t.score.per_stun", 't.score.per_stun'],
  ['all lit still wins early', "if (P.flames <= 0) over = ['lost', 'no_flames'];", "if (P.flames <= 0) over = ['lost', 'no_flames'];\n  else if (g.lanterns.every((L) => L.lit)) over = ['won', 'dawn_survived'];"],
  ['threshold rounds down', 'Math.ceil(t.win_ratio * total - 1e-9)', 'Math.floor(t.win_ratio * total)'],
  ['lantern goes out one tick late', 'if (!L.lit || L.fuel > 0) continue;', 'if (!L.lit || L.fuel >= 0) continue;'],
  ['drain breaks at 12 m instead of 6 m', 'if (d <= WORLD.drainBreak)', 'if (d <= WORLD.detect)'],
  ['drain breaks only below 6 m', 'if (d <= WORLD.drainBreak)', 'if (d < WORLD.drainBreak)'],
  ['drain never ends by distance', ' || distXZ(s, L) > WORLD.drainReach) Object.assign', ') Object.assign'],
  ['refuel to 30 does not evict', 'if (L.fuel >= F.low) ctx.safeOn.push(L);', ''],
  ['wander prefers unlit over weak', 'return near(g.lanterns.filter((L) => L.lit && L.fuel < g.fuel.low)) ?? near(g.lanterns.filter((L) => !L.lit));', 'return near(g.lanterns.filter((L) => !L.lit)) ?? near(g.lanterns.filter((L) => L.lit && L.fuel < g.fuel.low));'],
  ['bench shades chase Mây', 'const d = P.fallen || g.bench ? Infinity : distXZ(s, P);', 'const d = P.fallen ? Infinity : distXZ(s, P);'],
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
  fs.rmSync(ROOT, { recursive: true, force: true }); // the working tree was never touched
}
console.log(`\n${MUTANTS.length - survived}/${MUTANTS.length} mutants killed`);
process.exitCode = survived ? 1 : 0;
