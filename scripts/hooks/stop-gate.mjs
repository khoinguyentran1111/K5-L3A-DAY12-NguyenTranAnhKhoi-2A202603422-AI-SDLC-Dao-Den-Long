#!/usr/bin/env node
// Claude Code "Stop" hook: the agent may not finish its turn while the test suite is red.
// Exit 2 + stderr -> Claude Code blocks the stop and shows the message to the agent.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let data = {};
try {
  data = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
} catch {
  /* no/invalid stdin: run the gate anyway */
}
if (data.stop_hook_active) process.exit(0); // already blocked once in this turn: avoid loops

const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap'], { cwd: ROOT, encoding: 'utf8' });
if (r.status === 0) process.exit(0);
const failing = r.stdout
  .split('\n')
  .filter((l) => /^\s*not ok/.test(l))
  .slice(0, 15)
  .join('\n');
process.stderr.write(
  `npm test đang ĐỎ, chưa được kết thúc.\n${failing}\n` +
    'Sửa code cho đúng yêu cầu. KHÔNG sửa expect.json hay nới test để cho xanh; nếu yêu cầu thật sự đổi thì hỏi người.\n',
);
process.exit(2);
