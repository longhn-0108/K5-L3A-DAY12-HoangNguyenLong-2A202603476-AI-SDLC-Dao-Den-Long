# Bằng chứng kiểm chứng — Phase 1 (`phase-1`)

Môi trường kiểm chứng: Windows 11, Node.js `v24.21.0`, npm `11.19.0`.

## 1. Bảng truy vết Yêu cầu → Bằng chứng

| Yêu cầu (PRD-0 / Contract v1.0) | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| `game.contract.json` đúng schema & khớp mã nguồn | Unit test `Contract & Tuning Consistency` | `tests/sim.test.js` so sánh `deepEqual(TUNING, contract.tuning)` | **ĐẠT** |
| Di chuyển theo `cam_yaw_deg`, chuẩn hóa vector `[1,1]`, nhảy rising-edge | Unit tests `Movement, Camera Yaw & Jump` | 3/3 test trong `tests/sim.test.js` pass | **ĐẠT** |
| Nhặt đom đóm, nạp sáng, thắp đèn, thắng `all_lit`, cộng điểm thưởng | Unit test + Headless CLI scenario | `tests/sim.test.js` + `Win flow (pickup + deposit + all_lit)` (`state=won, ticks=46, score=658`) | **ĐẠT** |
| Tỏa sáng (Pulse) stun + push + cooldown + tốn đom đóm | Unit test + Headless CLI scenario | `tests/sim.test.js` + `Pulse stun & push (S1 stunned)` (`stunned=["S1"], pos=[10,1,0]`) | **ĐẠT** |
| Bóng Mực đuổi, tránh `safe_radius`, chạm mất máu + rơi đom đóm, thua `no_flames` | Unit test + Headless CLI scenario | `tests/sim.test.js` + `Shade hit & loss (no_flames, drop 50%)` (`dropped=3, state=lost, ticks=18`) | **ĐẠT** |
| Hết giờ thua `dawn` | Unit test `loses with reason dawn when time runs out` | `tests/sim.test.js` (`tick=30, reason="dawn"`) | **ĐẠT** |
| Tính tất định 100% cùng `--seed` | Chạy headless 2 lần, so sánh file JSONL từng byte | `tests/headless.test.js` + `Determinism (seed=777, 600 ticks x2)` | **ĐẠT** |
| File `inputs`/`scenario` sai định dạng → mã thoát `2` | Chạy headless với JSON hỏng và `tick` không tăng nghiêm ngặt | `tests/headless.test.js` + `Invalid inputs -> exit code 2` (`exit=2`) | **ĐẠT** |
| Hiệu năng headless 4800 ticks | Chạy `node src/headless.js --seed 99 --night 1 --ticks 4800` | Hoàn thành trong `145.3ms` (`exit=0`) | **ĐẠT** |
| Bản game 3D web build sạch (Three.js + Vite) | Chạy `npm run build` | `vite build` thành công (`dist/index.html`, `dist/assets/*.js`), `0` lỗi | **ĐẠT** |

## 2. Kết quả chạy lệnh thật

### Lệnh 1: `npm test`
```text
> dao-den-long@0.1.0 test
> node --test tests/*.test.js

▶ Headless CLI Test Contract v1.0
  ✔ runs a scenario + inputs to win and produces valid JSONL (148.2556ms)
  ✔ is 100% deterministic across two runs with the same seed (298.9642ms)
  ✔ exits with code 2 on malformed inputs JSON or non-increasing ticks (248.4678ms)
✔ Headless CLI Test Contract v1.0 (699.0252ms)
▶ Contract & Tuning Consistency
  ✔ src/sim/tuning.js matches game.contract.json exactly (3.9819ms)
✔ Contract & Tuning Consistency (6.2113ms)
▶ Movement, Camera Yaw & Jump
  ✔ moves along +X/+Z at yaw 0 and rotates properly at yaw 90 (3.0367ms)
  ✔ normalizes diagonal move [1, 1] to unit length (0.6858ms)
  ✔ jumps on rising edge and lands back at y = 0 (0.7105ms)
✔ Movement, Camera Yaw & Jump (5.0575ms)
▶ Motes, Lanterns & Win Condition
  ✔ picks motes, deposits on interact rising edge, lights lantern and wins (1.0676ms)
✔ Motes, Lanterns & Win Condition (2.9439ms)
▶ Pulse, Shades, Safe Radius & Loss Conditions
  ✔ stuns and pushes shade on pulse and enforces cooldown (1.0213ms)
  ✔ keeps shades outside safe_radius of lit lanterns (1.0942ms)
  ✔ damages player, drops motes, grants invuln, and loses on 0 flames (0.4919ms)
  ✔ loses with reason dawn when time runs out (0.6079ms)
✔ Pulse, Shades, Safe Radius & Loss Conditions (4.0376ms)
ℹ tests 12
ℹ suites 5
ℹ pass 12
ℹ fail 0
ℹ skipped 0
```

### Lệnh 2: `npm run verify`
```text
=== Đảo Đèn Lồng · Phase 1 Contract Verification ===
[PASS] Determinism (seed=777, 600 ticks x2) — exit=0, 149.51ms
[PASS] Win flow (pickup + deposit + all_lit) — state=won, ticks=46, score=658
[PASS] Pulse stun & push (S1 stunned) — stunned=["S1"], pos=[10,1,0]
[PASS] Shade hit & loss (no_flames, drop 50%) — dropped=3, state=lost, ticks=18
[PASS] Invalid inputs -> exit code 2 — exit=2
[PASS] Headless speed (4800 ticks) — 145.3ms
```

### Lệnh 3: `npm run build`
```text
vite v6.4.6 building for production...
✓ 9 modules transformed.
dist/index.html                   3.16 kB │ gzip:   1.22 kB
dist/assets/index-B7Ks4RYX.css    3.48 kB │ gzip:   1.28 kB
dist/assets/index-B3BpzfYh.js   499.80 kB │ gzip: 129.05 kB
✓ built in 2.38s
```
