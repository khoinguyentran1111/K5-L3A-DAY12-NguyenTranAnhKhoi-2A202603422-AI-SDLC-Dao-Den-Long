# Nhật ký dùng AI

Công cụ: **Claude Code** (extension VS Code, model Claude Opus 5.5) và một subagent `web-fetch` để đọc slide của giảng viên. Harness: [AGENTS.md](../../AGENTS.md), [CLAUDE.md](../../CLAUDE.md), skills, hooks và agent reviewer trong [.claude/](../../.claude/).

## Phase 1 (PRD-0)

### Cách làm việc với agent
1. Cho agent đọc yêu cầu trước: README/GUIDE/RUBRIC của lab, PRD-0 và Test Contract trên lab board, slide của giảng viên (qua subagent). Chưa cho viết code ngay.
2. Chốt kiến trúc trước khi code: luật game thuần trong `src/core/sim.js`, dùng chung cho headless và web; `tuning` đọc trực tiếp từ `game.contract.json` để không thể khai sai.
3. Viết scenario với kỳ vọng **tính tay** (trường `why`) trước khi chạy, rồi mới đối chiếu với output.
4. Kiểm chứng nhiều lớp: unit test, test hộp đen CLI, scenario, sha256 kiểm tra tất định, mutation check, ảnh chụp replay của bản 3D.
5. Commit nhỏ theo từng bước (docs, core, test, web, proof, harness, notes).

### Lời nhắc chính
- "Cùng đọc yêu cầu bài và yêu cầu ở những slide sau để hoàn thiện bài <link slide>"
- (nội bộ agent) "Fetch slide và tóm tắt mọi yêu cầu: phase, bàn giao, tên file, rubric…" (subagent web-fetch)

### Những lần AI sai và cách phát hiện
| # | AI sai ở đâu | Phát hiện bằng | Sửa / chỉnh harness |
|---|---|---|---|
| 1 | Sim chỉ đẩy Bóng Mực ra khi khoảng cách ≤ 6; ở 6.0000001 thì không đẩy, nhưng output làm tròn thành 6.000, tức là vi phạm theo contract | Scenario `p1_06` có bất biến kiểm tra trên output đã làm tròn | Thêm biên `safeEpsilon = 0.01`; ghi vào mục "Bẫy đã gặp" của AGENTS.md |
| 2 | Bộ test ban đầu không phân biệt `floor` và `ceil` khi đánh rơi đom đóm (mọi test dùng số chẵn) | Mutation check thủ công: lỗi gài sống sót | Thêm test số lẻ; biến mutation check thành script `scripts/mutation-check.mjs` chạy trong CI |
| 3 | Viết 19 file scenario bằng một lệnh bash heredoc dài, lỗi parse khiến không file nào được tạo | Kiểm tra thư mục sau lệnh | Chuyển sang ghi từng file |
| 4 | Agent định "chuẩn hóa line ending" bằng `git reset --hard`, lệnh sẽ xóa thay đổi chưa commit | Bộ phân loại an toàn của Claude Code chặn lại | Dùng cách không phá dữ liệu (`sed` bỏ `\r`) + thêm `.gitattributes`; quy tắc "không lệnh git phá dữ liệu" |
| 5 | Mutation check báo SKIP vì mẫu tìm có `\n` trong khi file đang là CRLF | Output của script | Đổi mẫu không phụ thuộc xuống dòng; ghi bẫy CRLF vào AGENTS.md |
| 6 | Ảnh chụp headless chỉ chạy khoảng 1 s gameplay vì Chrome headless gần như không chạy `requestAnimationFrame` | Xem ảnh: HUD vẫn hiện 4:59 | Thêm `?speed=N` (tua nhanh) cho chế độ replay; luật vẫn chạy qua cùng hàm `step` |
| 8 | Check "bấm R sau khi thắng thì chơi lại" ban đầu viết điều kiện `tick <= 1`, mà scenario thắng ngay ở tick 1, nên check đúng cả khi chưa bấm R (test giả) | Tự đọc lại điều kiện sau khi thấy PASS "quá dễ" | Thêm bộ đếm `gamesStarted` và kiểm tra nó tăng đúng 1; thêm check ngược "phím khác không khởi động lại" |
| 9 | Kiểm tra trình duyệt báo lỗi console: thiếu `favicon.ico` (lỗi thật) và 404 `inputs.json` của scenario không có inputs (hợp lệ theo contract) | `scripts/browser-check.mjs` | Thêm favicon inline; chỉ bỏ qua đúng mẫu 404 của file inputs tùy chọn, ghi rõ lý do trong code |
| 10 | `mutation-check` đọc số test hỏng bằng mẫu `ℹ fail N` (định dạng của Node 24). Trên CI chạy Node 20, khi không có terminal Node in theo định dạng TAP (`# fail N`), nên script tưởng 0 test hỏng và báo mọi lỗi gài đều "sống sót" | CI GitHub Actions đỏ ở bước "Tests catch injected bugs" (Ubuntu) | Quyết định theo mã thoát của `node --test` thay vì đọc chữ; CI xanh ở bước này |
| 11 | `browser-check` dùng `WebSocket` sẵn có, nhưng Node 20 chưa có (Node 22 mới có) | Annotation `::error::` do chính script in ra trên CI (log Actions cần đăng nhập, annotation thì đọc công khai qua API) | CI chạy Node 22 + một job Node 20 cho game/headless; script SKIP rõ ràng (exit 3) khi thiếu WebSocket; thêm `--no-sandbox` trên Linux, không ép SwiftShader trên macOS, check di chuyển chờ theo quãng đường |
| 7 | Số đo hiệu năng ban đầu vô nghĩa: người chơi đứng yên nên thua sau khoảng 500 tick | Đọc `perf.txt` | Đo bằng workload "đêm dài" 18000 tick (lửa rất lớn, chạy vòng, tỏa sáng định kỳ) |

