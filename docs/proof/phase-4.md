# Bằng chứng kiểm chứng — Phase 4 (`phase-4` / `v1.0.0` · Contract v1.3)

**Cấu hình máy đo tham khảo:** Windows 11 (`win32 10.0.26300 x64`), Node.js `v24.21.0`, GPU `AMD Radeon (TM) Graphics (Direct3D11)`, cửa sổ `1280×720`.

## 1. Bảng truy vết Yêu cầu Phase 4 → Bằng chứng

| Yêu cầu (TICKET-04 / Contract v1.3) | Ngưỡng đạt | Kết quả đo thật | Trạng thái |
|---|---|---|---|
| **Benchmark 1280×720** (`node src/bench.js --seed 42 --duration 30 --out bench.json`) | `avg_fps ≥ 60`, `p1_low_fps ≥ 30`, `load_ms ≤ 10000` | `avg_fps: 349.0`, `p1_low_fps: 155.2`, `frame_ms_p95: 4.7`, `frames: 10472`, `load_ms: 2710` ([bench.json](../../bench.json)) | **ĐẠT** |
| **Soak test 10 Đêm** (`node --max-semi-space-size=2 --expose-gc src/soak.js --seed 7 --nights 10 --out soak.json`) | `crashes = 0`, `mem_end_mb ≤ 1.2 × mem_start_mb` | `crashes: 0`, `mem_start_mb: 62.4`, `mem_end_mb: 65.8` (`+5.4% ≤ 20%`), `duration_s: 0.45` ([soak.json](../../soak.json)) | **ĐẠT** |
| **Bảng xếp hạng cục bộ + `--export-leaderboard`** | Top 10, tên 3–12 ký tự, tie-break đạt trước đứng trên, lưu đĩa | `tests/phase4.test.js` pass cả unit test lẫn CLI `node src/run.js --export-leaderboard` | **ĐẠT** |
| **Dễ tiếp cận (Accessibility)** | Đổi 9 phím + báo trùng + mặc định; phụ đề + mũi tên Bóng Mực; Giảm chuyển động; chữ ≥18px + ×1.25 | Triển khai đầy đủ trong `index.html`, `src/client/style.css`, `src/client/main.js`, build sạch | **ĐẠT** |
| **Regression Phase 1–3** | Toàn bộ test không bị thay thế còn đạt | `npm test` (`13/13` pass), `npm run verify` (`5/5` pass), `npm run build` PASS | **ĐẠT** |
| **Đóng gói, Retro & Tài liệu** | README ≤ 3 lệnh, CHANGELOG 4 phase, CREDITS, LICENSE, Retro 1–2 trang | Đầy đủ trong repo, sẵn sàng gắn tag `phase-4` & Release `v1.0.0` | **ĐẠT** |

## 2. Kết quả thật (`bench.json` & `soak.json`)

### `bench.json`
```json
{
  "contract_version": "1.3",
  "avg_fps": 349,
  "p1_low_fps": 155.2,
  "frame_ms_p95": 4.7,
  "frames": 10472,
  "load_ms": 2710,
  "peak_mem_mb": 15.6,
  "vsync_off": true,
  "renderer": "Three.js r170 WebGLRenderer (ANGLE (AMD, AMD Radeon (TM) Graphics (0x000015E7) Direct3D11 vs_5_0 ps_5_0, D3D11))",
  "os": "win32 10.0.26300 (x64)"
}
```

### `soak.json`
```json
{
  "nights": 10,
  "crashes": 0,
  "results": ["lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost", "lost"],
  "mem_start_mb": 62.4,
  "mem_end_mb": 65.8,
  "duration_s": 0.45
}
```
