# Ghi chép Phase 3 — TICKET-03 ("Đèn cạn dầu", Contract v1.2)

## 1. Quản lý thay đổi & Cập nhật Test cũ
- **Quyết định thiết kế:** Xem [docs/adr/001-fuel-and-dawn-win.md](../adr/001-fuel-and-dawn-win.md) và [CHANGELOG.md](../../CHANGELOG.md).
- **Test cũ bị ảnh hưởng (cập nhật có lý do, không skip âm thầm):**
  - Test `all_lit` trong `tests/sim.test.js` và `tests/headless.test.js` bị luật mới thay thế → cập nhật sang kiểm tra `dawn_survived` (thắng tại bình minh với `≥ 3/5` đèn sáng) và xác nhận thắp đèn không kết thúc sớm.
  - Test tính điểm (`+10/mote`, time bonus) → cập nhật sang công thức mới (`+5/mote`, `+100` thắp lần đầu, `+40` thắp lại, `+15` pulse bóng đang `drain`, thưởng bình minh `50 + floor(fuel)` + `50 * flames`).
- **Giữ nguyên sáng tạo các phase trước:** Ninja Mây, tạo hình Bóng Ma, cảnh quan 3 đảo (cây thông/hoa anh đào/cây cau, thuyền bến, chuông đồng, nấm phát sáng, biển mây, mưa đêm), Bloom và Web Audio vẫn giữ nguyên và bổ sung thanh dầu 3D, nhấp nháy 1 Hz, đèn tắt xẹp 20% + vết rách, chế độ mù màu.

## 2. Nhật ký AI, Token & Đánh giá Phase 3
- **Ước tính token Phase 3:** ~35k–45k tokens (nâng cấp `engine.js` fuel integer + `drain` + `dawn_survived` + capacity động, nâng cấp client 3D + colorblind mode, ADR + Changelog + tests).
- **Lỗi phát hiện sớm khi viết kịch bản verify:** Kịch bản kiểm chứng `Shade drain` ban đầu đặt Mây cách Bóng Mực `8m` (`≤ 12m`) khiến Bóng Mực chuyển `chase` thay vì `drain` → chỉnh kịch bản đặt Mây ở `z = 14m` rồi lướt vào trong tầm `5m` để kiểm chứng chuẩn cả `fuel_drain` lẫn `+15` điểm pulse.
