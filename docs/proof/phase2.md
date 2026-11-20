# Bằng chứng Phase 2 (Ticket-02 "Ba hòn đảo"): bảng truy vết

Toàn bộ file trong [phase2/](phase2/) được sinh bằng `npm run proof -- --phase 2 --gpu` ([scripts/proof.mjs](../../scripts/proof.mjs)); không sửa tay.
Cấu hình máy và commit ghi ở đầu mỗi file. Mã yêu cầu (S*, M*, F*) theo [spec Phase 2](../notes/phase2.md).
Scenario: lệnh tái hiện từng dòng nằm trong [results.md](phase2/scenarios/results.md); kỳ vọng tính tay nằm trong `scenarios/<tên>/expect.json` (trường `why`).

## Phần 1: số liệu chuẩn và luật

| Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| Tuning khớp số chuẩn | Unit test so từng khóa với Ticket-02; contract test đủ khóa v1.1 | [test-report](phase2/test-report.txt) | Đạt |
| S1 chạy 6.0 m/s (7.2 khi có Bùa) | Unit test; scenario `p2_r01`, `p2_f11_charm` | [results.md](phase2/scenarios/results.md) | Đạt |
| S2 nhảy 7 m/s, g = −20, chỉ khi chạm đất | `p2_r07` (y(10) = 0.917); unit test không nhảy 2 lần | [p2_r07](phase2/scenarios/p2_r07_camera_yaw_jump.jsonl) | Đạt |
| S3 lướt 14 m/s × 0.2 s, hồi 1.5 s từ lúc bắt đầu, theo hướng mặt, giữ độ cao trên không | `p2_f01_dash_cooldown`, `p2_f02_air_dash_keeps_altitude`; unit test hướng mặt | [p2_f01](phase2/scenarios/p2_f01_dash_cooldown.jsonl), [p2_f02](phase2/scenarios/p2_f02_air_dash_keeps_altitude.jsonl) | Đạt |
| S4 nhặt XZ ≤ 1.0 và chênh cao ≤ 1.5, sức chứa 10 | `p2_r01`, `p2_m3_pickup_height` (đom đóm tầng 1 không nhặt được); unit test | [p2_m3_pickup_height](phase2/scenarios/p2_m3_pickup_height.jsonl) | Đạt |
| S5 20 đom đóm ở 20 điểm khác nhau; +1 mỗi 240 tick nếu < 30 và còn điểm trống | `p2_f08_mote_spawn_schedule` + bất biến "đúng điểm, không trùng"; unit test trần 30 (Đêm 3) | [p2_f08](phase2/scenarios/p2_f08_mote_spawn_schedule.jsonl) | Đạt |
| S6 đèn cần 10, nạp nhiều lần, đèn gần nhất, hòa thì id nhỏ | `p2_r01`, `p2_r05`; unit test tie-break, bỏ qua đèn đã sáng | [results.md](phase2/scenarios/results.md) | Đạt |
| S7 vùng an toàn 6 m chặn ở mép; Bóng Mực bị đẩy ra trong ≤ 30 tick, không gây hit | `p2_r06_safe_radius_block` (+ bất biến), `p2_f06_safe_zone_evict` (đi xuyên qua Mây mà không hit) | [p2_f06](phase2/scenarios/p2_f06_safe_zone_evict.jsonl) | Đạt |
| S8 Tỏa Sáng: 3 đom đóm / 5 m 3D / hồi 3 s / choáng 120 / đẩy 4 m trong 15 tick / +5 / làm mới | `p2_r02_pulse_stun_push`; unit test 3D (XZ 4.99 trúng, XZ 5.0 trượt), choáng đúng 120 tick, pulse lại làm mới, < 3 thì không kích hoạt | [p2_r02](phase2/scenarios/p2_r02_pulse_stun_push.jsonl) | Đạt |
| S9 Bóng Mực 4.0 / 4.5 m/s, phát hiện 12 m / bỏ 18 m, 5 tên trạng thái | Unit test hysteresis, tốc độ Đêm 3, chạy dài cả 3 Đêm chỉ thấy 5 tên; bất biến `shade_states_valid` | [test-report](phase2/test-report.txt) | Đạt |
| S10 chạm: −1 lửa, rơi floor(mang/2) ra vành 1.5–2.5 m (TTL 480), bất tử 90, recoil 2 m/60 tick, tối đa 1 hit mỗi tick | `p2_r03_hit_recoil_invuln` (+ bất biến vành); unit test 1 hit mỗi tick (id nhỏ trước), chạm lúc bất tử không có tác dụng, khác tầng không chạm, TTL 480 | [p2_r03](phase2/scenarios/p2_r03_hit_recoil_invuln.jsonl) | Đạt |
| S11 lịch sinh Bóng Mực 300 + 480k / 420k / 360k, tối đa 6/8/10, điểm r chuẩn và cách ≥ 15 m | `p2_f07_shade_spawn_schedule` + bất biến điểm sinh; unit test Đêm 2 và 3 | [p2_f07](phase2/scenarios/p2_f07_shade_spawn_schedule.jsonl) | Đạt |
| S12 rơi khỏi đảo: 1 lần, bỏ qua bất tử, mất hết đom đóm, chờ 60 tick, hồi sinh với bất tử 90; hết lửa thì thua ngay | `p2_f03_fall_respawn`, `p2_f04_fall_last_flame`, `p2_m2_bridge_fall` | [p2_f03](phase2/scenarios/p2_f03_fall_respawn.jsonl) | Đạt |
| S13 thời gian 300/330/360 s; thứ tự xét no_flames > all_lit > dawn; thắng cả ở tick hết giờ | `p2_r04_dawn`, `p2_m2_defaults`, `p2_m3_defaults`; unit test thắng đúng tick cuối và thứ tự ưu tiên | [results.md](phase2/scenarios/results.md) | Đạt |
| S14 điểm chuẩn hóa | Tính tay: 200 (`p2_r01`), 5 (`p2_r02`), 478 (`p2_r05`), 110 (`p2_f06`) | [results.md](phase2/scenarios/results.md) | Đạt |
| S15 thứ tự 12 bước; tạm dừng đứng sim_tick, thời gian, hồi chiêu | `step()` gọi đúng 12 hàm theo thứ tự; `p2_f05_pause`; unit test hồi chiêu đứng khi tạm dừng; contract test snapshot `paused` | [p2_f05](phase2/scenarios/p2_f05_pause.jsonl) | Đạt |

