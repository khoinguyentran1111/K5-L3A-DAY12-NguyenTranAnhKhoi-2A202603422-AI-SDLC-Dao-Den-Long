// The PreToolUse guard must block edits to existing expectations but allow new scenarios.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const guard = (file) =>
  spawnSync(process.execPath, ['scripts/hooks/guard-expect.mjs'], {
    cwd: ROOT,
    input: JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: file } }),
    encoding: 'utf8',
  });

test('guard blocks editing an existing scenarios/*/expect.json (exit 2)', () => {
  const r = guard(path.join(ROOT, 'scenarios', 'p2_r01_collect_deposit_score', 'expect.json'));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /không được sửa kỳ vọng/);
});

test('guard allows a brand-new scenario and normal source files', () => {
  assert.equal(guard(path.join(ROOT, 'scenarios', 'p9_new', 'expect.json')).status, 0);
  assert.equal(guard(path.join(ROOT, 'src', 'core', 'sim.js')).status, 0);
});
