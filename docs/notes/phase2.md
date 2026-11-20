# Phase 2: Ticket-02 "Ba hòn đảo", spec và ghi chú SDLC

Yêu cầu gốc: [docs/requirements/phase2-Ticket-02.md](../requirements/phase2-Ticket-02.md) · Bằng chứng: [docs/proof/phase2.md](../proof/phase2.md)

## 1. Thay đổi so với Phase 1 (và lý do)

Ticket-02 **thay toàn bộ số tự chọn** ở Phase 1 bằng số chuẩn, và đổi một số luật. Những chỗ đổi:

| Phase 1 (giả định của mình) | Phase 2 (chuẩn) | Ảnh hưởng tới test cũ |
|---|---|---|
| `per_mote` cộng lúc **nhặt** (A3) | +10 mỗi đom đóm **nạp** vào đèn | `p1_01`, `p1_02`: điểm kỳ vọng đổi |
| sức chứa 8, đèn cần 5, nhặt 1.2 m, nạp 2.5 m | 10 / 10 / 1.0 m / 2.0 m | `p1_01`, `p1_05` |
| tỏa sáng 2 đom đóm, 6 m, choáng 3 s, đẩy tức thì, hồi 1 s | 3 / 5 m (3D) / 120 tick / đẩy 4 m trong 15 tick / 3 s | `p1_02` |
| Bóng Mực 3.5 m/s, luôn đuổi | 4.0 m/s, phát hiện 12 m / bỏ 18 m, thêm trạng thái | `p1_03`, `p1_06` |
| đánh rơi về vòng 3 m, tồn tại mãi | vành 1.5–2.5 m, TTL 480 tick | `p1_03` |
| thưởng thắng ×1 giây | ×2 giây | `p1_05` |
| chặn ở mép đảo (`fall_enabled: false`) | rơi khỏi đảo (Y < −10) | unit test "clamp" |
| L2 ở (23.776, 0, 7.725)… | L2 ở (23.8, 0, 7.7)… | không có |

Test Phase 1 bị ticket thay luật được **chuyển sang `scenarios/obsolete-v1.0/`** kèm lý do ([README](../../scenarios/obsolete-v1.0/README.md)); không xóa. Hành vi tương ứng được kiểm chứng lại bằng scenario hồi quy `p2_r*` theo số chuẩn.

## 2. Tiêu chí nghiệm thu

### Phần 1: số liệu và luật chuẩn
| Mã | Tiêu chí (kiểm tra được bằng headless) |
|---|---|
| S1 Di chuyển | `move [0,1]` thì 60 tick đi đúng 6.0 m; có Bùa Gió thì 7.2 m |
| S2 Nhảy | Chỉ nhảy khi `grounded`; vy = 7, g = −20; nhảy trên không không có tác dụng |
| S3 Lướt | Sự kiện `dash`; 12 tick × 14/60 m = 2.8 m; hồi chiêu 90 tick tính từ lúc bắt đầu; đứng yên thì lướt theo hướng mặt; trên không giữ nguyên y |
| S4 Nhặt | XZ ≤ 1.0 và chênh cao ≤ 1.5; tối đa 10; đom đóm ở tầng trên (chênh 3 m) không nhặt được |
| S5 Sinh đom đóm | Đầu Đêm có 20 con ở 20 điểm khác nhau thuộc tập điểm chuẩn; tại tick 240k sinh thêm 1 nếu < 30 và còn điểm trống |
| S6 Đèn | Cần 10; nạp nhiều lần; chọn đèn chưa sáng gần nhất trong 2.0 m, hòa thì id nhỏ |
| S7 Vùng an toàn | Bóng Mực ngoài 6 m không vào được; con ở trong lúc đèn vừa thắp ra tới mép trong ≤ 30 tick và không gây hit trong lúc đó |
| S8 Tỏa Sáng | Tốn 3; mục tiêu 3D ≤ 5 m từ chân + 0.8; choáng 120 tick; đẩy 4 m trong 15 tick; +5 mỗi con trúng; < 3 thì không kích hoạt |
| S9 Bóng Mực | 4.0 m/s (Đêm 3: 4.5); `chase` khi ≤ 12 m, về `wander` khi > 18 m; chỉ dùng 5 tên trạng thái |
| S10 Chạm | XZ ≤ 1.0, chênh cao ≤ 1.5; −1 lửa; rơi floor(mang/2) ra vành 1.5–2.5 m, TTL 480; bất tử 90; con gây hit sang `recoil` 60 tick, lùi 2 m; tối đa 1 hit mỗi tick |
| S11 Lịch sinh Bóng Mực | 2 con ở tick 300, rồi mỗi 480/420/360 tick; tối đa 6/8/10; điểm cách người chơi ≥ 15 m; id theo thứ tự sinh |
| S12 Rơi | Y < −10 thì `player_hit {by:"fall", lost}` đúng 1 lần, kể cả khi đang bất tử; chờ 60 tick; hồi sinh ở điểm xuất phát với bất tử 90 |
| S13 Thời gian / thắng thua | 300/330/360 s; thứ tự xét: no_flames > all_lit > dawn |
| S14 Điểm | +10/đom đóm nạp, +100/đèn, +5/Bóng Mực trúng, khi thắng thêm floor(giây còn) × 2 + 50 × lửa |
| S15 Thứ tự tick, tạm dừng | Đúng 12 bước; khi `paused` thì tick tăng nhưng sim_tick, thời gian, hồi chiêu không đổi |

