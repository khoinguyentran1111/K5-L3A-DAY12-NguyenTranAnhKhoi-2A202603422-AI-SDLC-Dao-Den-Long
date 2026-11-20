# Scenario Phase 1 đã lỗi thời (Test Contract v1.0)

Các scenario ở đây được viết cho số liệu **tự chọn** của Phase 1. Ticket-02 (Phase 2) yêu cầu
"thay mọi giá trị bạn tự chọn" bằng số chuẩn và đổi một số luật, nên kỳ vọng tính tay của chúng không còn đúng.
Chúng được **giữ lại để truy vết** (không xóa); `scripts/scenarios.mjs` chỉ chạy các thư mục nằm trực tiếp trong `scenarios/`.
Code ở tag `phase-1` vẫn đạt các scenario này (xem `docs/proof/phase1/`).

| Scenario cũ | Luật bị Ticket-02 thay | Thay bằng |
|---|---|---|
| p1_01_collect_and_light | điểm cộng lúc **nhặt** → cộng lúc **nạp**; mang 8 → 10; đèn cần 5 → 10; nhặt 1.2 → 1.0 m; nạp 2.5 → 2.0 m | `p2_r01_collect_deposit_score` |
| p1_02_pulse_stun | tốn 2 → 3; tầm 6 m (XZ) → 5 m (3D); choáng 180 → 120 tick; đẩy tức thì → 4 m trong 15 tick; +20 → +5 | `p2_r02_pulse_stun_push` |
| p1_03_hit_and_lose | Bóng Mực 3.5 → 4.0 m/s; rơi đom đóm ra vòng 3 m → vành 1.5–2.5 m, TTL 480; thêm recoil | `p2_r03_hit_recoil_invuln` |
| p1_04_dawn | không đổi luật, nhưng snapshot v1.1 thêm trường và sự kiện `night_start` | `p2_r04_dawn` |
| p1_05_win_bonus | đèn cần 10; thưởng ×1 → ×2 mỗi giây; điểm nạp | `p2_r05_win_bonus` |
| p1_06_safe_radius | Bóng Mực 4.0 m/s, phát hiện 12 m (vị trí ban đầu phải trong 12 m) | `p2_r06_safe_radius_block` |
| p1_07_camera_yaw_jump | không đổi luật (giữ để hồi quy) | `p2_r07_camera_yaw_jump` |