## Phần 2: bản đồ chuẩn

| Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| M1 Đêm 1 chuẩn hóa (r = 40, 5 đèn, 24 điểm đom đóm, 12 điểm Bóng Mực) | Unit test tọa độ và số điểm; `p2_f07`, `p2_f08` | [test-report](phase2/test-report.txt), [night1.png](phase2/screenshots/night1.png) | Đạt |
| M2 Đêm 2: hai đảo + cầu tre không lan can + bục nhảy ~1.4 s sang đảo kia, 6 đèn, Bùa (35,0,0) | `p2_m2_defaults`, `p2_m2_bridge_cross`, `p2_m2_bridge_fall`, `p2_m2_jump_pad` (đáp trong đảo B) | [p2_m2_jump_pad](phase2/scenarios/p2_m2_jump_pad.jsonl), [ảnh đang bay](phase2/screenshots/p2_m2_jump_pad_flight.png) | Đạt |
| M3 Đêm 3: 3 tầng, vách đứng, 2 dốc, bục (0,3,13) lên tầng 2, tháp chuông chặn, 7 đèn, Bùa (±30,0,25), gió mỗi 30 s đẩy 2 m/s | `p2_m3_defaults`, `p2_m3_tier_wall`, `p2_m3_ramp_up`, `p2_m3_pad_tower`, `p2_m3_wind` (+ bất biến 10 m theo `dir_deg`); unit test độ cao địa hình | [results.md](phase2/scenarios/results.md), [night3.png](phase2/screenshots/night3.png), [p2_m3_pad_to_tier2.png](phase2/screenshots/p2_m3_pad_to_tier2.png) | Đạt |
| Báo trước gió 2 s bằng lá bay và âm thanh | Code `updateHud` (cảnh báo + lá + `sfx.windWarn`) ở sim_tick 1680 + 1800k | [main.js](../../src/web/main.js) | Đạt (review code; chưa có test tự động) |

