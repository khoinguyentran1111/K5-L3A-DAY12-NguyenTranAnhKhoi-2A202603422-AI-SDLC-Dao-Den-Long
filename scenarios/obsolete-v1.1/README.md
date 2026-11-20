# Scenario Phase 2 đã lỗi thời (Test Contract v1.1)

Ticket-03 (Phase 3, Contract v1.2) **thay** một số luật của Ticket-02: thời lượng Đêm, công thức điểm và luật thắng.
Kỳ vọng tính tay của các scenario dưới đây dựa trên luật cũ nên không còn đúng. Chúng được **giữ lại để truy vết** (không xóa, không sửa `expect.json`, không skip âm thầm).
`scripts/scenarios.mjs` chỉ chạy các thư mục nằm trực tiếp trong `scenarios/`. Code ở tag `phase-2` vẫn đạt các scenario này (xem `docs/proof/phase2/`).

22 scenario `p2_*` còn lại không bị luật mới chạm tới và **vẫn chạy, vẫn đạt** trên code Phase 3.

| Scenario cũ | Kết quả trên luật mới | Luật bị Ticket-03 thay | Thay bằng |
|---|---|---|---|
| p2_f05_pause | `time_left_s` 239.5 thay vì 299.5 | Đêm 1: 300 s → **240 s** (§3) | `p3_f05_pause` (cùng input, thời gian mới) |
| p2_f06_safe_zone_evict | điểm 105 thay vì 110 | +10 → **+5** mỗi đom đóm nạp (§5) | `p3_f06_safe_zone_evict` (cùng input, điểm mới) |
| p2_m2_defaults | `time_left_s` 270 thay vì 330 | Đêm 2: 330 s → **270 s** (§3) | `p3_m2_defaults` |
| p2_m3_defaults | `time_left_s` 300 thay vì 360 | Đêm 3: 360 s → **300 s** (§3) | `p3_m3_defaults` |
| p2_r01_collect_deposit_score | điểm 150 thay vì 200 | +10 → **+5** mỗi đom đóm nạp (§5) | `p3_r01_collect_deposit_score` (cùng input, thêm `fuel`, `capacity`) |
| p2_r05_win_bonus | không thắng ở tick 1 | Bỏ "thắng ngay khi thắp hết" và bỏ thưởng thời gian (§3, §5) | `p3_11_no_early_win` (thắp hết vẫn chơi tiếp) + `p3_08`/`p3_10` (thưởng bình minh mới) |
