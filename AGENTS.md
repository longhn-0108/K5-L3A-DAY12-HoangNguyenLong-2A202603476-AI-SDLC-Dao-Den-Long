# AGENTS.md — Đảo Đèn Lồng (Phase 3 · Contract v1.2)

## Commands
- Install & build: `npm install && npm run build`
- Run 3D game: `npm run dev`
- Run unit + contract tests: `npm test`
- Run full Contract v1.2 & determinism verification: `npm run verify`
- Run headless CLI: `node src/headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl` (`--night 1|2|3`)

## Architecture Rules
1. **Strict Sim/View Separation**: `src/sim/` MUST have zero DOM, WebGL, or Three.js dependencies so headless mode runs purely in Node.js at 60 ticks/sec.
2. **Contract Single Source of Truth**: `src/sim/tuning.js` MUST match `game.contract.json` (`contract_version: "1.2"`). `npm test` enforces exact equality.
3. **Integer Fuel Math**: Always compute lantern fuel in integer `1/60` units (`0..6000`) inside `src/sim/engine.js` to avoid floating-point drift at `0.0`, `30.0`, and `100.0`.
4. **Creative Features Isolation**: Visual/audio features (Ninja Mây, spectral ghosts, sky lanterns, rain, Bloom, Web Audio, colorblind mode) MUST stay strictly in `src/client/`.

## Test Contract v1.2 Invariants
- 60 ticks/sec fixed (`DT = 1/60`). Snapshot tick 0 is post-scenario, pre-input.
- Step 2 decrements timers + lantern fuel (`1/60` decay + `5/60` per draining shade); immediately extinguishes lanterns with `fuel <= 0` (`lantern_out`).
- Safe zone (`6m`) applies ONLY when `l.lit && fuel >= 30.0`. Refueling from `<30` to `>=30` pushes shades out over `≤ 30` ticks.
- Shade states: `spawning`, `wander`, `chase`, `recoil`, `stunned`, `drain`.
- No early win on `all_lit`. Win at dawn (`dawn_survived`) if alive and `lit >= ceil(0.6 * total)`. `no_flames` always takes priority.
- Dynamic carry capacity: `min(20, 10 + 2 * successful_lights)`.
- Scoring: `+5` per deposited/refueled mote, `+100` first light, `+40` relight, `+15` pulsing draining shade (else `+5`), dawn bonus `50 + floor(fuel)` per lit lantern + `50 * flames`.

## Verification Rule
- Never claim a task is done without running `npm test`, `npm run verify`, and `npm run build` and checking real output.
