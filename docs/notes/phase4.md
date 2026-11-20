# Phase 4: spec, giả định và đánh giá (Ticket-04 "Bình minh: phát hành v1.0.0", Contract v1.3)

Yêu cầu gốc: [docs/requirements/phase4-Ticket-04.md](../requirements/phase4-Ticket-04.md). Bằng chứng: [docs/proof/phase4.md](../proof/phase4.md).

## Giả định

| Mã | Giả định | Lý do |
|---|---|---|
| E1 | Cảnh bench: Bóng Mực rải đều theo diện tích trên đĩa đảo Đêm 1 (r ≤ 40), không đặt trong vùng an toàn 6 m của L1–L3; 100 đom đóm rải đều trên cả đảo; dùng `mulberry32(42)` của sim | "Rải đều trên đảo (seed 42)"; Bóng Mực không được ở trong vùng an toàn |
| E2 | Soak: Đêm thứ i (i = 0…N−1) dùng seed `7 + i`, input lấy từ một luồng RNG riêng (`seed XOR hằng số`) để không làm lệch chuỗi ngẫu nhiên của thế giới | Ticket ghi "Đêm thứ i dùng seed 7 + i" |
| E3 | Soak tự chạy lại chính nó một lần với `--expose-gc --max-semi-space-size=1 --no-opt`; mọi Đêm vẫn chạy trong một tiến trình. Không cờ thì RSS vẫn phẳng (~48 MB qua 30 Đêm) | RSS đầu đo ngay sau khi tải Đêm 1; phần V8 biên dịch JIT và nới heap một lần không phải rò rỉ (số liệu trong README) |
| E4 | Camera bench ở (30·cos a, 15, −30·sin a), a = 2π·t/15, t tính từ khung đầu tiên (gồm cả 3 s khởi động) | Ngược chiều kim đồng hồ nhìn từ trên (+Y) = quay dương quanh +Y |
| E5 | `frame_ms_p95` dùng phân vị theo hạng gần nhất: phần tử thứ ceil(0.95·N) sau khi sắp tăng dần | Ticket không nêu cách nội suy |
| E6 | `peak_mem_mb` = tổng RSS đỉnh của mọi tiến trình trình duyệt của lần chạy (Windows PeakWorkingSetSize, Linux VmHWM), đọc một lần sau khi đo xong | Game web chạy trong nhiều tiến trình của trình duyệt; đọc một lần để không làm nhiễu FPS |
| E7 | Tên trên bảng xếp hạng: 3–12 ký tự chữ (mọi chữ Unicode sau khi chuẩn hóa NFC, gồm tiếng Việt có dấu), số hoặc `_` | Bắt buộc [A-Za-z0-9_], tiếng Việt là điểm cộng |
| E8 | Một chuỗi 3 Đêm có một seed (lưu lên bảng xếp hạng); Đêm n chơi seed + n − 1. `achieved_at` là giờ máy kèm độ lệch múi giờ | Ticket yêu cầu lưu `seed` |
| E9 | `Enter` (chọn trên màn hình) và `←`/`→` (xoay camera) là phím dành riêng, không gán cho hành động được | Tránh xung đột với menu và camera |
| E10 | Bản web tĩnh (không có server) lưu bảng xếp hạng trong bộ nhớ của trình duyệt (vẫn nằm trên đĩa máy người chơi) | Web tĩnh không ghi được file |

## Đánh giá Phase 4
- **Đạt (có bằng chứng):**
  - Benchmark: 148.6 FPS trung bình, 1% low 52, load 1.3 s trên GPU Intel tích hợp. Ngưỡng chấm là máy của giảng viên.
  - Soak: 0 crash, RSS 39.7 → 43.1 MB.
  - Bảng xếp hạng: lưu đĩa, top 10, sắp xếp đúng, có lệnh xuất.
  - Dễ tiếp cận: đổi phím, phụ đề và chỉ báo, giảm chuyển động, chữ ≥ 18 px, chữ lớn ×1.25.
  - Contract v1.3; gói phát hành chạy được không cần `npm install`.

  Chi tiết trong [bảng truy vết](../proof/phase4.md).
- **Hồi quy:** toàn bộ test và scenario của Phase 1–3 vẫn chạy và vẫn đạt. Thay đổi chỉ nằm ở client, server và script; luật trong `src/core/sim.js` không đổi, ngoại trừ chế độ bench (mặc định tắt).
- **Rủi ro:**
  - Kết quả bench phụ thuộc trình duyệt và GPU của máy chấm.
  - Cờ V8 của soak (E3).
  - `run_cmd` đổi thành `node scripts/serve.mjs`, vì `npm start --export-leaderboard` bị npm hiểu là cờ của npm.
