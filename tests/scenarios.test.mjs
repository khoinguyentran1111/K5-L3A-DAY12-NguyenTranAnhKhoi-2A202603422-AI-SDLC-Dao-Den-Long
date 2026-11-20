// Every scenarios/<name>/ folder becomes one test (hand-derived expectations in expect.json).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { listScenarios, runScenario } from '../scripts/scenarios.mjs';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-scen-'));

for (const name of listScenarios()) {
  test(`scenario ${name}`, () => {
    const res = runScenario(name, path.join(TMP, `${name}.jsonl`));
    assert.ok(res.pass, `${name}:\n  ${res.failures.join('\n  ')}`);
  });
}
