# Scenario chỉ dùng cho kiểm tra giao diện (Phase 3)

Không có `expect.json`. Đêm 1 với cả 5 đèn đã sáng và `time_left_s: 2`: bình minh ở tick 120 thì thắng
`dawn_survived`. `browser-check` dùng nó để kiểm tra luồng "thắng Đêm → Đêm kế tiếp" và ánh sáng môi
trường 0.7 khi mọi đèn sáng (thay cho `p2_r05_win_bonus` đã lỗi thời vì không còn thắng sớm).
