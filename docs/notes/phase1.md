# Phase 1: PRD-0, ghi chú SDLC

Yêu cầu gốc: [docs/requirements/phase1-PRD-0.md](../requirements/phase1-PRD-0.md) · Bằng chứng: [docs/proof/phase1.md](../proof/phase1.md)

## 1. Tiêu chí nghiệm thu (mỗi yêu cầu một câu kiểm tra được)

| Mã | Yêu cầu (PRD-0 / Contract) | Tiêu chí nghiệm thu |
|---|---|---|
| R1 | Đi lại, nhảy, camera 3D | `move [0,1]` + yaw 90 trong 60 tick thì tới (6,0,0); nhảy thì y > 0 rồi tiếp đất; camera bám sau lưng Mây và xoay được |
| R2 | Đêm 1, đảo tròn, 5 Đèn Lồng Lớn | Snapshot có đúng 5 đèn L1..L5; người chơi không ra khỏi đảo bán kính 40 m |
| R3 | Đom đóm rải rác, nhặt được | Đi vào ≤ `pickup_radius` thì có `mote_picked`, carried +1, tối đa `carry_capacity` |
| R4 | Nạp ánh sáng để thắp đèn | Đứng ≤ `interact_radius` + interact thì có `deposit`; đủ `lantern_cost` thì có `lantern_lit` |
| R5 | Bóng Mực đuổi, chạm thì mất máu | Bóng Mực tiến về phía Mây với `shade_speed`; ≤ `shade_hit_radius` thì có `player_hit`, flames −1, rơi đom đóm, bất tử `invuln_s` |
| R5b | Bóng Mực sợ đèn | Không Bóng Mực nào ở ≤ `safe_radius` quanh đèn đã thắp (xem A6) |
| R6 | Tỏa sáng xua Bóng Mực, tốn ánh sáng | Pulse tốn `pulse_cost`; Bóng Mực ≤ `pulse_radius` bị choáng `pulse_stun_s` và bị đẩy `pulse_push_m`; có cooldown |
| R7 | Thắng / thua | Thắp đủ 5 đèn thì `game_over won all_lit`; flames = 0 thì `lost no_flames`; hết giờ thì `lost dawn`; output dừng ngay |
| R8 | Điểm số | Điểm khớp công thức ở mục 3 (scenario tính tay ra 150, 20, 349) |
| R9 | HUD | Màn hình có lửa, đom đóm mang theo/sức chứa, số đèn đã thắp, thời gian, điểm, gợi ý |
| R10 | Chơi lại sau thắng/thua | Màn kết thúc có "Nhấn Enter/R để chơi lại"; nhấn thì tạo ván mới |
| R11 | Phong cách | Đêm tím, đèn vàng cam; đảo sáng dần khi thắp; Mây đội nón lá treo đèn; Bóng Mực tím đen; không máu me |
| C1 | `game.contract.json` | Đủ trường; số tuning chính là số game dùng (sim đọc trực tiếp file này) |
| C2 | CLI và mã thoát | Đủ tham số; file sai định dạng thì exit 2; lỗi khác thì exit ≠ 0 kèm stderr |
| C3 | Mô hình tick | Snapshot 0 trước input; sự kiện ở bước k ghi tick k+1; `time_left_s` đúng công thức |
| C4 | Định dạng JSONL | snapshot/event/end đúng tên trường; làm tròn 3 chữ số; `end` là dòng cuối |
| C5 | Tất định | Cùng seed, scenario, inputs thì sha256 output giống hệt |
| C6 | Ngữ nghĩa inputs | Trường giữ giá trị cũ; nút kích hoạt theo cạnh lên; vector > 1 được chuẩn hóa; không có inputs thì đứng yên |
| C7 | Ngữ nghĩa scenario | `random_*` false thì không tự sinh; danh sách thay thế; đèn cập nhật theo id; dựng scenario không có sự kiện, không có điểm |
| D1 | Chạy trên macOS/Linux, ≤ 3 lệnh | `git clone`, `npm install`, `npm start`; CI chạy trên ubuntu và macos |

