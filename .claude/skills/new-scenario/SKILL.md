---
name: new-scenario
description: Viết một scenario headless mới (scenarios/<pN_xx_ten>/) với kỳ vọng tính tay từ luật, để kiểm chứng một yêu cầu của PRD/ticket. Dùng khi thêm hoặc đổi luật game, hoặc khi cần bằng chứng cho một yêu cầu.
---

# Viết scenario mới

Thư mục `scenarios/pN_xx_ten/` gồm:
- `scenario.json`: dựng tình huống (contract D). Thường tắt ngẫu nhiên: `"random_motes": false, "random_shades": false`, rồi liệt kê `motes` và `shades` cần thiết.
- `inputs.json` (tùy chọn): `frames` có tick tăng nghiêm ngặt (contract C). Không có file này thì người chơi đứng yên.
- `expect.json`:
  - `requirement`: yêu cầu nào (mã R.. trong `docs/notes/phaseN.md`).
  - `why`: phép tính tay dẫn tới kỳ vọng (tốc độ/60 mỗi tick, bán kính ≤, tick của sự kiện = bước + 1…).
  - `args`: `{ "seed", "ticks", "snapshot_every"? }`
  - `events`: danh sách con, đúng thứ tự, so khớp một phần (`tick`, `name`, `data`).
  - `event_counts`: `{ "pulse": 1 }`. `snapshots`: `{ "<tick>": { ...khớp một phần } }`. `end`: `{ "ticks", "state", "score" }`.
  - `invariants`: tên kiểm tra trong `scripts/scenarios.mjs` (ví dụ `shades_outside_safe_radius_of_lit_lanterns`).

Quy tắc:
1. Tính kỳ vọng TRƯỚC khi chạy. Tránh đặt giá trị đúng ngay biên (ví dụ đặt đom đóm ở 3.05 chứ không ở 3.0) để sai số float không làm test chập chờn.
2. Chạy `node scripts/scenarios.mjs`. Nếu FAIL thì đọc output và tìm xem code sai hay phép tính tay sai. Nếu là phép tính tay sai thì sửa `why` rồi mới sửa số. Không chép output vào expect.
3. Mỗi scenario chứng minh một ý. `tests/scenarios.test.mjs` tự nhận scenario mới.