### Phần 2: bản đồ
| Mã | Tiêu chí |
|---|---|
| M1 Đêm 1 | Đảo r = 40, 5 đèn đúng tọa độ; 24 điểm đom đóm; 12 điểm Bóng Mực r = 37 |
| M2 Đêm 2 | Hai đảo r = 28 ở (0,0) và (70,0) + cầu; đi qua cầu không rơi, bước ra khỏi cầu thì rơi; bục nhảy đưa sang đảo kia sau khoảng 1.4 s; 6 đèn |
| M3 Đêm 3 | Tầng 0/1/2 cao 0/3/6; vách chặn đi lên; đi lên được bằng dốc 30° và 150°; bục (0,3,13) đưa lên tầng 2; tháp chuông r = 2 chặn; 7 đèn; gió mỗi 30 s trong 5 s, đẩy 2 m/s |

### Phần 3: tính năng mới
| Mã | Tiêu chí nghiệm thu | Cách kiểm chứng |
|---|---|---|
| F1 Gió Lạc | Chỉ ở Đêm 2 và 3; sinh ở tick 1200k, tối đa 2 con, id D1, D2…; `idle` → `chase` khi Mây mang ≥ 5 và cách ≤ 15 m, mất điều kiện thì về `idle`; chạm XZ ≤ 1.2 thì cướp min(3, mang), sự kiện `drifter_steal`, rồi `flee` 240 tick và `removed`; mỗi con cướp 1 lần; không mất lửa; bất tử không ngăn bị cướp; vùng an toàn không chặn | Scenario `p2_f1_*` |
| F1b Tỏa Sáng với Gió Lạc | Trúng lúc `chase` thì sang `flee`, không cướp; trúng lúc `flee` có đồ thì `drifter_drop`, đom đóm rơi tại chỗ, biến mất sau 120 tick | Scenario |
| F2 Bùa Gió | Đêm 2 ở (35,0,0); Đêm 3 ở (±30,0,25); nhặt như đom đóm thì `charm_picked {charm_ticks:600}`; tốc độ 7.2; lướt không hồi chiêu (nhấn khi đang lướt bị bỏ qua); xuất hiện lại sau 2700 tick | Scenario + unit |
| F3 Chuỗi 3 Đêm | Menu → giới thiệu Đêm (tên đảo + lời Ông Đăng) → chơi → kết quả → Đêm kế; thắng Đêm 3 thì màn Bình Minh với tổng điểm; thua thì chơi lại Đêm đó | Kiểm tra trình duyệt (`browser-check`) |
| F4 Tạm dừng | Esc/P thì sim dừng hẳn (sim_tick đứng yên); menu có Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu | Scenario `pause` + kiểm tra trình duyệt |
| F5 Cài đặt | Âm lượng và độ nhạy chuột lưu trong `localStorage`, còn nguyên sau khi tải lại trang | Kiểm tra trình duyệt |
| F6 Âm thanh | Nhạc nền đêm + 10 hiệu ứng được liệt kê (WebAudio, không cần file) | Review code + video |
| F7 HUD | Đúng vị trí: lửa trên trái, mm:ss trên giữa (đỏ, nhấp nháy khi ≤ 30 s), đèn k/n + điểm trên phải, 10 ô đom đóm dưới giữa, hồi chiêu Lướt/Tỏa Sáng dưới phải, nhắc "E — Nạp ánh sáng (x/10)", mũi tên tới đèn chưa sáng gần nhất khi nó ngoài màn hình | Kiểm tra trình duyệt + ảnh |
| F8 Bảng màu | Các thành phần dùng đúng hex chuẩn (lệch ≤ 10%/kênh) | Test đối chiếu bảng màu trong code |
| F9 Ánh sáng môi trường | Cường độ = 0.15 + 0.55 × sáng/tổng | Test trên hàm `ambientIntensity` |
| C11 Contract v1.1 | Đủ trường mới; `--night 1..3`; sự kiện mới; 21.600 tick ≤ 30 s | Contract test + perf |
| P30 FPS | Bản thường ≥ 30 FPS trung bình ở 1280×720 | Đo trong trình duyệt (`browser-check --fps`) |

