# Retro: Đảo Đèn Lồng (Day 12 AI SDLC Lab)

## Tổng hợp Evaluation 4 phase
| Phase | Kết quả | Hồi quy và rủi ro |
|---|---|---|
| 1 (PRD-0, v1.0) | Game 3D một đảo + headless; 19 scenario tính tay, tất định, mutation check | Số tự chọn sau đó bị Ticket-02 thay |
| 2 (Ticket-02, v1.1) | 3 Đêm, 12 bước/tick, Lướt, Gió Lạc, Bùa Gió, tạm dừng, HUD, âm thanh; 28 scenario, 20 lỗi gài bị bắt, 61 FPS | 7 scenario Phase 1 chuyển sang `obsolete-v1.0` kèm lý do |
| 3 (Ticket-03, v1.2) | Dầu đèn (số nguyên 1/60), Bóng Mực `drain`, thắng lúc bình minh, sức chứa tăng dần, điểm mới, chế độ mù màu; ADR + CHANGELOG; 44 scenario, 40 lỗi gài bị bắt | 6 scenario Phase 2 chuyển sang `obsolete-v1.1`; 22 scenario Phase 2 vẫn đạt |
| 4 (Ticket-04, v1.3) | Benchmark (148.6 FPS, 1% low 52), soak (0 crash, RSS +9 %), bảng xếp hạng trên đĩa, đổi phím, phụ đề, giảm chuyển động, cỡ chữ, gói phát hành | Số đo bench phụ thuộc máy chấm |

## Điều gì hiệu quả khi làm với AI
- **Lưu nguyên văn yêu cầu vào repo** (`docs/requirements/`) và viết spec cùng giả định trước khi code. Agent không phải đọc lại web, và mọi luật đều có nguồn để reviewer đối chiếu.
- **Kỳ vọng tính tay** (trường `why`) cùng hook chặn sửa `expect.json`. AI không thể "chép output cho xanh", và mọi lần lệch đều buộc phải chỉ ra ai sai: code, phép tính hay thiết kế test.
- **Mutation check** là lớp bắt "test giả" hiệu quả nhất. Nó bắt được những chỗ mà cả người lẫn AI đều bỏ sót: test chuẩn hóa vector bị xóa nhầm (Phase 2), biên bán kính nhặt mất bảo vệ khi lưu trữ scenario cũ (Phase 3).
- **Chạy scenario cũ trên luật mới trước khi viết test mới** (Phase 3). Cách này cho danh sách chính xác test nào bị thay (6/28) thay vì đoán.
- **Agent reviewer độc lập** (`contract-reviewer`) tìm ra các nhánh `drain` chưa có test, mà agent viết code đã bỏ qua.
- **Kiểm tra trình duyệt bằng phím thật** qua DevTools Protocol, kèm ảnh chụp. Cách này phát hiện lỗi mà unit test không thấy: camera bị tháp che, prompt bị ẩn, replay bỏ qua bàn phím.

## Điều gì không hiệu quả
- **Vá file bằng heredoc trong bash** hỏng nhiều lần (`\n`, dấu nháy, mất `\` trong regex), kể cả sau khi đã ghi bẫy vào AGENTS.md. Cách khắc phục thật là dùng công cụ Write/Edit, không phải nhắc nhở.
- **Phép tính tay của AI** sai ở đúng những chỗ tinh tế nhất: đếm tick lệch một, quên rằng dầu bị hao trước khi châm. Scenario bắt được, nhưng tốn vòng sửa.
- **Kiểm tra phụ thuộc thời gian thật** (FPS, đợi cố định) cho kết quả khác nhau giữa GPU và phần mềm. Phải chuyển sang đợi theo điều kiện và đặt trạng thái trực tiếp.
- **Hook Stop chạy song song với mutation check** báo đỏ giả, vì mutation check khi đó sửa trực tiếp file thật. Đã sửa bằng cách chạy mutation trên bản sao tạm.

## Những lần AI sai và cách phát hiện
30 mục, chia theo phase trong [ai_log.md](ai_log.md). Những nhóm chính:
- **Lỗi luật/biên:** làm tròn ở mép vùng an toàn (scenario + bất biến), `--night` bị bỏ qua (chạy thử 3 Đêm).
- **Phép tính tay sai:** scenario FAIL rồi đếm lại.
- **Test giả hoặc test bị sót:** mutation check, reviewer.
- **Lỗi hiển thị:** kiểm tra trình duyệt và ảnh chụp.
- **Lỗi công cụ** (heredoc, CRLF, Node 20 không có WebSocket, đơn vị KB của `PeakWorkingSetSize`): đọc kỹ output, annotation CI, giá trị bất thường (`peak_mem_mb = 1`).

## Harness nào giúp nhiều nhất
1. **Hook `PreToolUse` chặn sửa `expect.json`** cùng quy tắc "lưu trữ test cũ kèm lý do": giữ cho test luôn trung thực qua 3 lần đổi luật.
2. **Hook `Stop` chạy `npm test`:** không thể báo "xong" khi đỏ (và đã lộ ra lỗi chạy song song của mutation check).
3. **AGENTS.md mục "Bẫy đã gặp":** mỗi lỗi thành một dòng, giúp phase sau tránh lặp lại (đếm tick, `charms: []`, mảng `expect` đủ độ dài, dầu hao trước khi châm).
4. **Skill `verify-phase`, `scripts/proof.mjs` và agent `contract-reviewer`:** một lệnh sinh toàn bộ bằng chứng, một reviewer không phải người viết code.

## Token và chi phí
- **Ước tính:** khoảng 400–550 lượt gọi công cụ cho 4 phase, output khoảng 450–600 nghìn token; input vài chục triệu token nhưng phần lớn là cache read (ngữ cảnh lặp lại). Subagent: web-fetch đọc slide (khoảng 75 nghìn), web-fetch đọc trang CI (khoảng 18 nghìn), contract-reviewer Phase 3 (khoảng 87 nghìn). **Số chính xác cần lấy từ `/cost` hoặc trang usage** (xem [ai_log.md](ai_log.md)).
- **Đã tiết kiệm bằng cách:**
  - Đọc slide bằng subagent (chỉ bản tóm tắt vào ngữ cảnh).
  - Lưu yêu cầu vào repo (đọc một lần).
  - Sinh scenario bằng script thay vì ghi từng file.
  - Test hộp đen nhanh (khoảng 2 s), nên vòng phản hồi ngắn.
  - Chỉ xem những ảnh cần thiết.
  - Nén ngữ cảnh (`/compact`) giữa các phase.
  - Hỏi CI thưa (40 s mỗi lần) thay vì vòng lặp dày.
  - Phase 4 làm gọn theo yêu cầu: "đủ yêu cầu bài, không quá chi tiết".

## Nếu làm lại thì đổi gì
- **Từ Phase 1, coi luật là "có thể bị thay":** gom số liệu và luật dễ đổi vào bảng (đã làm với `tuning`), viết scenario theo luật chứ không theo số, để Phase 3 ít phải lưu trữ test hơn.
- **Từ đầu, cấm hẳn vá file bằng shell,** chỉ dùng Edit/Write.
- **Mutation check trên bản sao ngay từ Phase 1,** và chạy reviewer cho mọi phase thay vì chỉ trước khi tag.
- **Đo benchmark sớm hơn** (Phase 2) bằng cảnh chuẩn, để thấy giới hạn hiệu năng trước khi thêm hiệu ứng.
