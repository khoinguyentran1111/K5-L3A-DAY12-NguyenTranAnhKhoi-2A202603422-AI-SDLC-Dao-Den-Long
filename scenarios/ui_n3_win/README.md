# Scenario chỉ dùng cho kiểm tra giao diện

Thư mục này **không có `expect.json`**, nên `scripts/scenarios.mjs` không chạy nó như test headless.
Bản 3D phát lại nó (`/?scenario=ui_n3_win&night=3`) để `scripts/browser-check.mjs` thấy màn **Bình Minh**
sau khi thắng Đêm 3 mà không phải chơi hết 3 Đêm.

Phase 3 (Ticket-03): Đêm chỉ thắng lúc bình minh, nên scenario có `time_left_s: 1`. 6 đèn đã sáng; Mây nạp
1 đom đóm vào L7 ở tick 31 (thắp lần đầu); bình minh ở tick 60 với 7/7 đèn sáng (cần 5) thì thắng.