## 3. Giả định (chỗ ticket còn mơ hồ)

| Mã | Giả định | Lý do |
|---|---|---|
| B1 | Góc: điểm = (r·cos a, y, r·sin a) | Chỉ cách này cho tầng 1 "ở nửa z > 0" chứa các điểm 20°…160° và dốc 30°/150° |
| B2 | Đêm 2 xuất phát (0,0,0); **Đêm 3 xuất phát (0,0,−30)**, mặt về +Z | (0,0,0) của Đêm 3 nằm trong tháp chuông |
| B3 | Tăng tốc/dừng tức thì (0 s ≤ 0.1 s) | Đơn giản, đúng ràng buộc |
| B4 | Bước lên tối đa 0.3 m: nền cao hơn chân > 0.3 m là vách (chặn ngang); nền thấp hơn > 0.3 m thì rơi. Dốc (0.5 m/m) đi được | "Vách đứng, bước ra thì rơi" |
| B5 | Khoảng cách nạp đèn, vùng an toàn, phát hiện, Gió Lạc đo trên XZ (quy ước v1.0); Tỏa Sáng đo 3D như ticket | Contract v1.0 |
| B6 | Bóng Mực lơ lửng 1.0 m trên mặt đất bên dưới; "chênh cao" khi chạm = abs(tâm Bóng Mực.y − chân Mây.y) | Cùng mặt đất thì chênh 1.0 ≤ 1.5 nên chạm được; khác tầng 3 m thì không |
| B7 | Bóng Mực chỉ bay trên đất (không ra biển mây), bỏ qua vách giữa các tầng; vật cản = mép đảo + tháp chuông | Ma bay trong sương; cần có "vật cản" cho luật đẩy lùi |
| B8 | `spawning` kéo dài đúng tick sinh ra; từ tick sau thành `chase` (≤ 12 m) hoặc `wander`. Bóng Mực trong scenario không ghi `state` thì xét theo khoảng cách | "Thực thể mới chỉ tương tác được từ tick sau" |
| B9 | `wander`: 1.5 m/s, đổi hướng ngẫu nhiên mỗi 120 tick | Ticket không ghi |
| B10 | `recoil`: lùi khỏi vị trí Mây lúc bị hit, 2/60 m mỗi tick trong 60 tick; Bóng Mực đang `spawning`/`recoil`/`stunned`/bị đẩy khỏi vùng an toàn không gây hit | Ticket |
| B11 | Bị đẩy khỏi vùng an toàn: đi thẳng ra theo bán kính, đều trong 30 tick, tới 6.01 m; nhãn trạng thái giữ nguyên | "Tối đa 30 tick" |
| B12 | Mép vùng an toàn = 6.01 m để output làm tròn vẫn > 6 | Bài học Phase 1 |
| B13 | Đom đóm rơi: góc và bán kính ngẫu nhiên trong vành 1.5–2.5 m, phải nằm trên đất (thử 12 lần, nếu không được thì rơi ở chỗ Mây đứng); tính vào trần 30 | Không rơi ra biển mây |
| B14 | "Điểm trống" = điểm sinh chưa có đom đóm ngẫu nhiên nào | Ticket |
| B15 | Rơi: `player_hit {by:"fall", flames, dropped:0, lost}`; trong 60 tick chờ, Mây đứng yên ở chỗ rơi; hồi sinh ở điểm xuất phát mặc định của Đêm (không phải `player.pos` của scenario), mặt về +Z | Ticket |
| B16 | Headless: `score` là điểm đang chạy của Đêm đó (không về 0 khi thua). Chuỗi 3 Đêm: tổng = tổng các Đêm đã thắng | "Tổng điểm game…" |
| B17 | `night_start {night}` có tick 0, ghi ngay sau snapshot 0 | Dựng scenario không phát sự kiện; night_start là sự kiện của Đêm |
| B18 | Snapshot `player.invuln` = số giây bất tử còn lại (0 nếu không) | Cùng đơn vị với `*_s` |
| B19 | Gió bắt đầu ở sim_tick 1800k, hướng ngẫu nhiên (độ nguyên, seeded RNG); `wind.dir_deg` = hướng cơn gió hiện tại hoặc gần nhất (0 nếu chưa có). Gió chỉ đẩy Mây | Ticket |
| B20 | Gió Lạc chỉ cướp khi đang `chase`; `idle` lượn tròn r = 4 m quanh điểm sinh với 2 m/s; bay cả trên biển mây, cao 1.5 m; Gió Lạc đã `removed` vẫn nằm trong mảng snapshot; Tỏa Sáng trúng theo cùng phép đo 3D ≤ 5 m | Ticket liệt kê `removed` là một trạng thái |
| B21 | Bùa xuất hiện lại ở bước 10 của tick bộ đếm về 0 | "Thực thể mới…từ tick sau" |
| B22 | Lướt: hướng = hướng input (thế giới) nếu có, ngược lại là hướng mặt; giữ y (vy = 0, không trọng lực) khi lướt; vách chặn; sau khi lướt mà đang bay bởi bục thì tiếp tục vận tốc phóng | Ticket |
| B23 | Bục nhảy kích hoạt khi Mây đứng trên đất và XZ ≤ 1.0 tới tâm bục | "Chân Mây chạm bục" |
| B24 | Bản 3D tạm dừng bằng chính input `pause` của sim | Một nguồn sự thật |
| B25 | Đom đóm ngẫu nhiên có `ttl_s: null` | Không có TTL |

