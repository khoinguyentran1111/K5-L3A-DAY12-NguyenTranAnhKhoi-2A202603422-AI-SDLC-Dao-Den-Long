# Phase 3: spec, giả định và đánh giá (Ticket-03 "Đèn cạn dầu", Contract v1.2)

Yêu cầu gốc: [docs/requirements/phase3-Ticket-03.md](../requirements/phase3-Ticket-03.md). Quyết định thiết kế: [ADR 0001](../adr/0001-lantern-fuel-and-dawn-win.md). Thay đổi phá vỡ tương thích: [CHANGELOG.md](../../CHANGELOG.md).

## 1. Thay đổi so với Phase 2

| Luật Phase 2 | Phase 3 | Ticket-03 |
|---|---|---|
| Đèn đã sáng thì sáng mãi, không nhận thêm đom đóm | Đèn có dầu 0–100, hao 1/giây; châm dầu; hết dầu thì tắt; thắp lại cần 5 | §1 [THAY THẾ] |
| Bóng Mực không bao giờ vào vùng an toàn | Đèn fuel < 30 mất vùng an toàn; Bóng Mực `drain` hút dầu | §2 [THAY THẾ] |
| Thắng ngay khi thắp hết đèn (`all_lit`) | Chỉ thắng ở bình minh nếu số đèn sáng ≥ ceil(0.6 × tổng) (`dawn_survived`) | §3 [THAY THẾ] |
| Đêm 300 / 330 / 360 s | 240 / 270 / 300 s | §3 |
| Mang tối đa 10 | 10 + 2 × số lần thắp thành công, tối đa 20 | §4 |
| +10/đom đóm, thưởng thời gian ×2 | +5/đom đóm (cả châm dầu), +100 thắp lần đầu, +40 thắp lại, +15 khi trúng Bóng Mực đang drain, bình minh 50 + floor(fuel) mỗi đèn sáng | §5 [THAY THẾ] |
| — | Cài đặt "Bảng màu dễ phân biệt" | §6 |

## 2. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Kiểm chứng |
|---|---|---|
| F1 Dầu | Thắp → 100; hao đúng 1/60 mỗi tick (100 kéo dài đúng 6000 tick); hết dầu thì tắt ngay sau bước 2, `deposited = 0`, `lantern_out`, `ever_lit` giữ true | `p3_01`, unit "fuel is exact" |
| F2 Châm dầu | `used = min(mang, ceil((100 − fuel)/10))`, `fuel = min(100, fuel + 10·used)`; đèn đầy không được chọn, không sự kiện, không điểm | `p3_02`, unit "refuel formula", "interact" |
| F3 Chọn đèn | Chỉ đèn nhận được (tắt, hoặc sáng chưa đầy); gần nhất, hòa thì id nhỏ | `p3_02`, unit "interact" |
| F4 Thắp lại | Đèn từng sáng cần 5, chưa từng sáng cần 10; `relight`, `relit_count` | `p3_03`, `p3_04` |
| D1 Vùng an toàn | fuel < 30 thì mất; đúng 30 vẫn còn | `p3_14`, unit "wander target" |
| D2 Chọn đèn yếu | Chỉ `wander` chọn đèn sáng fuel < 30 gần nhất (hòa id nhỏ), không có thì đèn tắt gần nhất; `chase` không đổi mục tiêu | `p3_15`, unit "wander target" |
| D3 Drain | ≤ 2 m thì `drain`, đứng yên, hút 5/giây, cộng dồn, đèn vẫn hao 1/giây; `fuel_drain` mỗi 60 tick | `p3_05`, `p3_06` |
| D4 Rời drain | chase khi Mây ≤ 6 m; stunned khi trúng Tỏa Sáng; wander khi đèn tắt, fuel ≥ 30 hoặc > 2 m; hết choáng về wander | `p3_05`, `p3_06`, `p3_07`, `p3_16` |
| D5 Châm lên ≥ 30 | Bóng Mực trong 6 m bị đẩy ra mép ≤ 30 tick, không sát thương | `p3_07` |
| W1 Thời lượng | 240 / 270 / 300 s | `p3_m1/m2/m3_defaults`, contract test |
| W2 Thắng | Còn sống ở bình minh và số đèn sáng ở tick cuối ≥ 3/5, 4/6, 5/7 | `p3_08`, `p3_09`, `p3_10`, unit "dawn" |
| W3 Không thắng sớm | Thắp hết đèn không kết thúc Đêm | `p3_11`, unit "dawn" |
| W4 Thứ tự | Đèn tắt ngay sau bước 2; xét thắng/thua sau mọi cập nhật; hết lửa luôn thua `no_flames` trước | `p3_12`, `p3_13` |
| K1 Sức chứa | 10 + 2 × successful_lights, tối đa 20; đèn đặt sẵn bằng scenario không tính; về 0 mỗi Đêm | `p3_04`, `p3_11`, unit "capacity" |
| P1 Điểm | +5 mỗi đom đóm nạp/châm, +100 lần đầu, +40 thắp lại, +5 / +15 (đang drain) khi trúng Tỏa Sáng, bình minh 50 + floor(fuel) mỗi đèn sáng + 50 mỗi lửa, không thưởng thời gian | `p3_r01`, `p3_03`, `p3_06`, `p3_08`, `p3_10` |
| A1 Mù màu | Cài đặt được lưu; viền/mắt Bóng Mực #00B3FF; cảnh báo #FFFFFF + ⚠; đèn tắt xẹp 20% + giấy rách; đèn yếu nhấp nháy | Kiểm tra trình duyệt + test bảng màu |
| V1 Hiển thị | Thanh dầu trên đèn sáng; fuel < 30 thì đèn và thanh nhấp nháy 1 Hz; HUD "mang / sức chứa" | Kiểm tra trình duyệt + ảnh |
| C12 Contract v1.2 | Đủ tuning mới; snapshot `fuel` (1 chữ số), `ever_lit`, `relit_count`, `capacity`, trạng thái `drain`; scenario `fuel`, `ever_lit`, `successful_lights`, `target_lantern_id`; sự kiện mới | Contract test |

