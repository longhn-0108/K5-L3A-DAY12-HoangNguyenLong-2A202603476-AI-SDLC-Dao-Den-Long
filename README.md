# Đảo Đèn Lồng — Day 12 AI SDLC Lab

> **Tác giả:** Hoàng Nguyên Long (`2A202603476`) · Lớp K5-L3A
> **Thể loại:** Game 3D góc nhìn thứ ba (Three.js + Vite) kèm chế độ Headless chạy Node.js theo **Test Contract v1.0**.

Người chơi điều khiển **Mây** (đội nón lá treo đèn lồng nhỏ) trên **Đêm 1 – Đảo Bến**: thu thập **đom đóm**, nạp ánh sáng để thắp lại **5 Đèn Lồng Lớn**, và **tỏa sáng** xua đuổi **Bóng Mực** trong sương đen.

---

## Cài đặt & Chạy (tối đa 3 lệnh)

Yêu cầu: **Node.js ≥ 18** (chạy giống nhau trên macOS, Linux, Windows).

```bash
npm install
npm run build
npm run dev
```

Mở trình duyệt tại URL Vite hiển thị (mặc định `http://localhost:5173`) để chơi ngay.

### Chạy kiểm thử & chế độ Headless

```bash
npm test
npm run verify
node src/headless.js --seed 42 --night 1 --ticks 600 --out out.jsonl
```

---

## Điều khiển

| Phím / Chuột | Hành động |
|---|---|
| `W` `A` `S` `D` (hoặc `↑` `↓`) | Di chuyển theo góc nhìn camera |
| `Space` | Nhảy |
| `E` hoặc `F` | Nạp đom đóm vào Đèn Lồng Lớn gần nhất (trong `interact_radius = 3m`) |
| `R` | Tỏa sáng xua & đẩy lùi Bóng Mực / Bóng Ma (tốn `2` đom đóm, hồi chiêu `4s`) |
| `←` `→` / `Q` / Kéo chuột trái | Xoay camera 3D quanh Mây |
| `M` | Tắt / bật âm thanh |

---

## Luật chơi & Cách tính điểm (Đêm 1)

Thông số khớp 100% với [game.contract.json](game.contract.json):

- **Mục tiêu thắng:** Thắp sáng cả `5` Đèn Lồng Lớn (mỗi đèn cần `5` đom đóm) trong `240` giây.
- **Điều kiện thua:** Mất hết `3` ngọn lửa (máu) do chạm Bóng Mực, hoặc hết thời gian (`dawn`).
- **Tỏa sáng (Pulse):** Tốn `2` đom đóm, bán kính `7m`, làm choáng Bóng Mực `3s` và đẩy lùi `6m` (hồi chiêu `4s`).
- **Vùng an toàn:** Đèn Lồng Lớn đã thắp tạo vùng an toàn bán kính `6m` mà Bóng Mực không thể tiến vào.
- **Rơi khỏi đảo (`fall_enabled: false`):** Đảo có viền mây giữ nhân vật trong bán kính `34.5m`, không bị phạt rơi.

| Sự kiện | Điểm |
|---|---|
| Nhặt 1 đom đóm (`per_mote`) | `+10` |
| Thắp sáng 1 Đèn Lồng Lớn (`per_lantern`) | `+100` |
| Làm choáng 1 Bóng Mực bằng Pulse (`per_stun`) | `+25` |
| Thưởng khi thắng — mỗi giây còn lại (`per_second_left`) | `+2 × floor(time_left_s)` |
| Thưởng khi thắng — mỗi ngọn lửa còn lại (`per_flame_left`) | `+50 × flames` |

---

## Sáng tạo của tôi

1. **Mây phong cách Ninja & Đèn nón lá phản hồi ánh sáng:** Khi chạy, Mây lao nghiêng người về trước với khăn choàng đỏ-vàng phấp phới, để lại vệt bụi ánh sáng và lộn nhào khi nhảy; chiếc đèn nhỏ treo dưới vành nón lá sáng rực dần tỉ lệ thuận với số đom đóm đang mang.
2. **Tạo hình Bóng Mực dạng Bóng Ma (Spectral Ghosts):** Bóng Mực trong PRD-0 được thể hiện trực quan thành những bóng ma bán trong suốt có mắt phát sáng và đốm linh hồn xoay quanh, run rẩy mờ dần khi tiến gần vùng sáng đèn lồng hoặc trúng Tỏa sáng.
3. **Đèn hoa đăng ước nguyện, mưa đêm & hiệu ứng hậu kỳ Bloom:** Khi thắp sáng một Đèn Lồng Lớn, 5 chiếc đèn hoa đăng bay lên bầu trời sao, ánh sáng đảo ấm dần lên; kết hợp mưa đêm nhẹ và `UnrealBloomPass` của Three.js giúp đèn lồng, đom đóm và nấm đêm tỏa hào quang dịu mắt.
4. **Âm thanh ngũ cung tổng hợp (Procedural Web Audio):** Hiệu ứng chuông ngũ cung khi nhặt đom đóm, hợp âm ấm khi thắp đèn, tiếng sóng ánh sáng khi tỏa sáng — hoàn toàn tổng hợp bằng Web Audio API, không dùng file âm thanh ngoài, có phím `M` tắt tiếng.

**Bằng chứng không phá Test Contract:** Toàn bộ 4 tính năng trên nằm hoàn toàn trong lớp hiển thị (`src/client/main.js`, `src/client/audio.js`), tách biệt tuyệt đối khỏi lõi mô phỏng (`src/sim/`). Kết quả chạy `npm test` (13/13 pass) và `npm run verify` (6/6 pass, gồm kiểm tra tất định 2 lần chạy giống nhau từng byte) xác nhận đầu ra headless hoàn toàn không bị ảnh hưởng.

---

## Hồ sơ SDLC, Harness AI & Bằng chứng

- **Contract:** [game.contract.json](game.contract.json)
- **Harness AI:** [AGENTS.md](AGENTS.md), [.agents/skills/verify-phase/SKILL.md](.agents/skills/verify-phase/SKILL.md), [.github/workflows/ci.yml](.github/workflows/ci.yml)
- **Ghi chép & Giả định Phase 1:** [docs/notes/phase-1.md](docs/notes/phase-1.md)
- **Bằng chứng kiểm chứng Phase 1:** [docs/proof/phase-1.md](docs/proof/phase-1.md)
- **Bản quyền & Nguồn:** [LICENSE](LICENSE), [CREDITS.md](CREDITS.md)
- **Tài liệu đề lab gốc:** [GUIDE.md](GUIDE.md), [CHECKPOINTS.md](CHECKPOINTS.md), [SUBMISSION.md](SUBMISSION.md), [RULES.md](RULES.md), [RUBRIC.md](RUBRIC.md)
