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

## Phase 3 (Ticket-03 "Đèn cạn dầu")

### Cách làm việc với agent
1. Lưu nguyên văn Ticket-03 và Ticket-04 vào `docs/requirements/` ngay khi nhận (một lần cho cả hai phase cuối).
2. Chạy bộ scenario Phase 2 trên luật mới **trước** khi viết test mới để biết chính xác test nào bị thay: 6/28 đỏ, cả 6 đều do luật [THAY THẾ]; chuyển sang `obsolete-v1.1/` kèm bảng lý do.
3. Viết luật theo đúng "bước 2 / ngay sau bước 2 / xét thắng sau cùng" của ticket; dầu là số nguyên 1/60 nên mọi biên (≤ 0, < 30, = 100) tính tay được chính xác.
4. Mỗi luật mới có scenario tính tay (22 `p3_*`) và một lỗi gài trong mutation check (thêm 18).
5. Ghi quyết định thiết kế (ADR 0001) và breaking changes (CHANGELOG) trước khi gắn tag.

### Những lần AI sai và cách phát hiện (Phase 3)
| # | AI sai ở đâu | Phát hiện bằng | Sửa / chỉnh harness |
|---|---|---|---|
| 21 | 6 scenario mới viết `lanterns` chỉ 1–2 phần tử, trong khi trình so khớp đòi mảng đủ độ dài (giá trị thật đều khớp số tính tay) | `scripts/scenarios.mjs` báo "expected array of length 1" | Bộ sinh scenario tự thêm `{}` cho đủ 5/6/7 đèn (scenario chưa commit nên sinh lại); ghi quy tắc vào AGENTS.md và skill `new-scenario` |
| 22 | Kỳ vọng tự tính của test sự kiện v1.2 sai: quên rằng bước 2 hao dầu trước bước 5 (`ceil(3001/600) = 6`, không phải 5) và lần bấm thứ hai lại chọn đúng đèn cũ | Tự kiểm lại phép tính trước khi chạy | Viết lại test (đổi fuel, cho Mây đi sang đèn khác); ghi bẫy "hao trước khi châm" vào AGENTS.md |
| 23 | Sau khi lưu trữ `p2_r01`, không còn test nào giữ biên bán kính nhặt 1.0 m (scenario mới bỏ sót sự kiện tick 11) | Mutation check: "pickup radius is strict <" sống sót (37/38) | Thêm unit test biên 1.0 / 1.001 m; ghi "kiểm tra lại mutation khi lưu trữ scenario" vào AGENTS.md |
| 24 | Edit đầu file `sim.test.mjs` làm mất 2 dòng import (`test`, `assert`) | `npm test`: ReferenceError | Thêm lại import; chạy test ngay sau mỗi lần sửa file test |
| 25 | Bốn lần vá file bằng heredoc trong bash lại hỏng (`\n` thành xuống dòng thật, mất `\` trong regex, lỗi "unexpected EOF") dù bẫy đã có trong AGENTS.md | Lỗi cú pháp khi chạy, test regex sai | Chuyển hẳn sang Write/Edit cho mọi bản vá có ký tự đặc biệt |
| 26 | Ẩn nhắc "E — Nạp ánh sáng" khi không mang đom đóm, làm hỏng hành vi cũ | `browser-check` (check của Phase 2) | Bỏ điều kiện; người chơi vẫn cần biết đèn còn thiếu bao nhiêu |
| 27 | Check "bấm E châm dầu" chạy trong chế độ replay, mà replay bỏ qua bàn phím | `browser-check` FAIL | Thêm `?scenario=X&live` (dựng scenario, điều khiển bằng phím thật) |
| 29 | Mutation check gài lỗi trực tiếp vào `src/core/sim.js` của thư mục làm việc; hook `Stop` chạy `npm test` đúng lúc đó nên báo đỏ giả (lỗi gài, không phải code thật) | Hook Stop chặn kết thúc 2 lần, mỗi lần đúng các test của lỗi gài đang chạy; `git diff` cho thấy sim.js đang khác HEAD | `mutation-check.mjs` giờ gài lỗi trên một bản sao tạm của project, thư mục làm việc không bao giờ bị sửa |
| 30 | Hai nhánh của `drain` chưa có test ghim: rời drain khi cách đèn > 2 m, và biên đúng 6 m của drain → chase (scenario né biên); tham chiếu giả định trong code ghi sai (C24, C18) | Agent `contract-reviewer` (không phải agent viết code) trước khi tag | Thêm unit test biên 2 m / 6 m / 6.01 m và 2 lỗi gài (40/40 bị bắt); sửa chú thích; ghi rõ "đứng chờ" của C8 trong CHANGELOG |
| 28 | `git mv` 6 scenario đã stage từ trước nên lọt vào commit tài liệu thay vì commit lõi | Đọc lại `git show --stat` | Không viết lại lịch sử (đã đúng nội dung); từ nay `git status` trước mỗi commit |

## Phase 4 (Ticket-04 "Bình minh")

Làm gọn theo yêu cầu của người dùng giữa phase ("không cần quá chi tiết, chỉ cần đáp ứng yêu cầu bài").

| # | AI sai ở đâu | Phát hiện bằng | Sửa |
|---|---|---|---|
| 31 | Soak báo RSS 38 → 50 MB (> 1.2×) và AI suýt kết luận là rò rỉ | Ghi RSS sau mỗi Đêm: phẳng ~48 MB qua 30 Đêm, phần tăng chỉ xảy ra trong Đêm đầu (JIT + heap người trẻ) | Cờ V8 cho soak (ghi rõ trong README, `soak.json.v8_flags`), không giấu số không cờ |
| 32 | `peak_mem_mb = 1`: bộ lọc PowerShell khớp chính nó; sau đó đọc `PeakWorkingSetSize` như byte trong khi đơn vị là KB | Giá trị vô lý trong `bench.json`; in bảng tiến trình để gỡ lỗi | Loại `powershell.exe`; đổi đơn vị |
| 33 | Check giao diện chạy ở viewport 1262×624 (headless có khung cửa sổ), và scenario "trúng đòn + tỏa sáng" không còn đủ 3 đom đóm sau khi bị đánh rơi | `browser-check` FAIL kèm chi tiết | Ép viewport 1280×720 bằng DevTools; tăng số mang trong scenario |
| 34 | HUD vẽ 99 biểu tượng lửa với scenario thử nghiệm; màn Cài đặt bị cắt | Xem ảnh chụp | Tối đa 5 biểu tượng + "+N"; thu gọn hàng |

### Token và chi phí (ước tính)
| Hạng mục | Ước tính |
|---|---|
| Subagent đọc slide (web-fetch) | khoảng 75 nghìn token (số do công cụ báo) |
| Phiên chính Phase 1 | khoảng 70 lượt gọi công cụ; ngữ cảnh lớn nhất khoảng 150 nghìn token; output khoảng 60–80 nghìn token. Phần lớn input là cache read |
| Tổng Phase 1 | **ước tính vài triệu token input (chủ yếu cache) + dưới 100 nghìn token output.** Cần cập nhật số thật từ `/cost` hoặc trang usage của tài khoản |
| Phase 2 | khoảng 120 lượt gọi công cụ, output khoảng 150–200 nghìn token (sim viết lại, 28 scenario, client 3 Đêm, tài liệu); input chủ yếu là cache read. Subagent: 1 lần web-fetch đọc trang Actions (khoảng 18 nghìn token). **Cần cập nhật số thật** |
| Phase 4 | khoảng 60 lượt gọi công cụ, output khoảng 70–90 nghìn token (bench, soak, bảng xếp hạng, dễ tiếp cận, gói phát hành, tài liệu). **Cần cập nhật số thật** |
| Phase 3 | khoảng 90 lượt gọi công cụ, output khoảng 100–130 nghìn token (luật dầu, 22 scenario, test, client, ADR/CHANGELOG); một lần nén ngữ cảnh (`/compact`) trước khi bắt đầu. Subagent: `contract-reviewer` trước khi tag. **Cần cập nhật số thật** |

Cách tiết kiệm ở Phase 2: spec và giả định viết một lần rồi dùng làm "hợp đồng" cho cả code lẫn test; 28 scenario sinh bằng một script (thay vì 70 lần ghi file riêng); chỉ xem các ảnh cần thiết; kiểm tra trạng thái CI qua trang web khi API công khai hết lượt (không chạy vòng lặp hỏi liên tục).

Cách tiết kiệm đã dùng: đọc slide bằng subagent nên chỉ bản tóm tắt vào ngữ cảnh; đọc yêu cầu một lần rồi chép vào `docs/requirements/` để phase sau không phải đọc lại; không chạy agent vòng lặp; test hộp đen nhanh (~2 s) nên vòng phản hồi ngắn; chỉ xem các ảnh cần thiết.
