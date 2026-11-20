---
name: verify-phase
description: Chạy toàn bộ kiểm chứng của Đảo Đèn Lồng và lưu bằng chứng cho một phase (test, scenario headless, tất định, hiệu năng, mutation, ảnh). Dùng ở cuối mỗi phase, trước khi gắn tag phase-N, hoặc khi người dùng hỏi "đã đúng chưa / có bằng chứng chưa".
---

# Kiểm chứng một phase

1. `npm test`. Phải 0 fail. Nếu đỏ thì sửa code, không sửa kỳ vọng.
2. `node scripts/scenarios.mjs`. Mọi scenario PASS.
3. `npm run proof -- --phase N` (N là phase hiện tại). Lệnh này ghi vào `docs/proof/phaseN/`:
   `test-report.txt`, `scenarios/*.jsonl` + `results.md`, `determinism.txt`, `perf.txt`, `mutation.txt`, `screenshots/`.
   Cần Chrome hoặc Edge để chụp ảnh; nếu không có thì ghi "chưa có ảnh" vào bảng truy vết.
4. Mở `docs/proof/phaseN/scenarios/results.md` và `determinism.txt`, xác nhận PASS / IDENTICAL.
5. Cập nhật bảng truy vết `docs/proof/phaseN.md` (Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả).
   Yêu cầu chưa đạt ghi "Chưa đạt" kèm lý do. Không ghi "đạt" nếu không có file bằng chứng.
6. Cập nhật mục Đánh giá trong `docs/notes/phaseN.md` và token trong `docs/notes/ai_log.md`.
7. Commit (`proof(phaseN): ...`). Người dùng tự gắn tag `phase-N` và push.

Không bao giờ sửa tay file trong `docs/proof/`. Muốn thay đổi thì chạy lại bước 3.
