# Phase 1: PRD-0 + Test Contract v1.0 (bản chép để agent tham chiếu)

> Nguồn: tab Phase 1 trên lab board Đảo Đèn Lồng (Day 12). Chép lại để agent dẫn nguyên văn, không phải đoán.
> Khi có khác biệt, bản trên lab board và lời giảng viên là cuối cùng.

## PRD-0 (tóm tắt sát nguyên văn)

**Chúng tôi muốn gì.** Game 3D tên Đảo Đèn Lồng. Người chơi điều khiển Mây, người giữ đèn nhỏ tuổi của một hòn đảo giữa biển mây. Sương đen đã nuốt hết ánh sáng của đảo. Mây chạy khắp đảo thu thập đom đóm rồi mang về thắp lại các Đèn Lồng Lớn. Bóng Mực sống trong sương, đuổi theo Mây; bị chạm thì mất máu. Mây có thể tỏa sáng để xua chúng đi, nhưng việc đó tốn ánh sáng. Bóng Mực sợ những chiếc đèn. Thắp hết đèn thì thắng. Mất hết máu thì thua. Có điểm số.

**Phạm vi Phase 1.**
- Một màn chơi: Đêm 1 – Đảo Bến, một hòn đảo tròn có 5 Đèn Lồng Lớn.
- Nhân vật đi lại, nhảy, camera 3D.
- Đom đóm xuất hiện rải rác trên đảo, nhặt được.
- Nạp ánh sáng vào đèn để thắp đèn.
- Bóng Mực xuất hiện và đuổi người chơi.
- Tỏa sáng để xua Bóng Mực.
- Thắng, thua, điểm số, HUD.
- Có thể chơi lại sau khi thắng hoặc thua.

**Cảm giác và phong cách.** Không khí đêm, ấm áp, cổ tích. Đảo sáng dần lên khi thắp đèn. Ánh sáng vàng cam ấm là thứ tốt, màu tím đen là nguy hiểm. Đồ họa đơn giản nhưng đẹp. Mây đội nón lá có treo một chiếc đèn lồng nhỏ. Không bạo lực, không máu me.

**Tự do sáng tạo.** Được thêm nhân vật, kẻ địch, cơ chế, hiệu ứng, âm thanh… nhưng không phá PRD-0 và Test Contract; phần thêm không được làm đổi output headless. Ghi mục "Sáng tạo của tôi" trong README, kèm bằng chứng phần cũ vẫn đúng.

**Công nghệ.** Tự chọn. Phải chạy được trên macOS hoặc Linux.

**Bàn giao Phase 1** (tag `phase-1`, repo public): game chơi được Đêm 1 từ đầu tới thắng hoặc thua; README (cài và chạy tối đa 3 lệnh, điều khiển, cách tính điểm); `game.contract.json` + headless theo Test Contract v1.0; bằng chứng + ghi chép (giả định, nhật ký AI); harness AI.

## Test Contract v1.0 (bắt buộc, chính xác)

**A. `game.contract.json` ở gốc repo:** `contract_version` "1.0", `team`, `build_cmd`, `run_cmd`, `headless_cmd`, `tuning` gồm: player_speed, carry_capacity, lantern_cost, lantern_count_night1 (= 5), pickup_radius, interact_radius, pulse_cost, pulse_radius, night1_duration_s, flames, invuln_s, hit_drop_ratio, pulse_stun_s, pulse_push_m, pulse_cooldown_s, safe_radius, shade_speed, shade_hit_radius, fall_enabled, score {per_mote, per_lantern, per_stun, per_second_left, per_flame_left}.
Phải điền đúng số game đang dùng (test Phase 1 sinh tình huống từ các số này). Không có khái niệm thì điền null hoặc false và giải thích trong README. `hit_drop_ratio` là tỉ lệ đom đóm đánh rơi khi bị chạm; `safe_radius` là bán kính quanh đèn mà Bóng Mực không vào được; `fall_enabled` cho biết rơi khỏi đảo có bị phạt không.

**B. CLI:** `<headless_cmd> --seed <int> --night 1 [--scenario f] [--inputs f] --ticks <int> --out <file.jsonl> [--snapshot-every <int, mặc định 10>]`
- 60 tick/giây cố định, không cửa sổ, không GPU. Dừng khi đủ `--ticks` hoặc khi thắng hay thua; thoát với mã 0.
- Lỗi thì mã khác 0 và in ra stderr. File inputs hoặc scenario sai định dạng thì **mã 2**.
- Mét; trục Y hướng lên; mặt đất Y = 0; người chơi xuất phát ở (0,0,0).
- Mô hình tick: snapshot tick 0 là trạng thái sau khi dựng scenario, trước khi áp input. Bước k (k = 0..N−1) đọc input của tick k và tạo trạng thái k+1; sự kiện trong bước đó ghi `tick = k+1`. `time_left_s = thời lượng Đêm − số bước / 60`.
- Vị trí: `player.pos` là chân, `shade.pos` là tâm, `lantern.pos` là chân cột, đom đóm là điểm trên mặt đất. Khoảng cách đo trên mặt phẳng XZ; "trong bán kính r" nghĩa là ≤ r.

**C. Inputs:** `frames[]` gồm `tick` (tăng nghiêm ngặt), `move` [x,z] mỗi thành phần trong [−1,1] (độ dài > 1 thì chuẩn hóa), `cam_yaw_deg`, các nút `jump`/`interact`/`pulse`/(`dash`) kích hoạt khi chuyển false→true. Mặc định: move [0,0], yaw 0, mọi nút false. Trường vắng mặt giữ giá trị cũ. Hướng trong thế giới: x' = x·cosθ + z·sinθ, z' = −x·sinθ + z·cosθ. Không có file inputs nghĩa là đứng yên.

**D. Scenario:** `player {pos, carried, flames}`, `random_motes`, `random_shades` (false thì không tự sinh), `motes` [[x,y,z]…] và `shades` [{id?, pos}] thay thế danh sách ban đầu (mảng rỗng là không có), `lanterns` cập nhật theo id L1..L5 (pos, deposited, lit), `time_left_s`. Trường vắng mặt dùng mặc định. Dựng scenario không phát sự kiện và không cộng điểm.

**E. Output JSONL:** `snapshot` (mỗi `--snapshot-every` tick, từ tick 0: tick, sim_tick, state, time_left_s, score, player{pos,flames,carried}, lanterns[{id,pos,lit,deposited}], shades[{id,pos,state}], motes_active; khuyến nghị thêm motes[{id,pos}]); `event` (`mote_picked{carried}`, `deposit{lantern_id,amount,deposited}`, `lantern_lit{lantern_id}`, `pulse{stunned_ids}`, `player_hit{by,flames,dropped}`, `shade_spawned{id}`, `game_over{result,reason: all_lit|dawn|no_flames}`); dòng cuối bắt buộc `{"type":"end","ticks","state","score"}`. state ∈ playing/won/lost; trạng thái Bóng Mực tối thiểu có `stunned`. Tọa độ làm tròn 3 chữ số. Tất định: cùng seed, scenario và inputs thì output giống hệt, kể cả id tự sinh. Sự kiện không có trong game thì không ghi.