## 2. Giả định (chỗ PRD-0 mơ hồ)

| Mã | Giả định | Lý do |
|---|---|---|
| A1 | Đảo tròn bán kính 40 m; người chơi bị chặn ở mép (`fall_enabled: false`), không có sự kiện `fall` | Đơn giản, không phạt ngoài ý muốn |
| A2 | 5 đèn trên vòng tròn bán kính 25 m, cách nhau 72°, L1 ở (0,0,25) | Khớp ví dụ trong contract (L1 ở [0,0,25]) |
| A3 | Đom đóm tự nhặt khi ≤ `pickup_radius` và còn chỗ; `per_mote` cộng lúc nhặt | Ví dụ snapshot trong contract: carried 2, score 20 |
| A4 | Nạp đèn cần `interact` (cạnh lên), chọn đèn chưa thắp gần nhất (hòa thì xét id); nạp `min(carried, còn thiếu)` | Ví dụ inputs dùng interact gần đèn |
| A5 | "Ánh sáng" mà tỏa sáng tiêu tốn chính là đom đóm đang mang (`pulse_cost`). Không đủ thì không tỏa sáng, không có sự kiện, không tính cooldown. Tỏa sáng khi không có Bóng Mực nào trong tầm vẫn có sự kiện với `stunned_ids: []`. Bóng Mực đang choáng mà trong tầm thì bị choáng lại và vẫn được cộng `per_stun` | PRD nói "tốn ánh sáng"; dùng một tài nguyên giúp game có lựa chọn chiến thuật |
| A6 | `safe_radius` chỉ áp dụng quanh đèn **đã thắp**. Bóng Mực luôn bị giữ ở khoảng cách ≥ `safe_radius + 0.01` | "Bóng Mực sợ đèn": đèn tắt thì chưa có ánh sáng. Biên 0.01 để output làm tròn vẫn > r. **Rủi ro: cần hỏi trợ giảng hoặc Coach** |
| A7 | Bóng Mực luôn đuổi theo đường thẳng (`chase`); `stunned` thì đứng yên và không gây sát thương; tâm luôn ở y = 1.0 | Đơn giản, dễ kiểm chứng |
| A8 | Mỗi lần chạm mất 1 lửa; `dropped = floor(carried × hit_drop_ratio)`; đom đóm rơi xuống đảo trên vòng 3 m quanh Mây (tổng được bảo toàn); bất tử `invuln_s` | Chữ "đánh rơi" gợi ý rơi xuống đất, nhặt lại được |
| A9 | Thua khi flames = 0 (`no_flames`) hoặc hết thời gian (`dawn`); thắng khi cả 5 đèn đều thắp. Cùng một tick thì xét thắng trước | `game_over.reason` của contract |
| A10 | Thưởng khi thắng: `per_second_left × floor(time_left_s) + per_flame_left × flames`; chỉ cộng khi thắng | Thưởng hoàn thành sớm và chơi khéo |
| A11 | Bộ đếm N tick được đặt ở bước k kéo dài đúng N tick (Bóng Mực choáng hiện trong snapshot k+1..k+N) | Đếm nhất quán, kiểm chứng được |
| A12 | Thứ tự một bước: bộ đếm → di chuyển/nhảy → nhặt → nạp đèn → (thắng?) → tỏa sáng → Bóng Mực di chuyển → va chạm → sinh mới → thời gian | Ghi rõ để tính tay được |
| A13 | Thế giới mặc định: 30 đom đóm; cứ 2 s thêm 1 con nếu còn < 15; 2 Bóng Mực ở cách người chơi ≥ 15 m; cứ 40 s thêm 1 con (tối đa 5, có `shade_spawned`) | Áp lực tăng dần |
| A14 | Nhảy: v0 = 7 m/s, g = 20 m/s²; nhảy không né được va chạm (khoảng cách đo trên XZ) | Contract đo trên XZ |
| A15 | Chưa có `dash` (bỏ qua) | Không bắt buộc ở Phase 1 |
| A16 | Lỗi CLI (thiếu tham số, `--night` ≠ 1) thì exit 1; file inputs/scenario thiếu hoặc sai thì exit 2; tham số lạ thì cảnh báo và bỏ qua | Contract chỉ định mã 2 cho file sai định dạng |
| A17 | Đèn đặt `lit: true` trong scenario mà không có `deposited` thì `deposited = lantern_cost` | Trạng thái nhất quán |

