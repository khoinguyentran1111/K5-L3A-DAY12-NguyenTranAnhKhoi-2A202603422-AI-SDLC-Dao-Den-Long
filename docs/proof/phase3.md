# Bằng chứng Phase 3 (Ticket-03 "Đèn cạn dầu"): bảng truy vết

Toàn bộ file trong [phase3/](phase3/) được sinh bằng `npm run proof -- --phase 3 --gpu` ([scripts/proof.mjs](../../scripts/proof.mjs)); không sửa tay.
Cấu hình máy và commit ghi ở đầu mỗi file. Mã yêu cầu (F*, D*, W*, K*, P*, A*, V*) theo [spec Phase 3](../notes/phase3.md).
Scenario: lệnh tái hiện từng dòng nằm trong [results.md](phase3/scenarios/results.md); kỳ vọng tính tay nằm trong `scenarios/<tên>/expect.json` (trường `why`).

## Luật mới (Ticket-03 §1–§5)

| Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| F1 thắp → fuel 100; hao 1/60 mỗi tick; fuel ≤ 0 thì tắt ngay sau bước 2, `deposited = 0`, `lantern_out`, `ever_lit` giữ | `p3_01_fuel_decay_out` (tắt đúng tick 60 với fuel 1); unit test 100 kéo dài đúng 6000 tick | [p3_01](phase3/scenarios/p3_01_fuel_decay_out.jsonl), [test-report](phase3/test-report.txt) | Đạt |
| F2 châm dầu `used = min(mang, ceil((100 − fuel)/10))`, tối đa 100; đèn đầy không được chọn, không sự kiện, không điểm | `p3_02_refuel_formula`; unit test bảng 4 trường hợp (95.0, 30.0, 29.983, 10.0) và đèn đầy | [p3_02](phase3/scenarios/p3_02_refuel_formula.jsonl) | Đạt |
| F3 chỉ xét đèn nhận được; gần nhất, hòa id nhỏ | `p3_02` (đèn sáng chưa đầy ở 1 m thắng đèn tắt ở 1.5 m); unit test hòa id | [p3_02](phase3/scenarios/p3_02_refuel_formula.jsonl) | Đạt |
| F4 thắp lại cần 5 (ever_lit), chưa từng sáng cần 10; `relight`, `relit_count` | `p3_03_relight`, `p3_04_first_light_capacity` | [p3_03](phase3/scenarios/p3_03_relight.jsonl) | Đạt |
| D1 fuel < 30 mất vùng an toàn, đúng 30 vẫn còn | `p3_14_low_fuel_loses_safe_zone` (bị chặn ở 18.99 tới tick 30 khi fuel = 30.0, vào được ở tick 31); unit test mục tiêu với 30.0 / 29.983 | [p3_14](phase3/scenarios/p3_14_low_fuel_loses_safe_zone.jsonl) | Đạt |
| D2 chỉ `wander` chọn đèn yếu gần nhất (hòa id nhỏ), không có thì đèn tắt gần nhất | `p3_15_wander_prefers_weak` (đèn yếu ở 3 m thắng đèn tắt ở 2.5 m); unit test `wanderTarget` | [p3_15](phase3/scenarios/p3_15_wander_prefers_weak.jsonl) | Đạt |
| D3 ≤ 2 m thì `drain`, đứng yên, hút 5/giây, cộng dồn, đèn vẫn hao 1/giây; `fuel_drain` mỗi 60 tick | `p3_05_drain_until_out` (fuel 1745 − 6t, sự kiện ở tick 61/121/181/241, tắt tick 291); `p3_06` (2 con: 1200 − 11) | [p3_05](phase3/scenarios/p3_05_drain_until_out.jsonl), [p3_06](phase3/scenarios/p3_06_pulse_drain_score.jsonl) | Đạt |
| D4 drain → chase (Mây ≤ 6 m) / stunned (Tỏa Sáng) / wander (tắt, ≥ 30, > 2 m); hết choáng → wander | `p3_16_drain_breaks_to_chase` (9 m vẫn drain, 6 m thì chase), `p3_06`, `p3_07`, `p3_05` | [results.md](phase3/scenarios/results.md) | Đạt |
| D5 châm lên ≥ 30 đẩy Bóng Mực trong 6 m ra mép ≤ 30 tick, không sát thương | `p3_07_refuel_evicts` (z = 18.99 ở tick 30, 0 hit) | [p3_07](phase3/scenarios/p3_07_refuel_evicts.jsonl) | Đạt |
| W1 thời lượng 240 / 270 / 300 s | `p3_m1/m2/m3_defaults`; contract test `--night` | [results.md](phase3/scenarios/results.md) | Đạt |
| W2 thắng lúc bình minh nếu còn sống và đèn sáng ≥ 3/5, 4/6, 5/7 | `p3_08` (Đêm 1, 3/5 thắng, 447), `p3_09` (Đêm 2, 3/6 thua), `p3_10` (Đêm 3, 5/7 thắng, 845); unit test ngưỡng | [p3_08](phase3/scenarios/p3_08_dawn_win_night1.jsonl) | Đạt |
| W3 thắp hết đèn không kết thúc Đêm | `p3_11_no_early_win`; unit test 600 tick với 5/5 đèn; kiểm tra trình duyệt "all lanterns lit does not end the night early" | [p3_11](phase3/scenarios/p3_11_no_early_win.jsonl) | Đạt |
| W4 thứ tự: đèn tắt ngay sau bước 2, xét thắng/thua sau cùng, `no_flames` ưu tiên | `p3_12_out_on_dawn_tick`, `p3_13_no_flames_beats_dawn`; unit test đèn thắp ở chính tick bình minh được tính | [p3_12](phase3/scenarios/p3_12_out_on_dawn_tick.jsonl), [p3_13](phase3/scenarios/p3_13_no_flames_beats_dawn.jsonl) | Đạt |
| K1 sức chứa 10 + 2 × successful_lights, tối đa 20; đèn đặt sẵn không tính; về 0 mỗi Đêm | `p3_04` (18 → 20, nhặt đúng 20/22), `p3_11` (4 đèn đặt sẵn không tính); unit test | [p3_04](phase3/scenarios/p3_04_first_light_capacity.jsonl) | Đạt |
| P1 điểm mới (+5 nạp/châm, +100, +40, +5/+15, bình minh 50 + floor(fuel) + 50/lửa, bỏ thưởng thời gian) | Tính tay: 150 (`p3_r01`), 30 (`p3_02`), 65 (`p3_03`), 30 (`p3_06`), 447 (`p3_08`), 845 (`p3_10`), 105 (`p3_f06`) | [results.md](phase3/scenarios/results.md) | Đạt |

