# Scenario chỉ dùng cho kiểm tra giao diện (Phase 4)

Không có `expect.json`. Đêm 1 nhưng bật gió bằng `wind_enabled`, Bóng Mực sinh ngẫu nhiên, L1 sáng với fuel 30.5 (thành đèn yếu ở tick 31), `time_left_s: 40`.
`browser-check` dùng nó (phát nhanh bằng `&speed=`) để kiểm tra phụ đề và chỉ báo của Ticket-04 §4:
Bóng Mực xuất hiện ở tick 300 (mũi tên ở mép màn hình), đèn sắp cạn dầu, gió sắp nổi (tick 1680), 10 giây cuối (tick 1800).
