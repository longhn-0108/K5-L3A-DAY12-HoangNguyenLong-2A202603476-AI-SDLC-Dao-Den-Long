# Đảo Đèn Lồng — Ba Hòn Đảo (Day 12 AI SDLC Lab)

> **Tác giả:** Hoàng Nguyên Long (`2A202603476`) · Lớp K5-L3A
> **Phiên bản:** Phase 2 (`TICKET-02`) · **Test Contract v1.1** · 3 Đêm (Đảo Bến, Đảo Cau, Đảo Chuông).

Người chơi điều khiển **Mây** (đội nón lá treo đèn lồng nhỏ) đi qua **Ba Hòn Đảo**: thu thập đom đóm, lướt qua hiểm nguy, thắp sáng các Đèn Lồng Lớn, né **Bóng Mực**, đối phó **Gió Lạc**, dùng **Bùa Gió** và đón Bình Minh trở lại.

---

## Cài đặt & Chạy (tối đa 3 lệnh)

Yêu cầu: **Node.js ≥ 18** (chạy giống nhau trên macOS, Linux, Windows).

```bash
npm install
npm run build
npm run dev
```

Mở trình duyệt tại URL Vite hiển thị (mặc định `http://localhost:5173`).

### Chạy kiểm thử & chế độ Headless (Contract v1.1)

```bash
npm test
npm run verify
node src/headless.js --seed 42 --night 3 --ticks 600 --out out.jsonl
```

---

## Điều khiển

| Phím / Chuột | Hành động |
|---|---|
| `W` `A` `S` `D` (hoặc `↑` `↓`) | Di chuyển (6.0 m/s; 7.2 m/s khi có Bùa Gió) |
| `Space` | Nhảy (7.0 m/s, chỉ nhảy khi chạm đất) |
| `Shift` | **Lướt (Dash):** 14 m/s trong 0.2s, hồi chiêu 1.5s (0s khi có Bùa Gió) |
| `E` (hoặc `F`) | Nạp đom đóm vào Đèn Lồng Lớn gần nhất (bán kính 2.0m, 10 đom đóm/đèn) |
| `R` | **Tỏa sáng (Pulse):** tốn 3 đom đóm, bán kính 5m, hồi chiêu 3s |
| `Esc` / `P` | Tạm dừng (dừng hoàn toàn logic, mở menu Tạm dừng & Cài đặt) |
| `←` `→` / `Q` / Kéo chuột trái / Cuộn chuột | Xoay & zoom camera 3D |
| `M` | Tắt / bật âm thanh |

---

## Ba Hòn Đảo & Luật chơi chuẩn hóa (Contract v1.1)

Thông số khớp 100% với [game.contract.json](game.contract.json):

- **Đêm 1 — Đảo Bến (300s):** Đảo tròn `R = 40m`, 5 Đèn Lồng Lớn (`L1–L5`), rơi xuống `Y < -10` mất 1 Ngọn Lửa & toàn bộ đom đóm.
- **Đêm 2 — Đảo Cau (330s):** 2 đảo `R = 28m` nối bằng cầu tre không lan can + 2 bục nhảy phóng qua đảo + **Gió Lạc** + **Bùa Gió** (`C1`), 6 Đèn (`L1–L6`).
- **Đêm 3 — Đảo Chuông (360s):** Đảo 3 tầng (`Y = 0, 3, 6`) + 2 dốc thẳng + bục nhảy lên tầng 2 + Tháp Chuông + **Gió mạnh** mỗi 30s + Gió Lạc + 2 Bùa Gió (`C1, C2`), 7 Đèn (`L1–L7`).
- **Tính điểm chuẩn hóa:** `+10` mỗi đom đóm nạp · `+100` mỗi đèn thắp · `+5` mỗi Bóng Mực trúng Tỏa Sáng · Thưởng thắng: `floor(time_left_s) × 2 + flames × 50`.

---

## Sáng tạo của tôi

1. **Mây phong cách Ninja & Đèn nón lá phản hồi ánh sáng:** Khi chạy/lướt, Mây lao nghiêng người với khăn choàng đỏ (`#C8102E`) phấp phới, để lại vệt bụi ánh sáng và lộn nhào khi nhảy; đèn nhỏ dưới vành nón lá sáng rực theo số đom đóm mang theo.
2. **Tạo hình Bóng Mực dạng Bóng Ma (Spectral Ghosts):** Bóng Mực tuân thủ đúng bảng màu chuẩn (`#120A1A` / `#7A3CFF` / `#3A3450`) nhưng mang dáng dấp bóng ma lơ lửng, run rẩy mờ dần khi bị choáng.
3. **Đèn hoa đăng ước nguyện & Hiệu ứng Bloom:** Thắp xong Đèn Lồng Lớn thả 5 đèn hoa đăng bay lên bầu trời sao, kết hợp `UnrealBloomPass` của Three.js và nội suy mượt 60Hz→144Hz.
4. **Nhạc nền đêm & 10+ hiệu ứng âm thanh tổng hợp (Web Audio API):** Hoàn toàn procedural, không dùng file âm thanh ngoài, chỉnh được âm lượng và lưu cài đặt qua `localStorage`.

**Bằng chứng không phá Test Contract:** Mọi yếu tố sáng tạo nằm hoàn toàn trong `src/client/`. `npm test` (14/14 pass) và `npm run verify` (6/6 pass, gồm tất định cả 3 Đêm và benchmark 21.600 tick trong ~0.73s) xác nhận đầu ra headless chuẩn 100%.

---

## Hồ sơ SDLC, Harness AI & Bằng chứng

- **Contract v1.1:** [game.contract.json](game.contract.json)
- **Harness AI:** [AGENTS.md](AGENTS.md), [.agents/skills/verify-phase/SKILL.md](.agents/skills/verify-phase/SKILL.md), [.github/workflows/ci.yml](.github/workflows/ci.yml)
- **Spec & Ghi chép:** [docs/notes/phase-1.md](docs/notes/phase-1.md), [docs/notes/phase-2.md](docs/notes/phase-2.md)
- **Bằng chứng kiểm chứng:** [docs/proof/phase-1.md](docs/proof/phase-1.md), [docs/proof/phase-2.md](docs/proof/phase-2.md)
- **Bản quyền & Nguồn:** [LICENSE](LICENSE), [CREDITS.md](CREDITS.md)
