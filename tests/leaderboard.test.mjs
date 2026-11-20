// Ticket-04 §3 local leaderboard: name rules, ordering, top 10, disk persistence, export command.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { nameError, makeEntry, insertEntry, sanitize, isoWithOffset, LEADERBOARD_SIZE } from '../src/core/leaderboard.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-board-'));

test('names: 3–12 characters of [A-Za-z0-9_]; Vietnamese letters accepted (bonus); no spaces or symbols', () => {
  for (const ok of ['May', 'abc_123', 'A1_', 'x'.repeat(12), 'Mây', 'Khôi_2026', 'Đăng']) assert.equal(nameError(ok), null, ok);
  for (const bad of ['', 'ab', 'x'.repeat(13), 'a b c', 'abc!', 'tên-có', '<script>']) assert.notEqual(nameError(bad), null, bad);
  assert.equal(nameError('  Mây  '), null, 'surrounding spaces are trimmed');
});

test('entries: score desc; equal score -> earlier achieved_at first; keep top 10', () => {
  const at = (h) => `2026-11-20T${String(h).padStart(2, '0')}:00:00+07:00`;
  let list = [];
  list = insertEntry(list, makeEntry({ name: 'Second', score: 500, nights_won: 1, seed: 1, achieved_at: at(10) }));
  list = insertEntry(list, makeEntry({ name: 'First', score: 500, nights_won: 1, seed: 2, achieved_at: at(9) }));
  list = insertEntry(list, makeEntry({ name: 'Top', score: 900, nights_won: 3, seed: 3, achieved_at: at(11) }));
  assert.deepEqual(list.map((e) => e.name), ['Top', 'First', 'Second']);
  for (let i = 0; i < 12; i++) list = insertEntry(list, makeEntry({ name: `P${i}x`, score: 100 + i, nights_won: 0, seed: i, achieved_at: at(12) }));
  assert.equal(list.length, LEADERBOARD_SIZE);
  assert.deepEqual(list.slice(0, 3).map((e) => e.name), ['Top', 'First', 'Second']);
  assert.equal(list.at(-1).score, 105, 'the 10th place is the 7th best of the 12 newcomers');
  // same instant: the entry saved first stays above
  const same = insertEntry([makeEntry({ name: 'Old', score: 50, nights_won: 0, seed: 1, achieved_at: at(1) })], makeEntry({ name: 'New', score: 50, nights_won: 0, seed: 1, achieved_at: at(1) }));
  assert.deepEqual(same.map((e) => e.name), ['Old', 'New']);
});

test('entry fields: name, score, nights_won 0–3, achieved_at ISO 8601 with a time zone, seed', () => {
  const e = makeEntry({ name: 'Mây', score: 1298, nights_won: 3, seed: 42 });
  assert.deepEqual(Object.keys(e).sort(), ['achieved_at', 'name', 'nights_won', 'score', 'seed']);
  assert.match(e.achieved_at, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/);
  assert.ok(Math.abs(Date.parse(isoWithOffset()) - Date.now()) < 2000, 'offset is consistent with the instant');
  assert.throws(() => makeEntry({ name: 'Mây', score: 1, nights_won: 4, seed: 1 }));
  assert.throws(() => makeEntry({ name: 'Mây', score: -1, nights_won: 0, seed: 1 }));
  assert.throws(() => makeEntry({ name: 'Mây', score: 1, nights_won: 0, seed: 1, achieved_at: '2026-11-20 10:00' }));
  assert.deepEqual(sanitize([{ name: 'x' }, null, e]), [e], 'malformed rows from disk are dropped');
});

test('server: saved scores persist on disk across restarts; --export-leaderboard writes {"entries": [...]} in order', async () => {
  const board = path.join(TMP, 'board.json');
  const env = { ...process.env, DDL_LEADERBOARD: board, NO_OPEN: '1' };
  const startServer = async () => {
    const port = 6100 + Math.floor(Math.random() * 800);
    const srv = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: ROOT, env: { ...env, PORT: String(port) } });
    await new Promise((res, rej) => {
      srv.stdout.once('data', res);
      srv.once('exit', (code) => rej(new Error(`server exited (${code}) before listening`))); // never hang
    });
    return { srv, url: `http://127.0.0.1:${port}/api/leaderboard` };
  };
  const post = (url, body) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  let { srv, url } = await startServer();
  try {
    assert.equal((await post(url, { name: 'Khoi', score: 300, nights_won: 1, seed: 5 })).status, 200);
    assert.equal((await post(url, { name: 'Mây', score: 1200, nights_won: 3, seed: 7 })).status, 200);
    assert.equal((await post(url, { name: 'no', score: 10, nights_won: 0, seed: 1 })).status, 400, 'invalid name is refused');
  } finally {
    srv.kill();
  }
  ({ srv, url } = await startServer()); // "close and reopen the game"
  try {
    const { entries } = await (await fetch(url)).json();
    assert.deepEqual(entries.map((e) => [e.name, e.score]), [['Mây', 1200], ['Khoi', 300]]);
  } finally {
    srv.kill();
  }
  const out = path.join(TMP, 'export.json');
  const r = spawnSync(process.execPath, ['scripts/serve.mjs', '--export-leaderboard', out], { cwd: ROOT, env, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const exported = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.deepEqual(Object.keys(exported), ['entries']);
  assert.deepEqual(exported.entries.map((e) => e.name), ['Mây', 'Khoi']);
  for (const e of exported.entries) assert.deepEqual(Object.keys(e).sort(), ['achieved_at', 'name', 'nights_won', 'score', 'seed']);
});
