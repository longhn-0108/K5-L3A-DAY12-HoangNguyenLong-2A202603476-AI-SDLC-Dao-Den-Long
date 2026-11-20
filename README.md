# Đảo Đèn Lồng — v1.0.0 (Day 12 AI SDLC Lab)

> **Video Demo (< 5 phút):** [Xem trên GitHub Release v1.0.0](https://github.com/longhn-0108/K5-L3A-DAY12-HoangNguyenLong-2A202603476-AI-SDLC-Dao-Den-Long/releases/tag/v1.0.0) *(hoặc `docs/demo/demo.mp4` sau khi upload)*
> **Tác giả:** Hoàng Nguyên Long (`2A202603476`) · Lớp K5-L3A · **Test Contract v1.3**

Game 3D góc nhìn từ trên xuống xây dựng bằng **Three.js + Vite + Node.js**: điều khiển **Mây** (đội nón lá treo đèn lồng) vượt qua **3 Đêm** (*Đảo Bến*, *Đảo Cau*, *Đảo Chuông*), gom đom đóm, thắp & châm dầu giữ ít nhất **60% Đèn Lồng Lớn** sáng tới bình minh trước **Bóng Mực** và **Gió Lạc**.

---

## Yêu cầu hệ thống
- **Node.js ≥ 18** (chạy giống nhau trên macOS, Linux, Windows).
- Trình duyệt hỗ trợ WebGL2 (Chrome / Edge / Safari / Firefox); chế độ `bench` tự tìm Chrome/Chromium/Edge (có thể chỉ định bằng biến môi trường `CHROME_BIN`).

## Cài đặt & Chạy (tối đa 3 lệnh)

```bash
npm install
npm run build
node src/run.js
```

*(Hoặc chạy dev server bằng `npm run dev`.)*

---

## Chạy Test, Headless, Benchmark, Soak & Xuất Bảng Xếp Hạng

```bash
# 1. Toàn bộ unit test + Contract CLI + Leaderboard + Soak (13/13 pass)
npm test

# 2. Bộ kiểm chứng Contract v1.2/v1.3 + tất định 3 Đêm
npm run verify

# 3. Chế độ Headless (Contract v1.3, --night 1 | 2 | 3)
node src/headless.js --seed 42 --night 1 --ticks 600 --out out.jsonl

# 4. Chế độ Benchmark 1280×720 (tắt vsync bằng --disable-frame-rate-limit --disable-gpu-vsync)
node src/bench.js --seed 42 --duration 30 --out bench.json

# 5. Soak test 10 Đêm liên tiếp
node --max-semi-space-size=2 --expose-gc src/soak.js --seed 7 --nights 10 --out soak.json

# 6. Xuất Bảng xếp hạng cục bộ ra JSON
node src/run.js --export-leaderboard leaderboard.json
```

> **Ghi chú VSync:** `src/bench.js` khởi chạy Chromium/Chrome/Edge với cờ `--disable-frame-rate-limit --disable-gpu-vsync` (`vsync_off: true`). Trên máy test (AMD Radeon integrated, Windows 11, 1280×720) đạt **`349.0 avg FPS`**, **`155.2 p1_low FPS`**, **`load_ms = 2710 ms`** (xem [bench.json](bench.json)).

---

## Điều khiển (mặc định — đổi phím được trong Cài đặt)

| Phím | Hành động |
|---|---|
| `W` `A` `S` `D` | Di chuyển (6.0 m/s; 7.2 m/s khi có Bùa Gió) |
| `Space` | Nhảy (7.0 m/s) |
| `Shift` | Lướt / Dash (14 m/s trong 0.2s; hồi chiêu 1.5s, 0s khi có Bùa Gió) |
| `E` | Nạp đom đóm / Thắp lại (5 đom đóm) / Châm dầu đèn đang sáng |
| `R` | Tỏa sáng / Pulse (tốn 3 đom đóm, bán kính 5m, hồi chiêu 3s) |
| `Esc` / `P` | Tạm dừng & mở menu Cài đặt |
| `←` `→` / `Q` / Kéo chuột / Cuộn chuột | Xoay & zoom camera 3D |
| `M` | Tắt / bật âm thanh |

---

## Sáng tạo của tôi

1. **Mây phong cách Ninja & Đèn nón lá phản hồi ánh sáng:** Tư thế lao nghiêng khi chạy/lướt với khăn choàng đỏ (`#C8102E`) phấp phới, lộn nhào khi nhảy (tắt khi bật *Giảm chuyển động*), đèn treo vành nón sáng dần theo đom đóm mang theo.
2. **Bóng Mực tạo hình Bóng Ma (Spectral Ghosts) & Cảnh quan 3 đảo sống động:** Bóng ma bán trong suốt đúng bảng màu chuẩn (`#120A1A`/`#7A3CFF`, đổi sang `#00B3FF` ở chế độ mù màu); cảnh quan đặc trưng từng đảo (bến tàu & thuyền bập bềnh ở Đảo Bến, hàng cây Cau & cầu tre lát thanh ở Đảo Cau, chuông đồng lắc trong gió ở Đảo Chuông) kèm mưa đêm nhẹ và `UnrealBloomPass`.
3. **Âm thanh ngũ cung & nhạc nền đêm tổng hợp (Web Audio API):** 100% procedural, không dùng file âm thanh ngoài.

**Bằng chứng không phá Test Contract & Benchmark:** Toàn bộ sáng tạo nằm trong `src/client/`, tự động tắt ở `?bench=1` và không tồn tại trong `src/sim/`. `npm test` (13/13 pass), `npm run verify` (5/5 pass), [bench.json](bench.json) (`349 FPS`) và [soak.json](soak.json) (`0 crashes`) xác nhận tuân thủ 100%.

---

## Hồ sơ SDLC, Harness AI, Bằng chứng & Retro

- **Test Contract v1.3:** [game.contract.json](game.contract.json) · [bench.json](bench.json) · [soak.json](soak.json)
- **Harness AI:** [AGENTS.md](AGENTS.md) · [.agents/skills/verify-phase/SKILL.md](.agents/skills/verify-phase/SKILL.md) · [.github/workflows/ci.yml](.github/workflows/ci.yml)
- **ADR & Changelog:** [docs/adr/001-fuel-and-dawn-win.md](docs/adr/001-fuel-and-dawn-win.md) · [CHANGELOG.md](CHANGELOG.md)
- **Ghi chép & Retro:** [phase-1.md](docs/notes/phase-1.md) · [phase-2.md](docs/notes/phase-2.md) · [phase-3.md](docs/notes/phase-3.md) · [retro.md](docs/notes/retro.md)
- **Bằng chứng từng phase:** [phase-1](docs/proof/phase-1.md) · [phase-2](docs/proof/phase-2.md) · [phase-3](docs/proof/phase-3.md) · [phase-4](docs/proof/phase-4.md)
- **Bản quyền & Nguồn:** [LICENSE](LICENSE) · [CREDITS.md](CREDITS.md)
