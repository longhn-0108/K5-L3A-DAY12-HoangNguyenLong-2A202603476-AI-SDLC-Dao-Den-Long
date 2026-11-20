# Changelog

## [v1.0.0 — Phase 4] — TICKET-04: "Bình minh: phát hành v1.0.0" (Contract v1.3)

### Added
- **Benchmark mode (`bench_cmd`):** `node src/bench.js --seed 42 --duration 30 --out bench.json` — launches 1280×720 Chromium/Edge with `--disable-frame-rate-limit --disable-gpu-vsync`, runs standardized Night 1 (200 wandering Shades + 100 Motes via `InstancedMesh`, 3 lit lanterns, 3s warmup + 30s measure, orbiting camera), and outputs `bench.json` (measured `349.0 avg FPS`, `155.2 p1_low FPS`, `load_ms = 2710ms`).
- **Soak test (`soak_cmd`):** `node --max-semi-space-size=2 --expose-gc src/soak.js --seed 7 --nights 10 --out soak.json` — runs 10 consecutive Nights in one process (`0 crashes`, `mem_start_mb = 62.4`, `mem_end_mb = 65.8`, `0.45s`).
- **Local Leaderboard & CLI export:** Top 10 local disk persistence (`~/.dao-den-long-leaderboard.json`), name validation (3–12 chars, ASCII + Vietnamese), tie-break by earliest `achieved_at`, UI modal + post-run save form, and `node src/run.js --export-leaderboard out.json`.
- **Accessibility:** Full 9-action key rebinding with conflict detection & Reset Defaults, live visual subtitles (shade spawn + edge directional arrow, wind warning, 10s countdown, low-fuel lantern), Reduce Motion toggle, ≥18px base UI font size + `×1.25` Large Text mode.
- **Release packaging & Retro:** `src/run.js` production launcher, `bench.json`, `soak.json`, `docs/notes/retro.md`, `docs/proof/phase-4.md`, and GitHub Release `v1.0.0`.

## [Phase 3] — TICKET-03: "Đèn cạn dầu" (Contract v1.2)

### Breaking Changes
- **Contract version:** `1.1` → `1.2`.
- **Win condition replaced (`all_lit` removed):** Victory requires surviving until dawn with `≥ ceil(0.6 × total_lanterns)` lit (`reason: "dawn_survived"`).
- **Night durations shortened:** Night 1 `240s`, Night 2 `270s`, Night 3 `300s`.
- **Lantern fuel & relight lifecycle:** `100` max fuel (`1/60` integer units), `1.0/s` decay, `lantern_out` at `0`, relight costs `5` motes (`+40`), refuel adds `+10` fuel/mote (`refuel`).
- **Shade `drain` state:** Lanterns with `fuel < 30` lose safe zone; `wander` Shades drain `5/s` (`fuel_drain` every 60 ticks); pulsing a draining shade awards `+15`.
- **Scoring replaced:** `+5` per deposited/refueled mote, `+100` first light, `+40` relight, `+15` pulsing draining shade (else `+5`), dawn bonus `50 + floor(fuel)` per lit lantern + `50` per flame.
- **Added:** Dynamic carry capacity (`10 + 2 × successful_lights`, max `20`), Colorblind mode, 3D fuel bars, 1 Hz low-fuel blink, squashed/torn unlit lanterns.

## [Phase 2] — TICKET-02: "Ba hòn đảo" (Contract v1.1)
- Standardized tuning, 3 Nights (Đảo Bến, Đảo Cau, Đảo Chuông), Dash, Fall & Respawn, Gió Lạc (Drifters), Bùa Gió (Charms), Night 3 Wind, Pause/Resume, Settings, full HUD and Web Audio.

## [Phase 1] — PRD-0 (Contract v1.0)
- Initial Night 1 (Đảo Bến), 60Hz deterministic headless engine, Three.js 3D client with Ninja Mây, spectral ghosts, Bloom and procedural Web Audio.