## Hiển thị và mù màu (§1 hiển thị, §4 HUD, §6)

| Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| V1 thanh dầu trên đèn sáng; fuel < 30 thì đèn và thanh nhấp nháy 1 Hz | Kiểm tra trình duyệt: độ dài thanh = fuel/100, hệ số sáng đổi giữa 1 và 0.25 theo nhịp 0.5 s | [browser-check](phase3/browser-check.txt), [ảnh](phase3/screenshots/p3_fuel.png), [ảnh](phase3/screenshots/ui_p3_fuel_states.png) | Đạt |
| V2 HUD "đang mang / sức chứa", đèn sáng / cần | Kiểm tra trình duyệt: 12 ô và "5/12" sau 1 lần thắp; "cần 3" | [browser-check](phase3/browser-check.txt) | Đạt |
| A1 cài đặt "Bảng màu dễ phân biệt" được lưu; viền + mắt Bóng Mực #00B3FF; cảnh báo #FFFFFF kèm ⚠ | Kiểm tra trình duyệt sau khi tải lại trang (đọc màu vật liệu và biến CSS); test bảng màu | [browser-check](phase3/browser-check.txt), [ảnh](phase3/screenshots/p3_colorblind.png) | Đạt |
| A2 đèn tắt xẹp 20 % và giấy rách; đèn sắp hết dầu nhấp nháy (không cần màu) | Kiểm tra trình duyệt: scale 0.8 / 1.0 so với 1 / 1.25, vết rách hiện khi tắt, ẩn khi sáng | [browser-check](phase3/browser-check.txt), [ảnh](phase3/screenshots/p3_05_lantern_out_torn.png) | Đạt |
| Bóng Mực hút dầu có tia nối tới đèn (sáng tạo, phục vụ dễ đọc) | Kiểm tra trình duyệt | [ảnh](phase3/screenshots/p3_05_shade_draining.png) | Đạt |

## Contract v1.2 và DoD

| Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| `contract_version` 1.2, tuning mới, durations mới | Contract test + unit test tuning | [test-report](phase3/test-report.txt) | Đạt |
| Snapshot: `fuel` (1 chữ số, 0 khi tắt), `ever_lit`, `relit_count`, `player.capacity`, trạng thái `drain` | Contract test "v1.2 fields" | [test-report](phase3/test-report.txt) | Đạt |
| Scenario: `fuel`, `ever_lit`, `successful_lights`, `target_lantern_id`; lit không fuel = 100; sai định dạng / id không có → exit 2 | Contract test (5 file scenario sai mới), `p3_10` | [test-report](phase3/test-report.txt) | Đạt |
| Sự kiện `refuel`, `lantern_out`, `fuel_drain`, `lantern_lit.relight`, `dawn_survived`; không còn `all_lit` | Contract test "v1.2 events" | [test-report](phase3/test-report.txt) | Đạt |
| Tất định, hiệu năng | 3 Đêm × (A = B, A ≠ C); Đêm dài nhất 18.000 tick dưới 0.4 s | [determinism](phase3/determinism.txt), [perf](phase3/perf.txt) | Đạt |
| DoD: ghi chú quyết định thiết kế | [ADR 0001](../adr/0001-lantern-fuel-and-dawn-win.md) | — | Đạt |
| DoD: test cũ bị thay được cập nhật hoặc xóa có lý do, không skip | 6 scenario → [obsolete-v1.1](../../scenarios/obsolete-v1.1/README.md) (bảng lý do + scenario thay thế); unit/contract test sửa có chú thích ở đầu file | — | Đạt |
| DoD: changelog breaking changes | [CHANGELOG.md](../../CHANGELOG.md) | — | Đạt |
| DoD: test ẩn Phase 1–2 không bị thay vẫn đạt | 22 scenario `p2_*` còn hiệu lực vẫn chạy và đạt; contract test v1.0/v1.1 giữ nguyên | [results.md](phase3/scenarios/results.md) | Đạt (với các test của mình) |
| Test có bắt được lỗi | 40 lỗi gài (20 cho luật Ticket-03), bắt cả 40 | [mutation](phase3/mutation.txt) | Đạt |
| FPS bản 3D | 60.8 FPS trung bình, Đêm 3, 1280×720, GPU | [fps](phase3/fps.txt) | Đạt |
