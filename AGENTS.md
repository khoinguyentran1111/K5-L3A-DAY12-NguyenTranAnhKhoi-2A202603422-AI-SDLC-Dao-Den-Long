# AGENTS.md — Đảo Đèn Lồng

Game 3D (Three.js, chạy trên trình duyệt) + chế độ headless theo Test Contract. Node >= 20, ES modules, không có bước build.

## Lệnh
- Cài: `npm install` · Chạy game: `npm start` (http://localhost:5173)
- Test (unit + contract + scenario): `npm test`
- Headless: `node src/headless.js --seed 1 --night 1 --ticks 600 --out out/run.jsonl [--scenario f.json] [--inputs f.json]`
- So scenario với expect: `node scripts/scenarios.mjs` · Test có bắt được lỗi không: `node scripts/mutation-check.mjs`
- Bằng chứng của phase N: `npm run proof -- --phase N` (ghi vào `docs/proof/phaseN/`)

## Kiến trúc
- `src/core/sim.js`: TOÀN BỘ luật game, thuần (không DOM, không fs, không `Math.random`/`Date`). Headless và web dùng chung.
- `src/core/io.js`: validate inputs/scenario/CLI. File sai định dạng thì ném `FormatError` (exit 2).
- `src/headless.js`: CLI theo contract. `src/web/`: chỉ hiển thị và input, không chứa luật.
- `game.contract.json`: nguồn duy nhất của số tuning; sim đọc trực tiếp từ đây. Muốn đổi số thì đổi ở đây.
- Yêu cầu gốc: `docs/requirements/`. Giả định và đánh giá: `docs/notes/phaseN.md`.

## Quy tắc
1. Không bịa luật. Chỗ mơ hồ thì ghi giả định (A1, A2…) vào `docs/notes/phaseN.md` và viết test theo giả định đó.
2. Thay đổi luật phải đi kèm test hoặc scenario. `expect.json` được TÍNH TAY từ luật (trường `why`), không chép từ output.
3. Không sửa test hay `expect.json` cũ chỉ để thấy xanh (hook sẽ chặn sửa `expect.json`). Test bị ticket mới thay thế thì do người sửa, kèm lý do ghi trong notes.
4. Output headless phải tất định: random chỉ lấy từ `g.rng`; không dùng thời gian thật.
5. Phần sáng tạo chỉ nằm ở `src/web/` hoặc phải tắt khi chạy headless; không được làm đổi output contract.
6. Không sửa tay file trong `docs/proof/`; muốn cập nhật thì chạy lại `npm run proof`.
7. Không commit `.env` hay khóa API. Không force-push. Không xóa file harness.
8. Trước khi báo xong: `npm test` phải xanh (hook Stop sẽ chặn nếu đỏ). Cần review thì dùng agent `contract-reviewer`.

## Bẫy đã gặp
- Output làm tròn 3 chữ số: khoảng cách 6.0000001 hiện thành 6.0, tức là "trong bán kính". Vì vậy luôn giữ biên `safeEpsilon` (lỗi thật ở Phase 1).
- Windows: Git có thể đổi sang CRLF; `.gitattributes` ép LF. Viết mẫu thay thế chuỗi không phụ thuộc `\n`.
