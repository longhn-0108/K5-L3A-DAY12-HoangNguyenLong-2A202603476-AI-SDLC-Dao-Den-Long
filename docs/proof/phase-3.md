# Bằng chứng kiểm chứng — Phase 3 (`phase-3` · Contract v1.2)

Môi trường kiểm chứng: Windows 11, Node.js `v24.21.0`, npm `11.19.0`.

## 1. Bảng truy vết Yêu cầu Phase 3 → Bằng chứng

| Yêu cầu (TICKET-03 / Contract v1.2) | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| `game.contract.json` v1.2 khớp 100% số chuẩn & khóa mới | Unit test `Contract v1.2 & Tuning Consistency` | `tests/sim.test.js` (`deepEqual(TUNING, contract.tuning)`) | **ĐẠT** |
| Hao dầu `1.0/s`, tắt đèn (`lantern_out`), thắp lại tốn `5` (`+40`), tăng sức chứa | Unit test + Headless CLI scenario | `tests/sim.test.js` + `Fuel decay -> lantern_out -> relight -> refuel` | **ĐẠT** |
| Châm dầu `ceil((100 - fuel)/10)` (`refuel`), bỏ qua đèn đầy | Unit test `refuels lit lantern...` | `tests/sim.test.js` | **ĐẠT** |
| Bóng Mực hút dầu (`drain`, `5/s`, `fuel_drain` mỗi 60 tick) + Pulse thưởng `+15` | Unit test + Headless CLI scenario | `tests/sim.test.js` + `Shade drain + fuel_drain event + Pulse bonus (+15)` | **ĐẠT** |
| Luật thắng mới `dawn_survived` (`≥ ceil(0.6 × tổng đèn)`) + thưởng bình minh | Unit test + Headless CLI scenario | `tests/sim.test.js` + `Dawn survived win (3/5 lit -> dawn_survived)` | **ĐẠT** |
| Regression Phase 1–2 (di chuyển, lướt, rơi, Gió Lạc, Bùa Gió, tất định 3 Đêm) | `tests/sim.test.js` + `tests/headless.test.js` | `10/10` pass, tất định cả 3 Đêm | **ĐẠT** |
| Tốc độ headless Đêm 3 đầy đủ (`18,000` tick ≤ 30s) | `tests/verify_contract.js` | Hoàn thành trong `~680 ms` | **ĐẠT** |
| Bản 3D Web (thanh dầu 3D, nhấp nháy 1Hz, đèn tắt xẹp 20% + rách, chế độ mù màu) | `npm run build` | `vite build` sạch, `0` lỗi | **ĐẠT** |