## 4. Kế hoạch kiểm chứng
- Viết lại `src/core/sim.js` theo đúng 12 bước (mỗi bước một hàm, đặt tên theo số bước); bản đồ tách ra `src/core/maps.js`.
- Mỗi tính năng mới có ít nhất 1 scenario `p2_*`; số liệu chuẩn có scenario hồi quy `p2_r*` (thay cho `p1_*` đã lỗi thời).
- Contract test cho v1.1 (trường mới, `--night 1..3`, sự kiện, tạm dừng); kiểm tra tất định cho cả 3 Đêm; đo 21.600 tick.
- Bản 3D: `browser-check` mở rộng cho chuỗi Đêm, tạm dừng, cài đặt, HUD, và đo FPS.

## 5. Đánh giá Phase 2
- **Đạt (có bằng chứng):** mọi mục S1–S15, M1–M3, F1–F9, Contract v1.1 và DoD. Chi tiết trong [bảng truy vết](../proof/phase2.md).
- **Kiểm chứng yếu hơn:** F6 âm thanh và cảnh báo gió bằng lá bay chỉ có review code (WebAudio không kiểm tra tự động được), sẽ nghe thử trong video. FPS ≥ 30 đo được trên GPU của máy làm bài (RTX 3050 Laptop, khoảng 61 FPS), chưa đo trên máy chấm.
- **Hồi quy Phase 1:** Ticket-02 thay số liệu và đổi một số luật (điểm cộng lúc nạp thay vì lúc nhặt; tỏa sáng 3D; rơi khỏi đảo…), nên 7 scenario `p1_*` không còn đúng. Chúng được chuyển sang `scenarios/obsolete-v1.0/` kèm bảng lý do, và hành vi tương ứng được kiểm chứng lại bằng `p2_r01`…`p2_r07` theo số chuẩn. Phần còn đúng (mô hình tick, làm tròn, mã thoát, tất định, chuẩn hóa vector) vẫn nằm trong contract test và unit test.
- **Lỗi tìm được nhờ kiểm chứng** (chi tiết ở [ai_log](ai_log.md)):
  - `--night` bị bỏ qua (cả 3 Đêm cùng kết thúc ở tick 17479): phát hiện nhờ chạy thử cả 3 Đêm.
  - Hai phép tính tay sai (hồi chiêu lướt; scenario cây cầu quên tắt Bùa Gió): phát hiện khi đối chiếu với output.
  - Ba test thiết kế sai (đếm TTL lệch 1, test ưu tiên no_flames mâu thuẫn với luật đẩy khỏi vùng an toàn, test hook trỏ tới file đã chuyển chỗ).
  - Mutation check phát hiện một test bị sót khi viết lại (vector ngắn không được chuẩn hóa).
  - Bài kiểm tra trình duyệt phụ thuộc FPS (lướt chưa xong mà đã dịch chuyển Mây; góc camera tính theo thời gian, sai hình học).
  - Camera bị tháp chuông che khi Mây đứng phía bắc tháp: phát hiện nhờ ảnh chụp bằng chứng.
- **Harness đã chỉnh:** AGENTS.md (12 bước, maps, quy ước scenario v1.1, `obsolete-*`, `ui_*`, các bẫy mới), skill `verify-phase` (3 Đêm, `--gpu`), skill `new-scenario` (trường v1.1, `approx`, các bất biến), `contract-reviewer` (đối chiếu thứ tự 12 bước); `browser-check` có chế độ GPU và annotation lỗi cho CI.
- **Rủi ro cho test ẩn:** B2 (Đêm 3 xuất phát (0,0,−30)), B6/B7 (Bóng Mực lơ lửng 1 m, chỉ bay trên đất), B8 (`spawning` 1 tick), B15 (vị trí lúc chờ hồi sinh), B16 (điểm khi thua), B17 (`night_start` ở tick 0). Nên hỏi trợ giảng Phase 2 các điểm này.
