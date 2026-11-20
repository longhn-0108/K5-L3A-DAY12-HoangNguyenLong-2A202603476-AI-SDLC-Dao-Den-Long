# Bằng chứng kiểm chứng — Phase 2 (`phase-2` · Contract v1.1)

Môi trường kiểm chứng: Windows 11, Node.js `v24.21.0`, npm `11.19.0`.

## 1. Bảng truy vết Yêu cầu Phase 2 → Bằng chứng

| Yêu cầu (TICKET-02 / Contract v1.1) | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| `game.contract.json` v1.1 khớp 100% số chuẩn Phần 1 | Unit test `Contract v1.1 & Tuning Consistency` | `tests/sim.test.js` (`deepEqual(TUNING, contract.tuning)`) | **ĐẠT** |
| Regression Phase 1 với số chuẩn (move 6.0, pickup 1.0, cost 10, pulse 3/5m/120t/4m, hit drop + recoil) | `tests/sim.test.js` + `tests/headless.test.js` | `14/14` tests pass | **ĐẠT** |
| Lướt (`dash`) + Tạm dừng (`pause`/`resume`) đóng băng `sim_tick` | Headless scenario `Dash + Pause/Resume freeze` | `events=["dash","paused","resumed"], snap20.state=paused` | **ĐẠT** |
| Rơi khỏi đảo (`Y < -10`) + `lost` + hồi sinh tại `(0,0,0)` | Headless scenario `Fall off island + respawn` | `lost=5, respawnPos=[0,0,0]` | **ĐẠT** |
| Đêm 2 — Bục nhảy phóng từ Đảo A sang Đảo B | Headless scenario `Night 2 Jump Pad launch` | Đáp tại `[53.496, 0, 5.942]` (`distB = 17.5m ≤ 28m`) | **ĐẠT** |
| Đêm 2 — Bùa Gió + Gió Lạc cướp & Pulse thả đồ | Headless scenario `Night 2 Charm + Drifter steal & pulse drop` | `events=["charm_picked","drifter_steal","drifter_drop","pulse",...]` | **ĐẠT** |
| Đêm 3 — Gió mạnh + chạy đủ `21,600` tick trong `≤ 30s` | Headless benchmark `Night 3 Wind + Full 21,600-tick` | Hoàn thành trong `735.49 ms` (`windActive=true`), nhanh gấp ~40× ngưỡng 30s | **ĐẠT** |
| Tính tất định 100% cho cả 3 Đêm (`--night 1, 2, 3`) | `tests/headless.test.js` chạy mỗi Đêm 2 lần so từng byte | PASS cả Đêm 1, 2, 3 | **ĐẠT** |
| Bản 3D Web (3 đảo, HUD đầy đủ, Menu 3 Đêm, Pause, Settings, Audio) | `npm run build` | `vite build` sạch, `0` lỗi | **ĐẠT** |

## 2. Kết quả chạy lệnh thật

### `npm test`
```text
ℹ tests 14
ℹ suites 6
ℹ pass 14
ℹ fail 0
ℹ skipped 0
```

### `npm run verify`
```text
=== Đảo Đèn Lồng · Phase 2 Contract v1.1 Verification ===
[PASS] Night 1 Determinism (600 ticks x2) — 196.29ms
[PASS] Dash + Pause/Resume freeze — events=["dash","paused","resumed"], snap20.state=paused
[PASS] Night 2 Charm + Drifter steal & pulse drop — events=["charm_picked","drifter_steal","drifter_drop","pulse","mote_picked","mote_picked","mote_picked"]
[PASS] Night 2 Jump Pad launch (Island A -> B) — pos=[53.496,0,5.942], distB=17.5m
[PASS] Night 3 Wind + Full 21,600-tick speed (<= 30s) — 735.49ms, windActive=true
[PASS] Fall off island + respawn at (0,0,0) — lost=5, respawnPos=[0,0,0]
```
