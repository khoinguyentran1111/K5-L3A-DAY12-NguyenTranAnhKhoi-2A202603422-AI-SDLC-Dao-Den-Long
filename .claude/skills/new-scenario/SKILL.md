---
name: new-scenario
description: Viết một scenario headless mới (scenarios/<pN_xx_ten>/) với kỳ vọng tính tay từ luật, để kiểm chứng một yêu cầu của PRD/ticket (cả 3 Đêm, Test Contract v1.2). Dùng khi thêm hoặc đổi luật game, hoặc khi cần bằng chứng cho một yêu cầu.
---

# Viết scenario mới

Thư mục `scenarios/pN_xx_ten/` gồm:
- `scenario.json` (contract D, v1.1 + v1.2): thường tắt hết những gì không liên quan:
  `"random_motes": false, "random_shades": false, "random_drifters": false, "wind_enabled": false, "motes": [], "shades": [], "charms": []`.
  Trường mới: `player.{invuln_ticks, dash_cd_ticks, pulse_cd_ticks, charm_ticks}`, `shades[].{state, state_ticks_left}`,
  `drifters[] {id, pos, state, stolen}`, `charms[] {id, pos, available, respawn_ticks}`.
  v1.2 (Ticket-03): `lanterns[].{lit, fuel, ever_lit, deposited, pos}` (lit không có fuel = 100), `player.successful_lights`,
  `shades[].target_lantern_id` (trạng thái `drain`).
- `inputs.json` (tùy chọn): `frames` có tick tăng nghiêm ngặt; nút `jump/interact/pulse/dash/pause` kích hoạt khi chuyển false → true.
- `expect.json`:
  - `requirement`: mã yêu cầu (S*, M*, F* trong `docs/notes/phase2.md`; F*, D*, W*, K*, P* trong `docs/notes/phase3.md`).
  - `why`: phép tính tay (tốc độ/60 mỗi tick; bộ đếm N đặt ở tick k thì hết ở k+N; sự kiện ở bước k ghi tick k+1).
    Dầu: tính bằng đơn vị 1/60 (100 = 6000); mỗi tick hao 1 TRƯỚC khi tương tác (bước 2 trước bước 5); mỗi con `drain` trừ 5;
    xuất ra `round(u/6)/10`. Đèn tắt ngay sau bước 2 của tick fuel ≤ 0.
  - `args`: `{ "seed", "night", "ticks", "snapshot_every"? }`.
  - `events` (con, đúng thứ tự, khớp một phần), `event_counts`, `snapshots` `{ "<tick>": {...} }`, `end`.
  - **Mảng trong snapshot phải đủ độ dài** (khớp một phần chỉ áp dụng cho object): `lanterns` có 5/6/7 phần tử, điền `{}` cho đèn không cần kiểm.
  - Số có sai số float ở biên: `{"approx": v, "tol": t}`, và ghi lý do trong `why`.
  - `invariants`: tên kiểm tra trong `scripts/scenarios.mjs`: `shades_outside_safe_radius_of_lit_lanterns`, `shade_states_valid`,
    `shades_spawn_on_points`, `random_motes_on_points_distinct`, `dropped_motes_in_ring`, `wind_push_10m`.

Quy tắc:
1. Tính kỳ vọng TRƯỚC khi chạy. Đặt vật thể lệch khỏi biên (39.05 thay vì 39.0) để float không làm test chập chờn.
2. Chạy `node scripts/scenarios.mjs`. Nếu FAIL thì xác định xem code sai, phép tính tay sai hay scenario thiếu điều kiện cô lập. Ghi lại lý do; không chép output vào expect.
3. Mỗi scenario chứng minh một ý. `tests/scenarios.test.mjs` tự nhận scenario mới.
4. Scenario chỉ để phát lại trên bản 3D (không có `expect.json`) đặt tên `ui_*`.
