# AGENTS.md — Đảo Đèn Lồng

Game 3D (Three.js, chạy trên trình duyệt) gồm 3 Đêm, cùng chế độ headless theo **Test Contract v1.1** (Ticket-02). Node >= 20, ES modules, không có bước build.

## Lệnh
- Cài: `npm install` · Chạy game: `npm start` (http://localhost:5173; thêm `?autostart&night=N` để vào thẳng Đêm N)
- Test (unit + contract + scenario + hook + palette): `npm test`
- Headless: `node src/headless.js --seed 1 --night 1|2|3 --ticks 600 --out out/run.jsonl [--scenario f.json] [--inputs f.json]`
- So scenario với expect: `node scripts/scenarios.mjs` · Test có bắt được lỗi không: `node scripts/mutation-check.mjs`
- Kiểm tra bản 3D: `node scripts/browser-check.mjs` (`BROWSER_GPU=1 REQUIRE_FPS=30` để đo FPS bằng GPU thật)
- Bằng chứng phase N: `npm run proof -- --phase N [--gpu]` (ghi vào `docs/proof/phaseN/`)

## Kiến trúc
- `src/core/sim.js`: TOÀN BỘ luật, thuần (không DOM, không fs, không `Math.random`/`Date`). `step()` chạy đúng **12 bước** của Ticket-02 (`phase2Counters` … `phase11WinLose`); đừng đổi thứ tự.
- `src/core/maps.js`: 3 bản đồ chuẩn (đèn, điểm sinh, bục, tầng, dốc, tháp, `ground(x, z)`). Góc: điểm = (r·cos a, y, r·sin a).
- `src/core/io.js`: validate inputs/scenario/CLI. File sai định dạng thì `FormatError`; scenario sai so với Đêm thì `ScenarioError`; cả hai đều exit 2.
- `src/headless.js`: CLI theo contract (`night_start` ghi ở tick 0). `src/web/`: chỉ hiển thị, input, HUD, âm thanh; màu lấy từ `src/web/palette.js`.
- `game.contract.json`: nguồn duy nhất của số tuning (số chuẩn của Ticket-02); sim đọc trực tiếp từ đây.
- Yêu cầu gốc: `docs/requirements/`. Spec, giả định (A*, B*) và đánh giá: `docs/notes/phaseN.md`.

## Quy tắc
1. Không bịa luật. Chỗ mơ hồ thì ghi giả định vào `docs/notes/phaseN.md` rồi mới viết test.
2. Thay đổi luật phải có scenario `scenarios/pN_*` với `expect.json` **tính tay** (trường `why`). Giá trị phụ thuộc sai số float ở biên thì dùng `{"approx": v, "tol": t}` và ghi lý do. Không chép từ output.
3. Không sửa `expect.json` cũ để cho xanh (hook chặn). Test bị ticket mới thay thì chuyển sang `scenarios/obsolete-*/` kèm bảng lý do, rồi viết scenario mới.
4. Output headless phải tất định: random chỉ lấy từ `g.rng`, theo thứ tự cố định.
5. Phần sáng tạo chỉ ở `src/web/`; không được làm đổi output contract. Scenario chỉ dùng cho UI (không có `expect.json`) đặt ở `scenarios/ui_*`.
6. Không sửa tay `docs/proof/`; muốn cập nhật thì chạy lại `npm run proof`.
7. Không commit `.env` hay khóa API. Không force-push. Không xóa file harness. Không dùng lệnh git làm mất thay đổi (`reset --hard`…).
8. Trước khi báo xong: `npm test` phải xanh (hook Stop). Trước khi tag phase: chạy agent `contract-reviewer`.

## Bẫy đã gặp
- Làm tròn 3 chữ số: 6.0000001 hiện thành 6.0, tức là "trong bán kính". Luôn giữ biên `safeEpsilon` (Phase 1).
- Đếm tick: bộ đếm N đặt ở tick k thì hết ở tick k+N (TTL 480 nghĩa là tồn tại ở tick k…k+479). Lỗi đếm lệch một tick đã gặp cả trong test lẫn trong phép tính tay.
- Scenario phải tắt những gì không liên quan (`charms: []`, `random_*: false`): Bùa Gió nằm trên cầu từng làm sai một test đi qua cầu.
- Bài kiểm tra trình duyệt không được phụ thuộc FPS: chờ theo điều kiện (`waitFor`), không đợi một khoảng thời gian cố định; đặt camera bằng `__ddl.setCamYaw`.
- Windows: Git có thể ghi CRLF (`.gitattributes` ép LF). Heredoc trong bash của tool xử lý `\n` và dấu nháy không ổn định, nên viết script vá bằng file.
- Node 20 in kết quả test theo định dạng TAP (`# fail`), không phải `ℹ fail`: dựa vào mã thoát. Node 20 không có `WebSocket` sẵn có.
