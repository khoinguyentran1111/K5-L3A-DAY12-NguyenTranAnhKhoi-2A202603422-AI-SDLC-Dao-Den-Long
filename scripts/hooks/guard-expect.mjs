#!/usr/bin/env node
// Claude Code "PreToolUse" hook for Edit|Write|MultiEdit.
// Blocks the agent from modifying an EXISTING scenarios/<name>/expect.json — the classic
// "make the test green by changing the expectation" failure. Creating a new scenario is fine.
// When a ticket really changes a rule, a human edits the expectation and records why.
import fs from 'node:fs';
import path from 'node:path';

let data = {};
try {
  data = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
} catch {
  process.exit(0);
}
const file = data.tool_input?.file_path || '';
const norm = file.split(path.sep).join('/');
if (/(^|\/)scenarios\/[^/]+\/expect\.json$/.test(norm) && fs.existsSync(file)) {
  process.stderr.write(
    `Chặn: không được sửa kỳ vọng đã có (${norm}). Nếu code sai, sửa code. ` +
      'Nếu ticket mới thật sự thay luật, dừng lại và báo người dùng để họ sửa expect.json kèm lý do trong docs/notes.\n',
  );
  process.exit(2);
}
process.exit(0);
