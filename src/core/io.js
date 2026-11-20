// Validation of contract files (inputs / scenario) and CLI arguments.
// Malformed files throw FormatError -> headless exits with code 2.
import { LANTERN_IDS } from './sim.js';

export class FormatError extends Error {}
export class UsageError extends Error {}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isNonNegInt = (v) => Number.isInteger(v) && v >= 0;
const isVec3 = (v) => Array.isArray(v) && v.length === 3 && v.every(isNum);

function check(cond, msg) {
  if (!cond) throw new FormatError(msg);
}

const BUTTONS = ['jump', 'interact', 'pulse', 'dash'];

export function validateInputs(obj) {
  check(isObj(obj), 'inputs: root must be an object');
  check(Array.isArray(obj.frames), 'inputs: "frames" must be an array');
  let last = -1;
  obj.frames.forEach((f, i) => {
    const at = `inputs.frames[${i}]`;
    check(isObj(f), `${at}: must be an object`);
    check(isNonNegInt(f.tick), `${at}.tick: must be a non-negative integer`);
    check(f.tick > last, `${at}.tick: ticks must be strictly increasing`);
    last = f.tick;
    if ('move' in f) {
      check(
        Array.isArray(f.move) && f.move.length === 2 && f.move.every((x) => isNum(x) && x >= -1 && x <= 1),
        `${at}.move: must be [x, z] with each component in [-1, 1]`,
      );
    }
    if ('cam_yaw_deg' in f) check(isNum(f.cam_yaw_deg), `${at}.cam_yaw_deg: must be a number`);
    for (const b of BUTTONS) if (b in f) check(typeof f[b] === 'boolean', `${at}.${b}: must be boolean`);
  });
  return obj;
}

export function validateScenario(obj) {
  check(isObj(obj), 'scenario: root must be an object');
  if ('player' in obj) {
    const p = obj.player;
    check(isObj(p), 'scenario.player: must be an object');
    if ('pos' in p) check(isVec3(p.pos), 'scenario.player.pos: must be [x, y, z]');
    if ('carried' in p) check(isNonNegInt(p.carried), 'scenario.player.carried: must be a non-negative integer');
    if ('flames' in p) check(isNonNegInt(p.flames), 'scenario.player.flames: must be a non-negative integer');
  }
  for (const k of ['random_motes', 'random_shades']) {
    if (k in obj) check(typeof obj[k] === 'boolean', `scenario.${k}: must be boolean`);
  }
  if ('motes' in obj) {
    check(Array.isArray(obj.motes), 'scenario.motes: must be an array');
    obj.motes.forEach((m, i) => check(isVec3(m), `scenario.motes[${i}]: must be [x, y, z]`));
  }
  if ('shades' in obj) {
    check(Array.isArray(obj.shades), 'scenario.shades: must be an array');
    const ids = new Set();
    obj.shades.forEach((s, i) => {
      check(isObj(s) && isVec3(s.pos), `scenario.shades[${i}]: must be { "pos": [x, y, z] }`);
      if ('id' in s) {
        check(typeof s.id === 'string' && s.id.length > 0, `scenario.shades[${i}].id: must be a non-empty string`);
        check(!ids.has(s.id), `scenario.shades[${i}].id: duplicate id ${s.id}`);
        ids.add(s.id);
      }
    });
  }
  if ('lanterns' in obj) {
    check(Array.isArray(obj.lanterns), 'scenario.lanterns: must be an array');
    obj.lanterns.forEach((l, i) => {
      const at = `scenario.lanterns[${i}]`;
      check(isObj(l), `${at}: must be an object`);
      check(LANTERN_IDS.includes(l.id), `${at}.id: must be one of ${LANTERN_IDS.join(', ')}`);
      if ('pos' in l) check(isVec3(l.pos), `${at}.pos: must be [x, y, z]`);
      if ('deposited' in l) check(isNonNegInt(l.deposited), `${at}.deposited: must be a non-negative integer`);
      if ('lit' in l) check(typeof l.lit === 'boolean', `${at}.lit: must be boolean`);
    });
  }
  if ('time_left_s' in obj) check(isNum(obj.time_left_s) && obj.time_left_s >= 0, 'scenario.time_left_s: must be a number >= 0');
  return obj;
}

const USAGE =
  'usage: node src/headless.js --seed <int> --night 1 [--scenario <file.json>] [--inputs <file.json>] ' +
  '--ticks <int> --out <file.jsonl> [--snapshot-every <int>]';

export function parseCli(argv) {
  const raw = {};
  const warnings = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) throw new UsageError(`unexpected argument "${a}"\n${USAGE}`);
    let key = a.slice(2);
    let val;
    const eq = key.indexOf('=');
    if (eq >= 0) {
      val = key.slice(eq + 1);
      key = key.slice(0, eq);
    } else {
      val = argv[++i];
      if (val === undefined) throw new UsageError(`missing value for --${key}\n${USAGE}`);
    }
    raw[key] = val;
  }
  const int = (k, { required = false, min = -Infinity, def } = {}) => {
    if (raw[k] === undefined) {
      if (required) throw new UsageError(`--${k} is required\n${USAGE}`);
      return def;
    }
    if (!/^-?\d+$/.test(raw[k])) throw new UsageError(`--${k} must be an integer`);
    const n = Number(raw[k]);
    if (n < min) throw new UsageError(`--${k} must be >= ${min}`);
    return n;
  };
  const args = {
    seed: int('seed', { required: true }),
    night: int('night', { required: true }),
    ticks: int('ticks', { required: true, min: 0 }),
    snapshotEvery: int('snapshot-every', { min: 1, def: 10 }),
    scenario: raw.scenario,
    inputs: raw.inputs,
    out: raw.out,
  };
  if (!args.out) throw new UsageError(`--out is required\n${USAGE}`);
  if (args.night !== 1) throw new UsageError(`--night ${args.night} is not available (only night 1 exists in this version)`);
  const known = new Set(['seed', 'night', 'ticks', 'snapshot-every', 'scenario', 'inputs', 'out']);
  for (const k of Object.keys(raw)) if (!known.has(k)) warnings.push(`ignoring unknown option --${k}`);
  return { args, warnings };
}