## Phase 2 (Ticket-02 "Ba hòn đảo")

### Cách làm việc với agent
1. Lưu nguyên văn ticket vào `docs/requirements/` (một lần), rồi viết **spec trước khi code**: tiêu chí nghiệm thu S/M/F và 25 giả định B1–B25.
2. Viết lại `sim.js` theo đúng **12 bước** của ticket, mỗi bước là một hàm được đánh số để reviewer đối chiếu được. Bản đồ là dữ liệu trong `maps.js`, dùng chung cho luật và hình vẽ.
3. 28 scenario mới có kỳ vọng tính tay. Scenario Phase 1 bị thay luật thì chuyển sang `obsolete-v1.0` kèm lý do, không sửa âm thầm (hook guard chặn sửa `expect.json`).
4. Bản 3D làm sau cùng; kiểm tra bằng phím thật qua DevTools Protocol; FPS đo bằng GPU thật.

### Những lần AI sai và cách phát hiện (Phase 2)
| # | AI sai ở đâu | Phát hiện bằng | Sửa / chỉnh harness |
|---|---|---|---|
| 12 | Vá `headless.js` bằng heredoc + Python: chuỗi có `\n` không khớp nên bước truyền `night` không được áp dụng, cả 3 Đêm đều chạy thành Đêm 1 | Smoke test 3 Đêm: cùng kết thúc ở tick 17479, `night: 1` trong snapshot | Sửa bằng Edit; ghi bẫy heredoc vào AGENTS.md; contract test kiểm tra `--night` chọn đúng bản đồ |
| 13 | Phép tính tay hồi chiêu lướt ở tick 120: đếm 21 lần giảm thay vì 19 (kỳ vọng 1.15, đúng là 1.183) | Scenario FAIL; đếm lại theo quy tắc "đặt ở tick k thì giảm từ k+1" | Sửa kỳ vọng trước commit đầu tiên; ghi quy tắc đếm vào skill `new-scenario` |
| 14 | Scenario đi qua cầu quên rằng Bùa Gió (35,0,0) nằm trên đường, nên Mây tăng tốc 7.2 m/s | Scenario FAIL (x = 59.2 thay vì 55) | Thêm `charms: []`; bẫy "tắt mọi thứ không liên quan" vào AGENTS.md |
| 15 | Viết lại unit test mà để sót test "vector ngắn không bị chuẩn hóa" của Phase 1 | Mutation check: lỗi gài "chuẩn hóa mọi vector" sống sót | Thêm lại test; mutation check có 20 lỗi gài cho luật v1.1 |
| 16 | Ba test sai thiết kế: TTL lệch 1 tick; test "no_flames thắng all_lit" mâu thuẫn với luật đẩy khỏi vùng an toàn (S7); test hook trỏ tới `p1_01` đã chuyển chỗ | Test đỏ; đọc lại luật thì thấy code đúng | Sửa test, ghi lý do trong code test; không đổi luật để chiều test |
| 17 | Viết sót một test vô nghĩa (khẳng định "vẫn choáng" sau 181 tick) | Tự review file test ngay sau khi viết | Xóa test đó, giữ test đúng (choáng đúng 120 tick) |
| 18 | Code đặt hướng dốc trong `world.js` lộn xộn (gán đè rotation nhiều lần) | Tự review | Viết lại bằng một lệnh `rotation.set` có chú thích |
| 19 | Bài kiểm tra trình duyệt phụ thuộc FPS: dịch chuyển Mây khi lướt chưa xong; xoay camera theo thời gian giữ phím; cấu hình "đèn sau camera" sai hình học | Chạy ở 2 chế độ (phần mềm 6 FPS, GPU 60 FPS) cho kết quả khác nhau; thêm trạng thái vào thông báo lỗi để chẩn đoán | Chờ theo điều kiện; thêm `__ddl.setCamYaw`; chọn cấu hình có biên rõ ràng |
| 20 | Camera bị tháp chuông che khi Mây ở phía bắc tháp | Ảnh chụp bằng chứng `p2_m3_pad_to_tier2.png` toàn màu nâu | Camera tự kéo lại gần khi tháp chắn tầm nhìn |

