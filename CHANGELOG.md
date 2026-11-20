# Changelog

## [Phase 3] — TICKET-03: "Đèn cạn dầu" (Contract v1.2)

### Breaking Changes
- **Contract version:** `1.1` → `1.2`.
- **Win condition replaced (`all_lit` removed):** Lighting all lanterns no longer ends the Night early. Victory now occurs only at dawn (`time_left_s === 0`) while alive with at least `ceil(0.6 × total_lanterns)` lanterns lit (`reason: "dawn_survived"`).
- **Night durations shortened:** Night 1 `300 → 240s`, Night 2 `330 → 270s`, Night 3 `360 → 300s`.
- **Lantern fuel & relight lifecycle:** Lit lanterns start at `fuel = 100` and decay at `1.0/s` (`1/60` per tick); at `0` they extinguish (`lantern_out`, `deposited = 0`, `ever_lit = true`). Relighting an `ever_lit` lantern costs `5` motes (first light remains `10`). Lit lanterns with `fuel < 100` can now be refueled (`+10` fuel/mote, `refuel` event).
- **Safe zone & Shade `drain` state:** Lit lanterns with `fuel < 30` lose their 6m safe zone; `wander` Shades target them and enter `drain` state (`5 fuel/s`, `fuel_drain` event every 60 ticks).
- **Scoring formula replaced:** `+5` per deposited/refueled mote (was `+10`), `+100` first light, `+40` relight, `+15` pulsing a draining shade (else `+5`), dawn survival bonus `+50 + floor(fuel)` per lit lantern + `+50` per flame remaining; time bonus removed (`per_second_left: 0`).
- **Snapshot & Event schema:** Added `lantern.fuel`, `lantern.ever_lit`, `lantern.relit_count`, `player.capacity`, `lantern_lit.relight`, `refuel`, `lantern_out`, `fuel_drain`, and `dawn_survived`.

### Added
- Dynamic carry capacity (`10 + 2 × successful_lights`, max `20`).
- Colorblind accessibility mode ("Bảng màu dễ phân biệt", persisted in `localStorage`) + non-color lantern distinction (unlit squashed 20% with torn paper; low-fuel 1 Hz blink + 3D fuel bar).

## [Phase 2] — TICKET-02: "Ba hòn đảo" (Contract v1.1)
- Standardized tuning, 3 Nights (Đảo Bến, Đảo Cau, Đảo Chuông), Dash, Fall & Respawn, Gió Lạc (Drifters), Bùa Gió (Charms), Night 3 Wind, Pause/Resume, Settings, full HUD and Web Audio.

## [Phase 1] — PRD-0 (Contract v1.0)
- Initial Night 1 (Đảo Bến), 60Hz deterministic headless engine, Three.js 3D client with Ninja Mây, spectral ghosts, Bloom and procedural Web Audio.
