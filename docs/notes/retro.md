# Retrospective — Day 12 AI SDLC Lab: Đảo Đèn Lồng (v1.0.0)

## 1. Tổng hợp Evaluation qua 4 Phase

| Phase | Phạm vi chính | Contract | Kết quả kiểm chứng | Điểm nổi bật / Rủi ro đã xử lý |
|---|---|---|---|---|
| **Phase 1** (`phase-1`) | PRD-0 mơ hồ → Đêm 1 (Đảo Bến) + Headless | v1.0 | `13/13` tests, `6/6` verify, `vite build` PASS | Tách sạch `src/sim/` khỏi `src/client/` ngay từ đầu; QA độc lập bắt được bug off-by-one `stunTimer` (179 vs 180 ticks). |
| **Phase 2** (`phase-2`) | Chuẩn hóa số liệu + 3 Đêm + Dash/Drifter/Charm/Wind/Pause | v1.1 | `14/14` tests, `6/6` verify (`21,600` ticks trong `522ms`) | Chuyển sang thứ tự 12 bước/tick chuẩn; giữ nguyên sáng tạo cảnh quan cho cả 3 đảo. |
| **Phase 3** (`phase-3`) | Change Request: Nhiên liệu đèn, `drain`, `dawn_survived`, sức chứa động, mù màu | v1.2 | `10/10` tests, `5/5` verify (`18,000` ticks trong `632ms`) | Dùng số nguyên `1/60` cho fuel để triệt tiêu sai số float; viết ADR-001 và `CHANGELOG.md` giải thích breaking changes. |
| **Phase 4** (`phase-4` / `v1.0.0`) | Benchmark 1280×720, Soak 10 Đêm, Leaderboard cục bộ, Accessibility, Release | v1.3 | `13/13` tests, `bench: 349 FPS / 155.2 p1_low / 2.71s load`, `soak: 0 crashes, +5.4% RSS` | Dùng `InstancedMesh` cho 200 Shades + 100 Motes trong bench; xử lý JIT warmup trong soak test. |

---

## 2. Điều hiệu quả & Chưa hiệu quả khi làm việc với AI

### Hiệu quả nhất
- **Thiết kế kiến trúc Sim/View tách rời ngay từ Phase 1:** Khi Phase 2 mở rộng 3 đảo và Phase 3 thay đổi hoàn toàn luật nhiên liệu + luật thắng, mọi thay đổi logic chỉ tập trung trong `src/sim/` và kiểm chứng được trong `< 1.5s` bằng `node --test`.
- **Test Contract làm hợp đồng khóa cứng:** Unit test `deepEqual(TUNING, contract.tuning)` đảm bảo không bao giờ xảy ra lệch thông số giữa `game.contract.json` và mã nguồn qua cả 4 phiên bản v1.0 → v1.3.
- **Chơi thử thật + đóng vai QA nghiêm khắc:** Phản hồi chơi thử thực tế giúp phát hiện ngay camera góc thấp khó nhìn, khựng khung hình 60Hz chưa nội suy và tốc độ Bóng Mực ban đầu hơi nhanh.

### Chưa hiệu quả / Bài học rút ra
- **Chưa tách cảnh quan thành module riêng từ đầu:** Khi viết lại `buildIslandVisuals()` ở Phase 2 cho 3 đảo, ban đầu vô tình làm mất bớt cảnh quan sinh động của Phase 1 và phải bổ sung lại ở lượt kế tiếp.
- **Kịch bản kiểm chứng biên đôi khi viết chưa khớp bán kính thực:** Ví dụ kịch bản test `Shade drain` ở Phase 3 ban đầu đặt Mây cách Bóng Mực `8m` (`≤ 12m`) khiến Bóng Mực đuổi Mây thay vì hút dầu.

---

## 3. Những lần AI / mã nguồn sai & Cách phát hiện