## 3. Giả định (chỗ ticket còn mơ hồ)

| Mã | Giả định | Lý do |
|---|---|---|
| C1 | Dầu lưu bằng số nguyên đơn vị 1/60 (100 = 6000); hao 1, mỗi con drain 5 mỗi tick; xuất ra `round(u/6)/10` | Ticket khuyên làm vậy; không sai số float |
| C2 | Bước 2: mọi đèn sáng hao trước, rồi Bóng Mực đang `drain` (trạng thái đầu tick) hút theo id tăng dần; dầu không âm. Bước "2b" ngay sau đó: đèn fuel ≤ 0 tắt theo id | "ở bước 2 trừ dầu; ngay sau bước 2 đèn tắt" |
| C3 | `fuel_drain` ghi khi một con đã hút đủ 60, 120, … tick kể từ lúc vào `drain`; `fuel` là giá trị sau mọi trừ dầu của tick đó | "ghi mỗi 60 tick khi đang hút" |
| C4 | Nạp vào đèn tắt vẫn phát `deposit {lantern_id, amount, deposited}` như cũ; châm dầu chỉ phát `refuel` | Không đổi sự kiện cũ |
| C5 | Đèn sáng giữ `deposited` bằng số đã nạp khi thắp (10 hoặc 5); châm dầu không đổi `deposited` | Ticket chỉ nói "hết dầu thì deposited = 0" |
| C6 | Scenario: `lit: true` không có `fuel` thì 100; `ever_lit` mặc định bằng `lit`; đèn tắt luôn fuel 0; `relit_count` bắt đầu 0 | Ticket §7 |
| C7 | Đèn đặt sẵn bằng scenario không tính vào `successful_lights`; `player.successful_lights` trong scenario đặt trực tiếp giá trị đầu | Ticket §4 |
| C8 | Không có đèn yếu thì Bóng Mực `wander` **đi về đèn tắt gần nhất** (hòa id nhỏ) với 1.5 m/s và đứng chờ khi cách ≤ 2 m. Không có đèn tắt và không có đèn yếu thì lang thang ngẫu nhiên như B9 | Ticket ghi "như trước"; Phase 2 chưa có luật này (B9 là lang thang ngẫu nhiên), nên đây là thay đổi hành vi `wander` |
| C9 | Bóng Mực `wander` di chuyển trước, rồi nếu cách đèn yếu ≤ 2 m thì vào `drain` ngay tick đó; hút từ tick sau (bước 2) | Trạng thái đổi ở bước 8 |
| C10 | Ở bước 8, Bóng Mực `drain` xét theo thứ tự: Mây ≤ 6 m → `chase`; đèn tắt / fuel ≥ 30 / > 2 m → `wander`; sau khi đổi thì di chuyển theo trạng thái mới ngay tick đó (như Phase 2) | Ticket §2 |
| C11 | Châm dầu mà fuel sau khi châm ≥ 30 thì xét đẩy Bóng Mực trong 6.01 m ra mép, như đèn vừa thắp; con đang `drain` về `wander` | Ticket §2 |
| C12 | Tỏa Sáng trúng Bóng Mực đang `drain` thì +15 thay cho +5 ("tổng +15") | Ticket §5 |
| C13 | Ngưỡng thắng = `ceil(win_ratio × n − 1e-9)` | Tránh sai số float của 0.6 × n |
| C14 | Thưởng bình minh dùng `floor(fuel)` với fuel thật (đơn vị 1/60), không dùng số đã làm tròn | Ticket §5 |
| C15 | Snapshot thêm `shades[].target_lantern_id` (null nếu không có): đèn đang hút, hoặc đèn đang đi tới | Ticket thêm trường này ở scenario; xuất ra để kiểm chứng được |
| C16 | Scenario `drain` không có `target_lantern_id` thì nhắm đèn gần nhất; id đèn không có ở Đêm đó thì exit 2 | Hợp với cách xử lý `lanterns` |
| C17 | "Hết choáng thì về wander" áp dụng cho mọi Bóng Mực choáng; ngay tick đó vẫn xét `wander → chase` (≤ 12 m) như Phase 2 | Ticket §2 |
| C18 | Điểm thắp lại và thưởng không phụ thuộc Đêm; `game_over.reason` ∈ {`dawn_survived`, `dawn`, `no_flames`} | Ticket §3 |
| C19 | Bản 3D: mũi tên HUD chỉ tới đèn cần chú ý nhất: đèn yếu gần nhất, nếu không có thì đèn tắt gần nhất | Mục tiêu mới là "giữ đảo sáng" |

