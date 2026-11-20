# Đảo Đèn Lồng

> **Video demo:** _sẽ được thêm ở Phase 4 (Release `v1.0.0` / `docs/demo/demo.mp4`)._
> Day 12 · AI SDLC Lab, bài cá nhân. Đề bài gốc của lab: [docs/lab/](docs/lab/LAB_README.md)

Game 3D góc nhìn thứ ba chạy trên trình duyệt (Three.js). Bạn điều khiển **Mây**, người giữ đèn nhỏ tuổi đội nón lá, quàng khăn đỏ, treo đèn lồng. Mây gom **đom đóm** để thắp lại các **Đèn Lồng Lớn** trên **ba hòn đảo** trong ba đêm (Đảo Bến, Đảo Cau, Đảo Chuông), né **Bóng Mực** và **Gió Lạc** trong sương đen.

![Đảo Chuông](docs/proof/phase2/screenshots/night3.png)

## Cài đặt và chạy (3 lệnh)

Cần **Node.js ≥ 20** (macOS, Linux hoặc Windows).

```bash
git clone https://github.com/khoinguyentran1111/K5-L3A-DAY12-NguyenTranAnhKhoi-2A202603422-AI-SDLC-Dao-Den-Long.git && cd K5-L3A-DAY12-NguyenTranAnhKhoi-2A202603422-AI-SDLC-Dao-Den-Long
npm install
npm start
```

Trình duyệt tự mở `http://localhost:5173` (nếu không tự mở thì mở tay địa chỉ này). Đổi cổng: `PORT=8080 npm start`. Vào thẳng một Đêm: `http://localhost:5173/?autostart&night=3`.

## Điều khiển

| Phím | Hành động |
|---|---|
| `W A S D` / `↑ ↓` | Đi (theo hướng camera) |
| `Space` | Nhảy |
| `Shift` | Lướt (14 m/s trong 0.2 s, hồi 1.5 s) |
| `E` | Nạp đom đóm vào Đèn Lồng Lớn ở gần |
| `F` / chuột trái | Tỏa Sáng: làm choáng và đẩy lùi Bóng Mực trong 5 m (tốn 3 đom đóm, hồi 3 s) |
| `←` `→` / kéo chuột | Xoay camera (độ nhạy chỉnh trong Cài đặt) |
| `Esc` / `P` | Tạm dừng: Tiếp tục · Chơi lại Đêm · Cài đặt · Về menu |
| `Enter` | Chọn nút chính trên các màn hình |

**Luật chính:** mang tối đa 10 đom đóm; mỗi đèn cần 10, nạp được nhiều lần. Bóng Mực chạm vào thì mất 1 Ngọn Lửa (có 3) và rơi một nửa số đom đóm đang mang. Rơi khỏi đảo cũng mất 1 Ngọn Lửa và toàn bộ đom đóm. Bóng Mực không vào được vòng sáng 6 m quanh đèn đã sáng. Gió Lạc (Đêm 2, 3) cướp đom đóm khi bạn mang từ 5 con trở lên; tỏa sáng để đòi lại. Bùa Gió đỏ giúp chạy 7.2 m/s và lướt liên tục trong 10 giây. Thắp hết đèn trước bình minh (300 / 330 / 360 s) để sang Đêm kế; thắng Đêm 3 thì thấy Bình Minh.

## Cách tính điểm (chuẩn Ticket-02)

| Sự kiện | Điểm |
|---|---|
| Mỗi đom đóm **nạp** vào đèn | +10 |
| Thắp một Đèn Lồng Lớn | +100 |
| Mỗi Bóng Mực trúng Tỏa Sáng (mỗi con, mỗi lần) | +5 |
| Khi thắng một Đêm: mỗi giây còn lại (làm tròn xuống) | +2 |
| Khi thắng một Đêm: mỗi Ngọn Lửa còn lại | +50 |

Tổng điểm của cả chuỗi là tổng điểm các Đêm đã thắng.

## Chế độ headless (Test Contract v1.1)

Khai báo trong [game.contract.json](game.contract.json). Logic chạy 60 tick/giây cố định, không cần cửa sổ hay GPU, tất định theo seed. Một Đêm đầy đủ chạy dưới 0.3 giây.

```bash
node src/headless.js --seed 42 --night 2 --ticks 3600 --out out/run.jsonl
node src/headless.js --seed 1 --night 1 --scenario scenarios/p2_r01_collect_deposit_score/scenario.json \
     --inputs scenarios/p2_r01_collect_deposit_score/inputs.json --ticks 300 --out out/r01.jsonl
```

