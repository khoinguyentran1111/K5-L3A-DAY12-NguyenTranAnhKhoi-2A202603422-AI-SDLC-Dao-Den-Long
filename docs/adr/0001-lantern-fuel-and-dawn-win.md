# ADR 0001: Mô hình trạng thái đèn có dầu và luật thắng lúc bình minh

- **Trạng thái:** Chấp nhận (Phase 3, Ticket-03, Contract v1.2)
- **Ngày:** 2026-11-20

## Bối cảnh
Đến Phase 2, đèn chỉ có 2 trạng thái: `unlit (deposited 0..9)` → `lit` (vĩnh viễn), và Đêm kết thúc thắng ngay khi mọi đèn sáng (`all_lit`). Playtest cho thấy người chơi giỏi thắng sau khoảng 2 phút. Ticket-03 yêu cầu đèn có thể tắt lại, mục tiêu chuyển thành "giữ đảo sáng tới bình minh", và thêm trạng thái `drain` cho Bóng Mực.

## Quyết định

### 1. Đèn là một máy trạng thái có dầu
```
           nạp đủ cost (10 nếu chưa từng sáng, 5 nếu ever_lit)
  UNLIT ───────────────────────────────────────────────► LIT (fuel = 100, ever_lit = true)
  (deposited 0..cost-1, fuel 0)                           │   ▲
     ▲                                                    │   │ châm dầu: fuel += 10·used (≤ 100)
     │        fuel ≤ 0 (ngay sau bước 2): lantern_out     │   │
     └──────────── deposited = 0, ever_lit giữ true ◄─────┘───┘
                                                     LIT có "vùng an toàn" khi fuel ≥ 30
```
- Dầu lưu bằng **số nguyên đơn vị 1/60** (`fuel_max 100` = 6000). Hao 1 đơn vị/tick, mỗi Bóng Mực `drain` hút 5 đơn vị/tick. Như vậy mọi phép so sánh (≤ 0, < 30, = 100) đều chính xác, không có sai số float; chỉ làm tròn khi xuất (`round(u/6)/10`).
- "Đèn yếu" (`lit && fuel < 30`) **không phải trạng thái riêng** mà là thuộc tính suy ra từ `fuel`. Lý do: tránh đồng bộ hai nguồn sự thật. Vùng an toàn, mục tiêu của Bóng Mực và hiệu ứng nhấp nháy đều đọc cùng một điều kiện.
- `ever_lit` và `relit_count` lưu trên đèn để tính giá thắp lại (5) và điểm (+40).
- Thứ tự trong tick (12 bước Ticket-02 không đổi): bước 2 trừ dầu (hao rồi hút, theo id), bước **2b** mới tắt đèn hết dầu, bước 5 nạp/châm, bước 6 đẩy Bóng Mực khỏi đèn vừa thắp hoặc vừa châm lên ≥ 30.

### 2. Bóng Mực thêm trạng thái `drain`
`wander` chọn mục tiêu mỗi tick: đèn yếu gần nhất, nếu không có thì đèn tắt gần nhất (giả định C8). Tới ≤ 2 m đèn yếu thì `drain`. Từ `drain`: `chase` (Mây ≤ 6 m), `stunned` (Tỏa Sáng), `wander` (đèn tắt, fuel ≥ 30, > 2 m). Mục tiêu lưu trên Bóng Mực (`target`) để scenario đặt được (`target_lantern_id`) và snapshot xuất được.

### 3. Luật thắng chỉ xét ở bình minh
Bước 11 chạy sau mọi cập nhật của tick: hết lửa → thua `no_flames` (luôn ưu tiên); hết giờ → thắng `dawn_survived` nếu số đèn đang sáng ≥ `ceil(win_ratio × tổng)`, ngược lại thua `dawn`. Không còn `all_lit`. Thưởng bình minh tính bằng `floor(fuel)` của dầu thật.

### 4. Không đổi kiến trúc
Toàn bộ thay đổi nằm trong `src/core/sim.js` (thuần, tất định) và số liệu trong `game.contract.json` (tuning mới đọc trực tiếp). Bản 3D chỉ đọc trạng thái (thanh dầu, nhấp nháy, đèn xẹp), nên output headless không phụ thuộc phần hiển thị.

## Hệ quả
- **Phá vỡ tương thích** (liệt kê trong [CHANGELOG.md](../../CHANGELOG.md)): thời lượng Đêm, điểm, luật thắng, `game_over.reason`, `wander` đi về đèn. 6 scenario Phase 2 bị thay được lưu ở `scenarios/obsolete-v1.1/` kèm lý do, không xóa và không skip.
- Đêm luôn kéo dài tới bình minh (trừ khi hết lửa), nên một Đêm headless dài nhất là 18.000 tick (Đêm 3), vẫn dưới 0.3 s.
- Bóng Mực có hành vi có mục đích (đi về đèn) thay vì lang thang ngẫu nhiên, nên dùng ít RNG hơn; chuỗi số ngẫu nhiên khác Phase 2 nhưng vẫn tất định theo seed.
- Rủi ro: C8 (đi về đèn tắt gần nhất) là cách hiểu chữ "như trước"; nếu giảng viên có ý khác, chỉ cần sửa `wanderTarget()`.

## Phương án đã cân nhắc
- **Lưu dầu bằng số thực** và so sánh với epsilon: bị loại vì ticket nói rõ sai số và vì biên "đúng 30" phải chính xác.
- **Thêm trạng thái đèn `weak`**: bị loại vì trùng thông tin với `fuel`, dễ lệch khi châm/hút trong cùng tick.
- **Xét thắng ở bước riêng sau bước 11**: không cần, vì bước 11 vốn đã chạy sau mọi cập nhật.
