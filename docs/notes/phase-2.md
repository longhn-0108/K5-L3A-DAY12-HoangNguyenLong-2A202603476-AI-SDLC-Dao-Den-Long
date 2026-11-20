# Spec & Ghi chép Phase 2 — TICKET-02 ("Ba hòn đảo", Contract v1.1)

## 1. Thay đổi so với Phase 1 & Lý do cập nhật test cũ
TICKET-02 chuẩn hóa toàn bộ thông số gameplay và mở rộng sang 3 Đêm + Contract v1.1:
- **Thông số đổi:** `player_speed` `7 → 6`, `lantern_cost` `5 → 10`, `pickup_radius` `1.8 → 1`, `interact_radius` `3 → 2`, `pulse_cost` `2 → 3`, `pulse_radius` `7 → 5`, `pulse_stun_s` `3 → 2`, `pulse_push_m` `6 → 4`, `pulse_cooldown_s` `4 → 3`, `invuln_s` `2 → 1.5`, `shade_speed` `2.8 → 4` (Đêm 3: `4.5`), `fall_enabled` `false → true`, `night1_duration_s` `240 → 300`.
- **Điểm số đổi:** `+10` chuyển sang cộng khi **nạp** đom đóm vào đèn (thay vì lúc nhặt), `per_stun` `25 → 5`.
- **Test cũ đã cập nhật kèm lý do:** Các unit test trong `tests/sim.test.js` và `tests/headless.test.js` được cập nhật kỳ vọng số liệu theo bảng chuẩn Phần 1 của TICKET-02, đồng thời bổ sung thêm test cho mọi tính năng mới (Dash, Fall, Drifters, Charms, Jump Pads, Night 3 Wind, Pause/Resume).

## 2. Tiêu chí nghiệm thu (Acceptance Criteria) cho từng mục Phần 3

| Tính năng (Phần 3) | Tiêu chí nghiệm thu kiểm chứng được |
|---|---|
| **AC-2.1 Lướt (Dash)** | Nhấn `Shift` (rising edge) lướt `14 m/s` trong `12 tick` (`0.2s`), giữ nguyên độ cao khi ở trên không, hồi chiêu `90 tick` (`1.5s`), phát sự kiện `dash {}`. |
| **AC-2.2 Rơi khỏi đảo** | Khi `Y < -10`: trừ `1` Ngọn Lửa (bỏ qua bất tử), mất toàn bộ đom đóm (`player_hit {by:"fall", lost}`), chờ `60 tick` rồi hồi sinh tại `(0,0,0)` với bất tử `90 tick` (nếu hết lửa thì thua ngay `no_flames`). |
| **AC-2.3 Đêm 2 — Đảo Cau** | 2 đảo `R=28m` tại `(0,0,0)` và `(70,0,0)`, cầu tre `x∈[26,44], z∈[-2,2]`, 2 bục nhảy `(20,0,18)` & `(50,0,-18)` phóng Mây đáp gọn trong đảo đích, 6 đèn `L1–L6`. |
| **AC-2.4 Đêm 3 — Đảo Chuông & Gió mạnh** | Đảo 3 tầng (`Y=0, 3, 6`), 2 dốc `30°`/`150°`, bục nhảy `(0,3,13)` lên tầng 2, Tháp Chuông `r=2m`, 7 đèn `L1–L7`; mỗi `30s` có cơn gió `5s` đẩy `2 m/s` (báo trước `2s`). |
| **AC-2.5 Gió Lạc (Drifters)** | Sinh ở Đêm 2 & 3 mỗi `1200 tick` (tối đa 2), `idle → chase` khi Mây mang `≥ 5` và cách `≤ 15m`; chạm (`≤ 1.2m`) cướp `min(3, carried)` (`drifter_steal`) rồi `flee`; trúng Pulse khi đang `flee` có đồ sẽ thả lại thành đom đóm rơi (`drifter_drop`). |
| **AC-2.6 Bùa Gió (Charms)** | Nhặt phát `charm_picked`, hiệu lực `600 tick`: tốc độ `7.2 m/s` và Dash `0` hồi chiêu; hồi lại sau `2700 tick`. |
| **AC-2.7 Chuỗi 3 Đêm** | Menu chính → Giới thiệu Đêm (tên đảo + lời Ông Đăng) → Chơi → Kết quả → Đêm kế tiếp; thắng Đêm 3 hiện màn hình Bình Minh với tổng điểm; thua cho chơi lại Đêm đó. |
| **AC-2.8 Tạm dừng (`Esc`/`P`) & Cài đặt** | Dừng hoàn toàn logic (`sim_tick` & bộ đếm đứng yên, phát `paused`/`resumed`), có Tiếp tục / Chơi lại / Cài đặt / Về menu; âm lượng & độ nhạy chuột lưu qua `localStorage`. |
| **AC-2.9 Âm thanh, Bảng màu chuẩn & HUD đầy đủ** | Nhạc nền đêm + đủ 10 hiệu ứng + đếm ngược 10s cuối; bảng màu đúng hex chuẩn; ánh sáng môi trường `0.15 + 0.55 × (lit/total)`; HUD đủ Ngọn Lửa, đồng hồ đỏ nhấp nháy `≤30s`, thanh 10 ô đom đóm, hồi chiêu Lướt/Tỏa sáng, nhắc `E`, mũi tên chỉ đèn ngoài màn hình. |

## 3. Nhật ký AI, Token & Đánh giá Phase 2
- **Ước tính token Phase 2:** ~45k–55k tokens (chuẩn hóa sim + thêm `maps.js` 3 bản đồ + nâng cấp client 3D, HUD, audio, 3-night flow + bộ test v1.1).
- **Lỗi phát hiện & xử lý trong Phase 2:**
  - `src/sim/prng.js` bị editor ghi đè bản cũ khiến test `SeededPRNG(0) !== SeededPRNG(1)` báo đỏ ngay khi chạy `npm test` → phát hiện tức thì nhờ unit test và sửa lại trong 10 giây.
- **Cập nhật Harness:** Cập nhật `AGENTS.md` và `.agents/skills/verify-phase/SKILL.md` lên Contract v1.1 (thứ tự 12 bước tick, trạng thái Bóng Mực chuẩn, benchmark 21.600 ticks ≤ 30s).
