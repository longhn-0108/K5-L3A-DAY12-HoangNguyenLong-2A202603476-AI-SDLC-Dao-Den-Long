# Ghi chép Phase 1 — PRD-0 & Test Contract v1.0

## 1. Phân tích yêu cầu & Giả định cho các điểm mơ hồ

| Hạng mục trong PRD-0 | Điểm mơ hồ | Giả định đã chọn (khai báo trong `game.contract.json`) |
|---|---|---|
| Kích thước Đảo Bến & rơi khỏi đảo | Chỉ nói "hòn đảo tròn có 5 Đèn Lồng Lớn" | Bán kính đảo `35m`, mặt đất `Y = 0`, 5 đèn đặt đều trên vòng tròn bán kính `22m`. Đặt `fall_enabled: false` (giới hạn di chuyển trong bán kính `34.5m`). |
| Số đom đóm cần cho mỗi đèn & sức chứa | Không nêu số cụ thể | `lantern_cost: 5`, `carry_capacity: 10`, `pickup_radius: 1.8m`, `interact_radius: 3m`. Đom đóm tự sinh ban đầu `20` con và hồi mỗi `4s` (tối đa `22`) khi `random_motes: true`. |
| Máu & Bóng Mực | Chỉ nêu "chạm vào mất máu", "sợ đèn" | `flames: 3`, `invuln_s: 2s`, `hit_drop_ratio: 0.5` (làm tròn xuống `Math.floor`), `shade_speed: 2.8 m/s`, `shade_hit_radius: 1.2m`, `safe_radius: 6m` quanh đèn đã thắp. |
| Tỏa sáng (Pulse) | "Tốn ánh sáng để xua Bóng Mực" | `pulse_cost: 2`, `pulse_radius: 7m`, `pulse_stun_s: 3s`, `pulse_push_m: 6m`, `pulse_cooldown_s: 4s`. |
| Thời lượng & Điểm số | "Có điểm số", có lý do thua `dawn` | `night1_duration_s: 240s`. Điểm: `per_mote: 10`, `per_lantern: 100`, `per_stun: 25`, thưởng thắng `per_second_left: 2` (theo `Math.floor(time_left_s)`) + `per_flame_left: 50`. |
| Điểm số khi dựng scenario | Contract yêu cầu không cộng điểm setup | Khi `scenario` đặt `lit: true` hoặc `carried > 0`, không phát sự kiện và `score` bắt đầu ở `0`. |

## 2. Tiêu chí nghiệm thu kiểm chứng được (Acceptance Criteria)
1. **AC-1 (Core 3D playable):** Chạy `npm install && npm run build && npm run dev` mở được game 3D trên trình duyệt; Mây (đội nón lá treo đèn) đi lại, nhảy, xoay camera, nhặt đom đóm, thắp 5 đèn, tỏa sáng xua Bóng Mực, thấy HUD và chơi lại được sau thắng/thua.
2. **AC-2 (Contract consistency):** `src/sim/tuning.js` trùng khớp hoàn toàn với `game.contract.json`.
3. **AC-3 (Headless CLI):** `node src/headless.js` chạy 60 tick/s, hỗ trợ đầy đủ cờ `--seed`, `--night 1`, `--scenario`, `--inputs`, `--ticks`, `--out`, `--snapshot-every`, trả mã `0` khi hợp lệ và mã `2` khi file `inputs`/`scenario` lỗi định dạng.
4. **AC-4 (Determinism):** Chạy headless 2 lần cùng `--seed` cho file JSONL giống nhau từng byte.
5. **AC-5 (Game rules):** Đủ luồng nhặt đom đóm → nạp đèn → thắp đèn → thắng (`all_lit`), pulse stun/push + cooldown, Bóng Mực tôn trọng `safe_radius`, chạm Bóng Mực mất máu + rơi đom đóm + thua (`no_flames`), hết giờ thua (`dawn`).

## 3. Nhật ký dùng AI & Quản lý token (Phase 1)
- **Công cụ:** Antigravity Agent.
- **Ước tính token Phase 1:** ~35k–45k tokens tổng (đọc 6 tài liệu lab + lập kế hoạch + sinh lõi sim, headless CLI, client 3D Three.js, bộ test và tài liệu).
- **Cách tiết kiệm token đã áp dụng:**
  - Chọn **JavaScript thuần (ESM)** thay vì TypeScript để giảm boilerplate và tránh vòng lặp sửa lỗi type.
  - Giữ `AGENTS.md` rất ngắn (~30 dòng) nhưng đủ các bất biến của Test Contract v1.0.
  - Gộp đọc/ghi nhiều file song song theo từng batch và chạy chuỗi lệnh kiểm chứng (`npm test`, `npm run verify`, `npm run build`) trong một lần thực thi.
  - Viết test kiểm chứng ngay sau khi xong lõi, không sửa đi sửa lại nhiều vòng.

## 4. Đánh giá nhanh Phase 1 (Evaluation)
- **Kết quả:** Đạt toàn bộ 5 tiêu chí nghiệm thu (`12/12` unit & CLI tests pass, `6/6` contract scenarios pass, `vite build` pass).
- **Sự cố gặp phải & cách xử lý:**
  - Trên Windows PowerShell 5.1, toán tử `&&` không được hỗ trợ khi chạy lệnh nối chuỗi → chuyển sang kiểm tra `$LASTEXITCODE` trong PowerShell và giữ `&&` chuẩn POSIX trong `game.contract.json` (`build_cmd`) cho môi trường chấm macOS/Linux.
- **Harness đã xây dựng:**
  - `AGENTS.md`: quy ước tách `src/sim/` khỏi `src/client/`, cấm `Math.random()` trong sim, các bất biến Test Contract v1.0.
  - `.agents/skills/verify-phase/SKILL.md`: quy trình tự kiểm chứng chuẩn trước khi tag.
  - `.github/workflows/ci.yml`: tự động chạy `npm test`, `npm run verify`, `npm run build` mỗi khi push hoặc gắn tag.
