# Bằng chứng Phase 1: bảng truy vết

Toàn bộ file trong [phase1/](phase1/) được sinh bằng `npm run proof -- --phase 1` (script [scripts/proof.mjs](../../scripts/proof.mjs)); không sửa tay.
Cấu hình máy và commit ghi ở đầu mỗi file. Chạy lại ở tag `phase-1` sẽ ra cùng kết quả (trừ thời gian đo hiệu năng).

| Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| R1 đi, nhảy, camera | Scenario `p1_07_camera_yaw_jump` (yaw 90 thì +X 6 m; y(10) = 0.917); unit test chuẩn hóa vector và yaw 180 | [results.md](phase1/scenarios/results.md), [p1_07.jsonl](phase1/scenarios/p1_07_camera_yaw_jump.jsonl), [test-report](phase1/test-report.txt) | Đạt |
| R2 5 đèn, đảo tròn | Unit: id L1..L5, L1 ở (0,0,25); người chơi bị chặn trong 40 m; contract test: snapshot có 5 đèn | [test-report](phase1/test-report.txt), [random_world.png](phase1/screenshots/random_world.png) | Đạt |
| R3 nhặt đom đóm | `p1_01` (nhặt ở tick 19/49/79/109/139); unit test biên `pickup_radius` và `carry_capacity` | [p1_01.jsonl](phase1/scenarios/p1_01_collect_and_light.jsonl) | Đạt |
| R4 nạp và thắp đèn | `p1_01` (deposit 5 rồi lantern_lit L1 ở tick 236), `p1_05`; unit test nạp một phần và nạp vừa đủ | [p1_01.jsonl](phase1/scenarios/p1_01_collect_and_light.jsonl), [p1_01_lantern_lit.png](phase1/screenshots/p1_01_lantern_lit.png) | Đạt |
| R5 Bóng Mực đuổi và chạm | `p1_03` (chạm ở tick 35, rơi 2 đom đóm, thua no_flames); unit test bất tử, choáng thì không gây hại, sinh Bóng Mực ngẫu nhiên | [p1_03.jsonl](phase1/scenarios/p1_03_hit_and_lose.jsonl), [p1_03_shade_near.png](phase1/screenshots/p1_03_shade_near.png) | Đạt |
| R5b sợ đèn (A6) | `p1_06` + bất biến "mọi snapshot cách đèn đã thắp > 6 m"; unit test "đèn chưa thắp không an toàn" | [p1_06.jsonl](phase1/scenarios/p1_06_safe_radius.jsonl) | Đạt (theo giả định A6) |
| R6 tỏa sáng | `p1_02` (choáng 180 tick, đẩy tới x = 9, lần 2 không đủ ánh sáng); unit test cooldown và pulse không có mục tiêu | [p1_02.jsonl](phase1/scenarios/p1_02_pulse_stun.jsonl), [p1_02_pulse.png](phase1/screenshots/p1_02_pulse.png) | Đạt |
| R7 thắng / thua | `p1_05` won all_lit ở tick 1; `p1_03` lost no_flames; `p1_04` lost dawn ở tick 120, output dừng | [results.md](phase1/scenarios/results.md), [p1_05_win.png](phase1/screenshots/p1_05_win.png) | Đạt |
| R8 điểm | Tính tay: 150 (`p1_01`), 20 (`p1_02`), 349 (`p1_05`, gồm thưởng thắng); dựng scenario không cộng điểm | [results.md](phase1/scenarios/results.md) | Đạt |
| R9 HUD | Kiểm tra trình duyệt thật: chữ trên HUD (lửa, đom đóm, đèn, thời gian, điểm) khớp trạng thái sim; ảnh chụp | [browser-check.txt](phase1/browser-check.txt), [browser_playing.png](phase1/screenshots/browser_playing.png) | Đạt |
| R10 chơi lại | Kiểm tra trình duyệt thật (Chrome headless, bấm phím qua DevTools Protocol): thắng rồi bấm R thì số ván 1→2; thua (bình minh) rồi bấm Enter thì ván mới ở trạng thái playing; phím khác không khởi động lại | [browser-check.txt](phase1/browser-check.txt), [browser_won.png](phase1/screenshots/browser_won.png), [browser_lost.png](phase1/screenshots/browser_lost.png) | Đạt |
| R1 (bản 3D) | Kiểm tra trình duyệt thật: W đi +Z, D đi sang phải màn hình (−X ở yaw 0), Space nhảy; không có lỗi console | [browser-check.txt](phase1/browser-check.txt) | Đạt |
| R11 phong cách | So sánh ảnh: trời tím tối lúc đầu, sáng lên khi L1 thắp; đèn vàng cam; Bóng Mực tím đen; Mây đội nón lá treo đèn | [random_world.png](phase1/screenshots/random_world.png) và [p1_01_lantern_lit.png](phase1/screenshots/p1_01_lantern_lit.png) | Đạt (đánh giá bằng mắt) |
| C1 contract file | Contract test đủ trường và kiểu; sim đọc tuning trực tiếp từ file nên không thể lệch | [test-report](phase1/test-report.txt) | Đạt |
| C2 CLI, mã thoát | Contract test: 5 file inputs và 3 file scenario sai định dạng cho exit 2; tham số sai cho exit ≠ 0 kèm stderr | [test-report](phase1/test-report.txt) | Đạt |
| C3 mô hình tick | Contract test: sự kiện ở tick 1, time_left ở tick 60 = 299; `p1_04` time_left 1 và 0 | [test-report](phase1/test-report.txt) | Đạt |
| C4 định dạng JSONL | Contract test: snapshot mỗi 10 tick, `--snapshot-every 25`, làm tròn ≤ 3 chữ số, `end` là dòng cuối, `--ticks 0` | [test-report](phase1/test-report.txt) | Đạt |
| C5 tất định | Chạy cả đêm (18000 tick, thế giới ngẫu nhiên) hai lần cùng seed thì sha256 giống hệt; seed khác thì khác | [determinism.txt](phase1/determinism.txt) | Đạt |
| C6 inputs | Unit test cạnh lên, giữ nút chỉ nạp một lần, chuẩn hóa vector; contract test không có inputs thì đứng yên | [test-report](phase1/test-report.txt) | Đạt |
| C7 scenario | `p1_05` (tick 0 điểm 0 dù 4 đèn lit); `p1_03` id tự sinh S1; unit test id tự sinh tránh id đã có | [results.md](phase1/scenarios/results.md) | Đạt |
| D1 macOS/Linux | CI GitHub Actions trên ubuntu-latest và macos-latest | [.github/workflows/ci.yml](../../.github/workflows/ci.yml) | Chưa xác minh: chỉ chạy sau khi push |
| Chất lượng test | Mutation check: gài 10 lỗi vào sim và test phải bắt được | [mutation.txt](phase1/mutation.txt) | 10/10 lỗi bị bắt |
| Hiệu năng (tham khảo) | Headless chạy cả đêm 18000 tick | [perf.txt](phase1/perf.txt) | Khoảng 130 ms mỗi đêm (chưa có ngưỡng ở Phase 1) |

Tái hiện một dòng bất kỳ: lấy lệnh trong [results.md](phase1/scenarios/results.md), hoặc chạy `npm test`.
