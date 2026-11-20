# Đảo Đèn Lồng v1.0.0

Game 3D (Three.js) ba hòn đảo, ba đêm: gom đom đóm, thắp và giữ dầu cho các Đèn Lồng Lớn tới bình minh.

## Tải và chạy
1. Tải `dao-den-long-v1.0.0.zip` ở mục **Assets** bên dưới, rồi giải nén.
2. Cài **Node.js ≥ 20** (https://nodejs.org). Không cần `npm install`, vì three.js đã có sẵn trong gói.
3. Trong thư mục vừa giải nén, chạy `node scripts/serve.mjs`. Trình duyệt sẽ tự mở http://localhost:5173.

Chạy từ mã nguồn thì dùng 3 lệnh: `git clone …`, `npm install`, `npm start`.

Thư mục `web/` trong gói là bản web tĩnh, chạy trên mọi web server tĩnh. Ở chế độ này bảng xếp hạng lưu trong trình duyệt.

## Có gì trong v1.0.0
- **Ba Đêm:** Đảo Bến, Đảo Cau, Đảo Chuông. Đèn có dầu và có thể tắt; Bóng Mực hút dầu; chỉ thắng nếu đủ đèn còn sáng lúc bình minh.
- **Dễ tiếp cận:** đổi phím (có báo trùng phím), phụ đề và chỉ báo, giảm chuyển động, chữ lớn, bảng màu dễ phân biệt.
- **Bảng xếp hạng cục bộ:** top 10, lưu trong `data/leaderboard.json`. Xuất ra file: `node scripts/serve.mjs --export-leaderboard out.json`.
- **Headless theo Test Contract v1.3:** `node src/headless.js …`
- **Benchmark và soak:**
  - Lệnh chạy: `node scripts/bench.mjs --seed 42 --duration 30 --out bench.json` và `node scripts/soak.mjs --seed 7 --nights 10 --out soak.json`.
  - Kết quả bench trên máy làm bài: 148.6 FPS trung bình, 1% low 52 FPS, load 1.3 s (GPU Intel UHD).
  - Soak: 10 Đêm, không crash, RSS +9 %.

Lịch sử thay đổi: [CHANGELOG.md](https://github.com/khoinguyentran1111/K5-L3A-DAY12-NguyenTranAnhKhoi-2A202603422-AI-SDLC-Dao-Den-Long/blob/main/CHANGELOG.md). Video demo: `demo.mp4` trong mục Assets.
