# Changelog

Định dạng theo [Keep a Changelog](https://keepachangelog.com/). Mỗi phase ứng với một tag (`phase-1` … `phase-4`); Test Contract tăng phiên bản theo ticket.

## [Phase 4] — tag `phase-4` · Release `v1.0.0` · Ticket-04 "Bình minh" · Contract v1.3

### Thêm
- **Benchmark** `node scripts/bench.mjs --seed 42 --duration 30 --out bench.json`: cửa sổ Chrome/Edge 1280×720, vsync tắt, cảnh chuẩn 200 Bóng Mực + 100 đom đóm, camera bay vòng; đo FPS trung bình, 1% low, p95, load, RSS đỉnh. Kết quả tự đo: [bench.json](bench.json).
- **Soak test** `node scripts/soak.mjs --seed 7 --nights 10 --out soak.json`: 10 Đêm trong một tiến trình, input ngẫu nhiên theo seed. Kết quả: [soak.json](soak.json).
- **Bảng xếp hạng cục bộ**: nhập tên sau Bình Minh hoặc khi thua; top 10 lưu trên đĩa (`data/leaderboard.json`); màn Bảng xếp hạng ở menu; `node scripts/serve.mjs --export-leaderboard out.json`.
- **Dễ tiếp cận**: đổi mọi phím (báo trùng, khôi phục mặc định); phụ đề và chỉ báo (Bóng Mực xuất hiện kèm mũi tên ở mép màn hình, gió, 10 giây cuối, đèn dưới 30 dầu); giảm chuyển động (tắt rung camera và chớp màn hình, hai hiệu ứng mới của phase này); chữ ≥ 18 px, tùy chọn chữ lớn ×1.25.
- **Đóng gói**: `npm run package` tạo gói chạy được không cần `npm install` (kèm bản web tĩnh) cho Release v1.0.0; README có yêu cầu hệ thống, bench, soak.

### Thay đổi
- `game.contract.json`: `contract_version` 1.3, thêm `bench_cmd`, `soak_cmd`; `run_cmd` = `node scripts/serve.mjs` (để `<run_cmd> --export-leaderboard out.json` chạy được: `npm start --x` sẽ bị npm hiểu là cờ của npm).
- Phím tạm dừng chỉ còn `Esc` (bỏ `P`), đi chỉ còn `WASD` (bỏ `↑/↓`), vì mỗi hành động giờ có đúng một phím có thể đổi.

## [Phase 3] — tag `phase-3` · Ticket-03 "Đèn cạn dầu" · Contract v1.2

### ⚠ Thay đổi phá vỡ tương thích (breaking changes)
- **Luật thắng:** bỏ thắng ngay khi thắp hết đèn. Chỉ thắng ở bình minh khi còn sống và số đèn đang sáng ≥ ceil(0.6 × tổng) (3/5, 4/6, 5/7). `game_over.reason` mới: `dawn_survived`; **`all_lit` không còn được phát**.
- **Thời lượng Đêm:** 300/330/360 s → **240/270/300 s** (`night*_duration_s`).
- **Điểm:** +10 → **+5** mỗi đom đóm nạp (cả châm dầu); thắp lại +40; Tỏa Sáng trúng Bóng Mực đang hút dầu +15; **bỏ thưởng thời gian** (`per_second_left` bị xóa khỏi `tuning.score`); thưởng bình minh mới: mỗi đèn sáng 50 + floor(fuel), mỗi Ngọn Lửa 50. Khối `tuning.score` đổi khóa: thêm `per_relight`, `per_stun_drain`, `per_lit_lantern_dawn`.
- **Đèn đã sáng có thể tắt:** dầu 0–100, hao 1/giây, hết dầu thì `lit: false`, `deposited: 0`. Tương tác ở đèn sáng chưa đầy là **châm dầu** (trước đây đèn sáng bị bỏ qua khi chọn).
- **Vùng an toàn có điều kiện:** đèn có fuel < 30 không còn vùng an toàn.
- **Bóng Mực có trạng thái mới `drain`** (danh sách trạng thái: `spawning, wander, chase, recoil, stunned, drain`). Bóng Mực `wander` giờ đi về đèn yếu hoặc đèn tắt gần nhất **và đứng chờ khi cách ≤ 2 m đèn tắt** thay vì lang thang ngẫu nhiên (giả định C8; chỉ lang thang ngẫu nhiên khi mọi đèn đều sáng và ≥ 30), nên chuỗi RNG và vị trí Bóng Mực khác Phase 2 với cùng seed.
- **Hết choáng thì về `wander`** (trước đây chọn `chase`/`wander` theo khoảng cách; kết quả trong cùng tick vẫn như cũ vì `wander` ≤ 12 m chuyển `chase` ngay).
- **Sức chứa** không còn cố định 10: 10 + 2 × số lần thắp thành công, tối đa 20.

### Thêm
- `tuning`: `fuel_max`, `fuel_decay_per_s`, `fuel_per_mote`, `relight_cost`, `win_ratio`, `drain_per_s`, `low_fuel_threshold`, `capacity_max`.
- Snapshot: `lanterns[].fuel` (1 chữ số thập phân, 0 khi tắt), `ever_lit`, `relit_count`; `player.capacity`; `shades[].target_lantern_id`.
- Scenario: `lanterns[].fuel`, `lanterns[].ever_lit`, `player.successful_lights`, `shades[].target_lantern_id`.
- Sự kiện: `refuel {lantern_id, amount, fuel}`, `lantern_out {lantern_id}`, `fuel_drain {lantern_id, shade_id, fuel}` (mỗi 60 tick hút), `lantern_lit.relight`.
- Bản 3D: thanh dầu trên đèn, nhấp nháy 1 Hz khi fuel < 30, đèn tắt xẹp 20% và giấy rách, Bóng Mực hút dầu có dải sáng nối tới đèn, HUD "mang / sức chứa" và "đèn sáng / cần", cài đặt **Bảng màu dễ phân biệt**.
- [ADR 0001](docs/adr/0001-lantern-fuel-and-dawn-win.md), [spec Phase 3](docs/notes/phase3.md).

### Test
- 6 scenario Phase 2 bị luật mới thay được chuyển sang `scenarios/obsolete-v1.1/` kèm bảng lý do (không xóa, không skip); 22 scenario `p2_*` còn lại vẫn chạy và đạt; 22 scenario `p3_*` mới.
- Unit/contract test bị thay được sửa kèm lý do ghi trong đầu file test; mutation check 20 → 40 lỗi gài (chạy trên bản sao tạm của project).

## [Phase 2] — tag `phase-2` · Ticket-02 "Ba hòn đảo" · Contract v1.1

### ⚠ Thay đổi phá vỡ tương thích
- Mọi số tự chọn của Phase 1 thay bằng số chuẩn (mang 10, đèn cần 10, nhặt 1.0 m, nạp 2.0 m, Tỏa Sáng 3 đom đóm / 5 m 3D / choáng 120 tick + đẩy 4 m trong 15 tick).
- Điểm cộng khi **nạp** (+10/đom đóm) thay vì khi nhặt; thưởng thắng = floor(giây còn) × 2 + 50 × lửa.
- `--night` bắt buộc (1, 2, 3); thêm trạng thái Bóng Mực `spawning`, `wander`, `chase`, `recoil`, `stunned`.
- 7 scenario Phase 1 chuyển sang `scenarios/obsolete-v1.0/`.

### Thêm
- 3 Đêm (Đảo Bến, Đảo Cau với cầu và bục nhảy, Đảo Chuông nhiều tầng, dốc, tháp), rơi khỏi đảo, Lướt, Gió Lạc, Bùa Gió, gió thổi, tạm dừng.
- Chuỗi 3 Đêm, menu, cài đặt (âm lượng, độ nhạy), HUD đầy đủ, âm thanh WebAudio, bảng màu chuẩn, ánh sáng môi trường theo số đèn.
- Snapshot v1.1 (`night`, `wind`, `player.vel/grounded/invuln/dash_cd_s/pulse_cd_s/charm_s`, `motes`, `drifters`, `charms`), sự kiện mới, `night_start`.

## [Phase 1] — tag `phase-1` · PRD-0 · Contract v1.0

### Thêm
- Game 3D Three.js một đảo: Mây di chuyển/nhảy theo camera, nhặt đom đóm, thắp Đèn Lồng Lớn, Bóng Mực đuổi, Tỏa Sáng, vùng an toàn, điểm, thắng/thua.
- Chế độ headless theo Test Contract v1.0 (`src/headless.js`), `game.contract.json`, scenario với kỳ vọng tính tay, kiểm tra tất định, mutation check, harness AI (AGENTS.md, skills, hooks, agent reviewer), CI.
