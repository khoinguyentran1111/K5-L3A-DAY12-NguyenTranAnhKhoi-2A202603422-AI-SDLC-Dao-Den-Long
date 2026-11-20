---
name: verify-phase
description: Chạy toàn bộ kiểm chứng của Đảo Đèn Lồng và lưu bằng chứng cho một phase (test, scenario headless cả 3 Đêm, tất định, hiệu năng 21.600 tick, mutation, kiểm tra trình duyệt, FPS bằng GPU, ảnh). Dùng ở cuối mỗi phase, trước khi gắn tag phase-N, hoặc khi người dùng hỏi "đã đúng chưa / có bằng chứng chưa".
---

# Kiểm chứng một phase

1. `npm test`: phải 0 fail. Nếu đỏ thì sửa code; nếu chính test sai (tính tay sai, thiết kế sai) thì ghi lại lý do vào `docs/notes/ai_log.md`.
2. `node scripts/scenarios.mjs`: mọi scenario PASS. Scenario trong `obsolete-*` và `ui_*` không được chạy, đó là chủ đích.
3. `node scripts/mutation-check.mjs`: mọi lỗi gài phải bị bắt. Lỗi nào sống sót thì viết thêm test.
4. `npm run proof -- --phase N --gpu`. Lệnh này ghi vào `docs/proof/phaseN/`: `test-report.txt`, `scenarios/*.jsonl` + `results.md`,
   `determinism.txt` (cả 3 Đêm), `perf.txt` (≤ 30 s/Đêm), `mutation.txt`, `browser-check.txt`, `fps.txt` (≥ 30), `screenshots/`.
   Cần Chrome hoặc Edge; `--gpu` cần GPU thật. Không có thì ghi "chưa có" vào bảng truy vết.
5. Đọc `results.md`, `determinism.txt`, `perf.txt`, `browser-check.txt`, `fps.txt`; xác nhận PASS / IDENTICAL / ALL PASS.
6. Cập nhật bảng truy vết `docs/proof/phaseN.md` (Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả) cho mọi mục của ticket.
   Mục chưa đạt ghi "Chưa đạt" kèm lý do. Không ghi "đạt" nếu không có file bằng chứng.
7. Cập nhật mục Đánh giá trong `docs/notes/phaseN.md` (kể cả hồi quy phase trước) và token trong `docs/notes/ai_log.md`.
8. Nhờ agent `contract-reviewer` review diff từ tag phase trước; sửa các phát hiện nghiêm trọng.
9. Commit (`proof(phaseN): ...`), gắn tag `phase-N`, push (người dùng xác nhận).

Không bao giờ sửa tay file trong `docs/proof/`. Muốn thay đổi thì chạy lại bước 4.