1. **Bug off-by-one `stunTimer` (Phase 1):** `s.stunTimer` bị trừ luôn trong cùng tick `Pulse` vừa kích hoạt → chỉ choáng `179` ticks thay vì `180` ticks. **Phát hiện:** chạy QA probe đếm chính xác từng tick. **Khắc phục:** thêm `justStunnedIds`, viết unit test khóa cứng và cập nhật quy tắc vào `AGENTS.md`.
2. **Trùng chuỗi PRNG `--seed 0` và `--seed 1` (Phase 1 & hồi quy Phase 2):** `|| 1` làm seed `0` trùng `1`, sau đó file bị editor ghi đè bản cũ ở đầu Phase 2. **Phát hiện:** unit test `assert.notEqual(p0.next(), p1.next())` báo đỏ ngay lập tức.
3. **V8 RSS tăng giả trong Soak test (Phase 4):** Lần chạy đầu `mem_start_mb = 52.3`, `mem_end_mb = 71.7` (> 1.2×) do V8 TurboFan biên dịch JIT trong Đêm 1 sau thời điểm đo `mem_start_mb`. **Phát hiện:** đọc trực tiếp số đo thật từ `soak.json`. **Khắc phục:** thêm cờ `--max-semi-space-size=2 --expose-gc` và làm nóng JIT trước Đêm 1 → `62.4 → 65.8 MB` (+5.4%, chứng minh không rò rỉ bộ nhớ).
4. **Cú pháp PowerShell 5.1 trên Windows:** Toán tử `&&` lỗi trên PowerShell 5.1 → dùng `; if ($LASTEXITCODE -eq 0)` khi chạy local, vẫn giữ `&&` chuẩn POSIX trong `game.contract.json` cho máy chấm macOS/Linux.

---

## 4. Harness AI nào giúp ích nhiều nhất?
- **`AGENTS.md` (cập nhật qua cả 4 phase):** Ngắn (~30 dòng), khóa chặt các bất biến (tách Sim/View, integer fuel `1/60`, thứ tự 12 bước/tick, không trừ timer cùng tick gán) giúp AI không bị "quên luật" khi sang phase mới.
- **Bộ test `npm test` + `npm run verify` + CI (`.github/workflows/ci.yml`):** Đây là cơ chế chắc chắn nhất — bắt lỗi ngay bằng mã chạy thật thay vì chỉ dựa vào lời nhắc.
- **Skill `.agents/skills/verify-phase/SKILL.md`:** Chuẩn hóa quy trình kiểm chứng 3 bước trước mọi lần gắn tag.

---

## 5. Quản lý Token & Chi phí ước tính

| Phase | Ước tính Token | Chiến lược tiết kiệm token đã áp dụng |
|---|---:|---|
| Phase 1 | ~40k | Chọn JS thuần ESM (bỏ overhead TypeScript), batch đọc/ghi nhiều file song song |
| Phase 2 | ~50k | Tách `maps.js` gọn, chạy test ngay sau lõi sim trước khi đụng client |
| Phase 3 | ~40k | Dùng `edit_file` cục bộ thay vì viết lại cả file lớn khi nâng cấp client |
| Phase 4 | ~50k | Tái sử dụng `GameEngine` & `InstancedMesh`, chạy verify gộp trong 1 lệnh shell |
| **Tổng cộng** | **~180k tokens** | Giữ `AGENTS.md` ngắn, không chạy vòng lặp sửa mù, luôn đo & test sớm |

---

## 6. Nếu làm lại dự án này, sẽ đổi gì?
1. Tách `src/client/` thành các module nhỏ (`world.js`, `entities.js`, `hud.js`, `bench.js`) ngay từ Phase 1 để khi thêm đảo mới hoặc chế độ benchmark không phải sửa một file `main.js` dài.
2. Thêm script tự động chụp ảnh màn hình (headless browser screenshot) ngay từ Phase 1 để nhúng trực tiếp vào `docs/proof/` mỗi phase.