## Phần 3: tính năng mới

| Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| F1 Gió Lạc (idle → chase → flee → removed, cướp min(3, mang), 1 lần, không mất lửa, bất tử không ngăn) | `p2_f09_drifter_steal`; unit test lịch sinh 1200k, tối đa 2, id D1/D2, không có ở Đêm 1 | [p2_f09](phase2/scenarios/p2_f09_drifter_steal.jsonl), [ảnh](phase2/screenshots/p2_f09_drifter_chase.png) | Đạt |
| F1b Tỏa Sáng với Gió Lạc (chase → flee; flee có đồ → `drifter_drop`, biến mất sau 120 tick) | `p2_f10_drifter_pulse` | [p2_f10](phase2/scenarios/p2_f10_drifter_pulse.jsonl) | Đạt |
| F2 Bùa Gió (7.2 m/s, lướt không hồi chiêu, nhấn khi đang lướt bị bỏ qua, xuất hiện lại sau 2700 tick) | `p2_f11_charm`; unit test tốc độ | [p2_f11](phase2/scenarios/p2_f11_charm.jsonl), [ảnh](phase2/screenshots/p2_f11_charm.png) | Đạt |
| F3 Chuỗi 3 Đêm: menu → giới thiệu (tên đảo + Ông Đăng) → chơi → kết quả → Đêm kế; thắng Đêm 3 thì Bình Minh với tổng điểm; thua thì chơi lại | Kiểm tra trình duyệt (phím thật qua DevTools): menu, giới thiệu, Đêm 1 → kết quả → Đêm 2 (tổng 478), thua → chơi lại, thắng Đêm 3 → Bình Minh | [browser-check.txt](phase2/browser-check.txt), [p2_intro](phase2/screenshots/p2_intro.png), [p2_result_won](phase2/screenshots/p2_result_won.png), [p2_dawn](phase2/screenshots/p2_dawn.png) | Đạt |
| F4 Tạm dừng (Esc/P), logic dừng hoàn toàn; Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu | Kiểm tra trình duyệt: Esc thì có menu đủ 4 mục, sim_tick đứng trong 0.8 s còn tick vẫn tăng; Enter thì tiếp tục. `p2_f05_pause` cho headless | [browser-check.txt](phase2/browser-check.txt), [p2_pause](phase2/screenshots/p2_pause.png) | Đạt |
| F5 Cài đặt âm lượng và độ nhạy chuột, lưu giữa các lần mở | Kiểm tra trình duyệt: đặt 0.35 và 1.7, tải lại trang, đọc lại đúng giá trị | [browser-check.txt](phase2/browser-check.txt) | Đạt |
| F6 Âm thanh: nhạc nền đêm + nhặt, thắp đèn, tỏa sáng, bị đánh, nhảy, lướt, thắng, thua, Bóng Mực xuất hiện, đếm ngược 10 s | WebAudio sinh âm trong [audio.js](../../src/web/audio.js) (`startMusic`, `sfx.*`), gọi từ sự kiện sim trong [main.js](../../src/web/main.js) | Code + video demo (Phase 4) | Đạt theo review code; nghe thử trong video |
| F7 HUD đúng vị trí và giá trị; đồng hồ đỏ, nhấp nháy khi ≤ 30 s; nhắc "E — Nạp ánh sáng (x/10)"; mũi tên khi đèn ra ngoài màn hình | Kiểm tra trình duyệt: vị trí (TL/TC/TR/BC/BR) và giá trị khớp sim; nhắc nạp đèn ở cạnh L1; đồng hồ có lớp `danger`; mũi tên ẩn khi đèn trong màn hình, hiện khi đèn sau camera | [browser-check.txt](phase2/browser-check.txt), [browser_playing](phase2/screenshots/browser_playing.png) | Đạt |
| F8 Bảng màu chuẩn (≤ 10%/kênh) | `tests/palette.test.mjs`: mọi màu khớp ticket và đều được renderer/HUD dùng | [test-report](phase2/test-report.txt) | Đạt |
| F9 Ánh sáng môi trường = 0.15 + 0.55 × sáng/tổng | Unit test `ambientIntensity`; kiểm tra trình duyệt: 0.15 khi chưa sáng, 0.7 khi sáng hết | [browser-check.txt](phase2/browser-check.txt) | Đạt |