### Token và chi phí (ước tính)
| Hạng mục | Ước tính |
|---|---|
| Subagent đọc slide (web-fetch) | khoảng 75 nghìn token (số do công cụ báo) |
| Phiên chính Phase 1 | khoảng 70 lượt gọi công cụ; ngữ cảnh lớn nhất khoảng 150 nghìn token; output khoảng 60–80 nghìn token. Phần lớn input là cache read |
| Tổng Phase 1 | **ước tính vài triệu token input (chủ yếu cache) + dưới 100 nghìn token output.** Cần cập nhật số thật từ `/cost` hoặc trang usage của tài khoản |
| Phase 2 | khoảng 120 lượt gọi công cụ, output khoảng 150–200 nghìn token (sim viết lại, 28 scenario, client 3 Đêm, tài liệu); input chủ yếu là cache read. Subagent: 1 lần web-fetch đọc trang Actions (khoảng 18 nghìn token). **Cần cập nhật số thật** |

Cách tiết kiệm ở Phase 2: spec và giả định viết một lần rồi dùng làm "hợp đồng" cho cả code lẫn test; 28 scenario sinh bằng một script (thay vì 70 lần ghi file riêng); chỉ xem các ảnh cần thiết; kiểm tra trạng thái CI qua trang web khi API công khai hết lượt (không chạy vòng lặp hỏi liên tục).

Cách tiết kiệm đã dùng: đọc slide bằng subagent nên chỉ bản tóm tắt vào ngữ cảnh; đọc yêu cầu một lần rồi chép vào `docs/requirements/` để phase sau không phải đọc lại; không chạy agent vòng lặp; test hộp đen nhanh (~2 s) nên vòng phản hồi ngắn; chỉ xem các ảnh cần thiết.
