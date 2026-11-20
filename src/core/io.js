// Validation of contract files (inputs / scenario) and CLI arguments — Test Contract v1.1.
// Malformed files throw FormatError -> headless exits with code 2.
import { SHADE_STATES } from './sim.js';

export class FormatError extends Error {}
export class UsageError extends Error {}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isNonNegInt = (v) => Number.isInteger(v) && v >= 0;
const isVec3 = (v) => Array.isArray(v) && v.length === 3 && v.every(isNum);

function check(cond, msg) {
  if (!cond) throw new FormatError(msg);
}

const BUTTONS = ['jump', 'interact', 'pulse', 'dash', 'pause'];
export const NIGHTS_AVAILABLE = [1, 2, 3];

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

function optInt(o, k, at) {
  if (k in o) check(isNonNegInt(o[k]), `${at}.${k}: must be a non-negative integer`);
}

export function validateScenario(obj) {
  check(isObj(obj), 'scenario: root must be an object');
  if ('player' in obj) {
    const p = obj.player;
    check(isObj(p), 'scenario.player: must be an object');
    if ('pos' in p) check(isVec3(p.pos), 'scenario.player.pos: must be [x, y, z]');
    for (const k of ['carried', 'flames', 'invuln_ticks', 'dash_cd_ticks', 'pulse_cd_ticks', 'charm_ticks']) optInt(p, k, 'scenario.player');
  }
  for (const k of ['random_motes', 'random_shades', 'random_drifters', 'wind_enabled']) {
    if (k in obj) check(typeof obj[k] === 'boolean', `scenario.${k}: must be boolean`);
  }
  if ('motes' in obj) {
    check(Array.isArray(obj.motes), 'scenario.motes: must be an array');
    obj.motes.forEach((m, i) => check(isVec3(m), `scenario.motes[${i}]: must be [x, y, z]`));
  }
  const entityList = (key, states) => {
    if (!(key in obj)) return;
    check(Array.isArray(obj[key]), `scenario.${key}: must be an array`);
    const ids = new Set();
    obj[key].forEach((s, i) => {
      const at = `scenario.${key}[${i}]`;
      check(isObj(s), `${at}: must be an object`);
      if (key !== 'charms' || 'pos' in s) check(isVec3(s.pos), `${at}.pos: must be [x, y, z]`);
      if ('id' in s) {
        check(typeof s.id === 'string' && s.id.length > 0, `${at}.id: must be a non-empty string`);
        check(!ids.has(s.id), `${at}.id: duplicate id ${s.id}`);
        ids.add(s.id);
      }
      if (states && 'state' in s) check(states.includes(s.state), `${at}.state: must be one of ${states.join(', ')}`);
      optInt(s, 'state_ticks_left', at);
      optInt(s, 'stolen', at);
      optInt(s, 'respawn_ticks', at);
      if ('available' in s) check(typeof s.available === 'boolean', `${at}.available: must be boolean`);
    });
  };
  entityList('shades', SHADE_STATES);
  entityList('drifters', ['idle', 'chase', 'flee', 'removed']);
  entityList('charms', null);
  if ('lanterns' in obj) {
    check(Array.isArray(obj.lanterns), 'scenario.lanterns: must be an array');
    obj.lanterns.forEach((l, i) => {
      const at = `scenario.lanterns[${i}]`;
      check(isObj(l), `${at}: must be an object`);
      check(typeof l.id === 'string' && /^L[1-7]$/.test(l.id), `${at}.id: must be L1..L7`);
      if ('pos' in l) check(isVec3(l.pos), `${at}.pos: must be [x, y, z]`);
      optInt(l, 'deposited', at);
      if ('lit' in l) check(typeof l.lit === 'boolean', `${at}.lit: must be boolean`);
    });
  }
  if ('time_left_s' in obj) check(isNum(obj.time_left_s) && obj.time_left_s >= 0, 'scenario.time_left_s: must be a number >= 0');
  return obj;
}

const USAGE =
  'usage: node src/headless.js --seed <int> --night <1|2|3> [--scenario <file.json>] [--inputs <file.json>] ' +
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
  if (!NIGHTS_AVAILABLE.includes(args.night)) throw new UsageError(`--night ${args.night} is not available (1, 2 or 3)`);
  const known = new Set(['seed', 'night', 'ticks', 'snapshot-every', 'scenario', 'inputs', 'out']);
  for (const k of Object.keys(raw)) if (!known.has(k)) warnings.push(`ignoring unknown option --${k}`);
  return { args, warnings };
}