Mã thoát: `0` thành công · `2` file inputs/scenario thiếu, sai định dạng hoặc không hợp với Đêm (ví dụ đèn `L7` ở Đêm 1) · `1` tham số dòng lệnh sai (kể cả `--night` ngoài 1–3).
Mọi số trong `tuning` là số chuẩn mà game đang dùng (`src/core/sim.js` đọc trực tiếp từ file); không có trường nào là `null`. Giả định cho những chỗ ticket còn mơ hồ nằm ở [docs/notes/phase2.md](docs/notes/phase2.md) (B1–B25).

## Test và kiểm chứng

```bash
npm test                          # 71 test: unit + contract (hộp đen CLI) + 28 scenario + hook + bảng màu
node scripts/scenarios.mjs        # chạy các scenario headless, so với kỳ vọng tính tay
node scripts/mutation-check.mjs   # gài 20 lỗi vào sim, test phải bắt được cả 20
node scripts/browser-check.mjs    # bản 3D trên Chrome/Edge headless: menu → Đêm → kết quả, tạm dừng, cài đặt, HUD
npm run proof -- --phase 2 --gpu  # sinh lại toàn bộ bằng chứng (kèm FPS bằng GPU) vào docs/proof/phase2/
```

Bản 3D có chế độ replay chạy đúng file scenario/inputs của headless, ví dụ `http://localhost:5173/?scenario=p2_m2_jump_pad`.

## Sáng tạo của tôi

Phần thêm chỉ nằm trong `src/web/` (phía hiển thị), không chạm vào `src/core/`, nên **output headless không đổi**:
- **Ông Đăng**, người giữ đèn già: mỗi Đêm mở đầu bằng lời dặn riêng (kèm mẹo cho cơ chế mới của Đêm đó), có lời động viên khi thua và lời chúc ở màn Bình Minh.
- **Đom đóm bay quanh Mây:** số đom đóm đang mang hiện thành những đốm sáng bay vòng quanh Mây.
- **Âm thanh tự sinh bằng WebAudio:** nhạc nền đêm (hợp âm nền và chuông ngũ cung ngẫu nhiên); nốt nhặt đom đóm cao dần theo số đang mang; chuông thắp đèn; tiếng gió báo trước cơn gió. Không dùng file âm thanh nào.
- **Camera tránh tháp chuông:** camera tự kéo lại gần khi tháp che mất Mây.
- Gợi ý theo ngữ cảnh, chấm tiến độ nạp quanh chân mỗi đèn, đom đóm rơi nhấp nháy khi sắp tan.

Bằng chứng phần lõi vẫn đúng: toàn bộ test, scenario và kiểm tra tất định đều chạy trên `src/core` ([docs/proof/phase2.md](docs/proof/phase2.md)); `src/core` không import gì từ `src/web`.

## Tài liệu

| | |
|---|---|
| Yêu cầu gốc từng phase | [docs/requirements/](docs/requirements/) |
| Spec, giả định, đánh giá | [Phase 1](docs/notes/phase1.md) · [Phase 2](docs/notes/phase2.md) |
| Bảng truy vết bằng chứng | [Phase 1](docs/proof/phase1.md) · [Phase 2](docs/proof/phase2.md) |
| Nhật ký dùng AI và token | [docs/notes/ai_log.md](docs/notes/ai_log.md) |
| Harness AI | [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md), [.claude/](.claude/) (skills, hooks, agent reviewer), [CI](.github/workflows/ci.yml) |
| Nguồn và giấy phép | [CREDITS.md](CREDITS.md), [LICENSE](LICENSE) |

## Cấu trúc

```text
src/core/        luật thuần + tất định: sim.js (12 bước/tick), maps.js (3 bản đồ), io.js, rng.js
src/headless.js  CLI theo Test Contract v1.1
src/web/         client Three.js: main.js (chuỗi Đêm, HUD), world.js, palette.js, audio.js, settings.js
scenarios/       p2_* (đang dùng) · obsolete-v1.0/ (Phase 1, có lý do) · ui_* (chỉ cho kiểm tra giao diện)
tests/           node:test: unit, contract, scenario, hook, bảng màu
scripts/         serve, scenarios, proof, mutation-check, browser-check, hooks/
docs/            requirements/, notes/, proof/, lab/
```