## 4. Kế hoạch kiểm chứng
- Luật trong `src/core/sim.js` (bước 2 và 2b mới, `phase5Interact`, `wanderMove`, `phase11WinLose`); không đổi thứ tự 12 bước.
- 22 scenario `p3_*` với kỳ vọng tính tay; 6 scenario `p2_*` bị thay chuyển sang `scenarios/obsolete-v1.1/` kèm bảng lý do; 22 scenario `p2_*` còn lại vẫn chạy.
- Unit test và contract test cho v1.2; mutation check thêm 18 lỗi gài cho luật mới.
- Bản 3D: thanh dầu, nhấp nháy, đèn tắt xẹp và rách, chế độ mù màu, HUD sức chứa và ngưỡng đèn; kiểm tra bằng `browser-check`.

## 5. Đánh giá Phase 3
- **Đạt (có bằng chứng):** mọi mục F1–F4, D1–D5, W1–W4, K1, P1, V1–V2, A1–A2, Contract v1.2 và 4 mục DoD. Chi tiết trong [bảng truy vết](../proof/phase3.md).
- **Kiểm chứng yếu hơn:** âm thanh mới (châm dầu, đèn tắt) chỉ có review code. "Nhấp nháy 1 Hz" được đo bằng hệ số sáng đổi theo nhịp 0.5 s trong trình duyệt, không đo bằng ảnh liên tiếp. FPS 60.8 trên GPU của máy làm bài, chưa đo trên máy chấm.
- **Hồi quy Phase 1–2:** chạy lại 28 scenario Phase 2 trên luật mới thì 22 đạt. 6 scenario đỏ đều do luật [THAY THẾ] (thời lượng, điểm, thắng sớm), nên được chuyển sang `scenarios/obsolete-v1.1/` kèm bảng lý do và scenario thay thế. Unit/contract test bị thay được sửa và có chú thích lý do. Không có test nào bị skip.
- **Rủi ro cho test ẩn:**
  - C8: `wander` đi về đèn tắt gần nhất và đứng chờ. Đây là cách hiểu chữ "như trước", và làm hành vi `wander` khác Phase 2.
  - C3: thời điểm phát `fuel_drain`.
  - C5: `deposited` của đèn sáng giữ 10/5.
  - C12: +15 thay cho +5.
  - C15: thêm `target_lantern_id` vào snapshot.

  Nên hỏi trợ giảng Phase 3 các điểm này.
- **Lỗi tìm được nhờ kiểm chứng** (chi tiết ở [ai_log](ai_log.md) #21–#30):
  - Kỳ vọng sai định dạng mảng.
  - Phép tính tay quên rằng dầu bị hao trước khi châm.
  - Biên bán kính nhặt mất test bảo vệ khi lưu trữ `p2_r01`; mutation check phát hiện.
  - Prompt bị ẩn sai.
  - Replay bỏ qua bàn phím.
  - Mutation check sửa trực tiếp file thật nên đụng hook Stop.
  - Reviewer chỉ ra 2 nhánh `drain` chưa được ghim bằng test.
- **Harness đã chỉnh:**
  - `mutation-check` chạy trên bản sao tạm, có 40 lỗi gài.
  - Thêm bẫy dầu và bẫy mảng `expect` vào AGENTS.md.
  - Skill `new-scenario` có trường v1.2 và cách tính dầu.
  - `contract-reviewer` đối chiếu v1.2.
  - Bản 3D có `&live` để dựng scenario rồi điều khiển bằng phím thật.
