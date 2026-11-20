#!/usr/bin/env node
// Headless runner — Test Contract v1.0, section B.
// node src/headless.js --seed <int> --night <1|2|3> [--scenario f] [--inputs f] --ticks N --out f.jsonl [--snapshot-every K]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGame, step, snapshot, ScenarioError } from './core/sim.js';
import { parseCli, validateInputs, validateScenario, FormatError, UsageError } from './core/io.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function loadTuning() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'game.contract.json'), 'utf8')).tuning;
}

function readJsonFile(file, label, validate) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    throw new FormatError(`${label}: cannot read ${file} (${e.code || e.message})`);
  }
  let obj;
  try {
    obj = JSON.parse(text);
  } catch (e) {
    throw new FormatError(`${label}: invalid JSON in ${file}: ${e.message}`);
  }
  return validate(obj);
}

/** Runs the simulation and calls write(line) for every JSONL line. Returns the end record. */
export function runHeadless({ seed, night = 1, ticks, snapshotEvery = 10, scenario = {}, inputs = { frames: [] }, tuning }, write) {
  const g = createGame({ tuning, seed, night, scenario });
  const frames = inputs.frames || [];
  const cur = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false };
  let fi = 0;
  write(snapshot(g));
  write({ type: 'event', tick: 0, name: 'night_start', data: { night } }); // assumption B17
  for (let k = 0; k < ticks && (g.state === 'playing' || g.state === 'paused'); k++) {
    while (fi < frames.length && frames[fi].tick <= k) {
      const { tick: _t, ...fields } = frames[fi++];
      Object.assign(cur, fields);
    }
    for (const e of step(g, cur)) write(e);
    if (g.tick % snapshotEvery === 0) write(snapshot(g));
  }
  const end = { type: 'end', ticks: g.tick, state: g.state, score: g.score };
  write(end);
  return end;
}

function main() {
  let parsed;
  try {
    parsed = parseCli(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(`error: ${e.message}\n`);
    if (!(e instanceof UsageError)) throw e;
    return 1;
  }
  const { args, warnings } = parsed;
  for (const w of warnings) process.stderr.write(`warning: ${w}\n`);
  let scenario = {};
  let inputs = { frames: [] };
  try {
    if (args.scenario) scenario = readJsonFile(args.scenario, 'scenario', validateScenario);
    if (args.inputs) inputs = readJsonFile(args.inputs, 'inputs', validateInputs);
  } catch (e) {
    if (e instanceof FormatError) {
      process.stderr.write(`error: ${e.message}\n`);
      return 2;
    }
    throw e;
  }

  let fd;
  try {
    fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
    fd = fs.openSync(args.out, 'w');
  } catch (e) {
    process.stderr.write(`error: cannot open --out ${args.out}: ${e.message}\n`);
    return 1;
  }
  let buf = [];
  const flush = () => {
    if (buf.length) fs.writeSync(fd, buf.join(''));
    buf = [];
  };
  try {
    runHeadless(
      { seed: args.seed, night: args.night, ticks: args.ticks, snapshotEvery: args.snapshotEvery, scenario, inputs, tuning: loadTuning() },
      (obj) => {
        buf.push(JSON.stringify(obj) + '\n');
        if (buf.length >= 2000) flush();
      },
    );
  } catch (e) {
    fs.closeSync(fd);
    if (e instanceof ScenarioError) {
      process.stderr.write(`error: ${e.message}\n`);
      return 2;
    }
    throw e;
  }
  flush();
  fs.closeSync(fd);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main();
  } catch (e) {
    process.stderr.write(`error: ${e.stack || e.message}\n`);
    process.exitCode = 1;
  }
}
