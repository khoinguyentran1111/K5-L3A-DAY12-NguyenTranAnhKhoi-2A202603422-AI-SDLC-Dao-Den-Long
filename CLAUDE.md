@AGENTS.md

## Riêng cho Claude Code
- Skill `verify-phase` (`.claude/skills/verify-phase/`): chạy kiểm chứng và lưu bằng chứng cuối mỗi phase.
- Skill `new-scenario` (`.claude/skills/new-scenario/`): cách viết scenario headless với kỳ vọng tính tay.
- Agent `contract-reviewer` (`.claude/agents/`): review diff so với Test Contract. Agent viết code không tự review chính mình.
- Hook (`.claude/settings.json`): `Stop` chạy `npm test` và chặn kết thúc nếu đỏ; `PreToolUse` chặn sửa `scenarios/*/expect.json` đã có.