Số tuning (`game.contract.json`): tốc độ 6 m/s, mang tối đa 8, đèn cần 5, nhặt trong 1.2 m, nạp đèn trong 2.5 m, tỏa sáng tốn 2 / bán kính 6 m / choáng 3 s / đẩy 4 m / hồi 1 s, đêm 300 s, 3 lửa, bất tử 1.5 s, rơi 50%, vùng an toàn 6 m, Bóng Mực 3.5 m/s (chậm hơn Mây), chạm trong 1.0 m. Không có giá trị null.

## 3. Cách tính điểm

`+10` mỗi đom đóm nhặt · `+100` mỗi đèn thắp · `+20` mỗi Bóng Mực bị choáng · khi thắng thêm `+1 × số giây còn lại (làm tròn xuống)` và `+50 × số lửa còn lại`.

## 4. Kế hoạch kiểm chứng (lập trước khi code)
- Tách luật vào `src/core/sim.js` (thuần, tất định), dùng chung cho headless và web, để mọi bằng chứng headless cũng đúng cho bản chơi.
- Mỗi yêu cầu R/C có ít nhất một test hoặc scenario; kỳ vọng tính tay (`why`) và tránh giá trị nằm ngay biên.
- Test hộp đen gọi CLI thật như máy chấm; kiểm tra tất định bằng sha256; mutation check để chứng minh test không "luôn đạt".
- Bản 3D: chế độ replay `?scenario=` phát lại đúng file headless để chụp ảnh tái lập được.

## 5. Đánh giá Phase 1
- **Đạt (có bằng chứng):** R1–R10, R5b, R11, C1–C7. Chi tiết trong [bảng truy vết](../proof/phase1.md). R9 và R10 được kiểm tra end-to-end trên trình duyệt thật (`scripts/browser-check.mjs`, 13 check).
- **Kiểm tra một phần:** R11 phong cách chỉ đánh giá bằng mắt qua ảnh chụp.
- **D1 macOS/Linux:** ở commit của tag `phase-1` (`bd61a58`), CI cho thấy test, scenario và tất định **đạt trên Ubuntu**, nhưng job bị đỏ vì lỗi trong chính script kiểm chứng (mutation check đọc sai định dạng TAP của Node 20; browser check cần `WebSocket` của Node 22). Game và headless không bị ảnh hưởng. Đã sửa sau tag (`f192bab`…`1c214f9`); CI xanh trên Ubuntu Node 20/22 và macOS Node 22. Không dời tag vì Phase 2 đã phát hành (quá hạn Phase 1).
- **Lỗi tìm được nhờ kiểm chứng:** (1) Bóng Mực đứng đúng 6.0000001 m, output làm tròn thành 6.000 và bị tính là "trong bán kính": scenario p1_06 bắt được, đã sửa bằng biên an toàn. (2) Test chưa phân biệt được floor và ceil khi đánh rơi đom đóm: mutation check bắt được, đã thêm test với số lẻ.
- **Hồi quy:** đây là phase đầu, chưa có phase trước.
- **Harness đã chỉnh:** thêm `.gitattributes` (CRLF làm hỏng mutation check); thêm hook chặn sửa `expect.json` và hook Stop chặn kết thúc khi test đỏ; ghi bẫy làm tròn vào AGENTS.md.
- **Rủi ro cho test ẩn:** giả định A5 (tài nguyên của tỏa sáng), A6 (vùng an toàn chỉ quanh đèn đã thắp), A8 (làm tròn xuống). Nên hỏi trợ giảng Phase 1 để xác nhận.
