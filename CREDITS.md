# Credits

## Nội dung game
- Nhân vật, bối cảnh và tên gọi (Mây, Đảo Đèn Lồng, Bóng Mực, Đèn Lồng Lớn) là bản gốc của lab Day 12 AI SDLC.
- **Không dùng asset bên ngoài.** Mọi hình 3D được dựng bằng các khối hình học của Three.js trong code (`src/web/main.js`).
- **Âm thanh** được tạo bằng WebAudio ngay khi chạy (`src/web/audio.js`), không dùng file âm thanh nào.

## Thư viện
| Thư viện | Phiên bản | Giấy phép | Dùng cho |
|---|---|---|---|
| [three.js](https://threejs.org) | 0.160.0 | MIT | Hiển thị 3D trong trình duyệt |

Phần còn lại (mô phỏng, headless, test, script) chỉ dùng thư viện chuẩn của Node.js.

## Công cụ AI
- Mã nguồn, test, tài liệu và cấu hình harness được viết cùng **Claude Code (Anthropic, model Claude Opus 5.5)** dưới sự điều phối, review và kiểm chứng của tác giả. Chi tiết: [docs/notes/ai_log.md](docs/notes/ai_log.md).
- Không dùng AI để tạo hình ảnh hay âm thanh.