## Phần 4: Test Contract v1.1 và DoD

| Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| `contract_version` 1.1, khóa tuning mới, `--night 1/2/3` | Contract test | [test-report](phase2/test-report.txt) | Đạt |
| Snapshot: `night`, `wind`, `player.{vel, grounded, invuln, dash_cd_s, pulse_cd_s, charm_s}`, `motes`/`drifters`/`charms` | Contract test kiểu dữ liệu; mọi scenario đọc các trường này | [test-report](phase2/test-report.txt) | Đạt |
| Scenario v1.1 (player.*_ticks, shades[].state, drifters, charms, random_drifters, wind_enabled) | Dùng trong `p2_*`; contract test: giá trị sai cho exit 2 (gồm L7 ở Đêm 1) | [results.md](phase2/scenarios/results.md) | Đạt |
| Input `dash`, `pause`; sự kiện mới | `p2_f01`, `p2_f05`, `p2_f09`, `p2_f10`, `p2_f11`, `p2_f03` | [results.md](phase2/scenarios/results.md) | Đạt |
| Một Đêm đầy đủ ≤ 30 s | 9 lần chạy (3 Đêm × 3 seed), Đêm 3 đủ 21.600 tick: 0.19–0.29 s | [perf.txt](phase2/perf.txt) | Đạt |
| Tất định | sha256 hai lần chạy cùng seed giống hệt, cả 3 Đêm | [determinism.txt](phase2/determinism.txt) | Đạt |
| Hồi quy Phase 1 với số chuẩn | Scenario `p2_r01`…`p2_r07` phủ lại mọi hành vi của `p1_*`; `p1_*` chuyển sang [obsolete-v1.0](../../scenarios/obsolete-v1.0/README.md) kèm lý do | [results.md](phase2/scenarios/results.md) | Đạt |
| Spec có acceptance criteria cho từng mục Phần 3 | [docs/notes/phase2.md](../notes/phase2.md) mục 2 | | Đạt |
| AGENTS.md và skill được cập nhật | Commit `harness: …Ticket-02 scope` | `git log -- AGENTS.md .claude/` | Đạt |
| Mỗi tính năng mới có ≥ 1 scenario headless | Lướt, rơi, tạm dừng, vùng an toàn, Gió Lạc ×2, Bùa, bục nhảy, tầng/dốc/tháp, gió, lịch sinh | [results.md](phase2/scenarios/results.md) | Đạt |
| ≥ 30 FPS trung bình ở 1280×720 | `BROWSER_GPU=1 REQUIRE_FPS=30 node scripts/browser-check.mjs`, Đêm 3, đang chạy | [fps.txt](phase2/fps.txt) | Đạt: khoảng 61 FPS (giới hạn vsync) trên RTX 3050 Laptop. Với renderer phần mềm (SwiftShader, không GPU) chỉ khoảng 6–7 FPS: đó không phải "bản thường" |
| Chất lượng test | Mutation check: 20 lỗi gài đều bị bắt | [mutation.txt](phase2/mutation.txt) | Đạt |
