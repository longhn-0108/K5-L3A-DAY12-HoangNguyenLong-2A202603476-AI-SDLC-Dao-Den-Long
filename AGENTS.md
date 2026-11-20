# AGENTS.md — Đảo Đèn Lồng

## Commands
- Install & build: `npm install && npm run build`
- Run 3D game: `npm run dev`
- Run unit + contract tests: `npm test`
- Run full contract & determinism verification: `npm run verify`
- Run headless CLI: `node src/headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl`

## Architecture Rules
1. **Strict Sim/View Separation**: `src/sim/` MUST have zero DOM, WebGL, or Three.js dependencies so headless mode runs purely in Node.js at 60 ticks/sec.
2. **Contract Single Source of Truth**: All gameplay constants in `src/sim/tuning.js` MUST match `game.contract.json`. `npm test` enforces exact equality.
3. **Determinism**: Never use `Math.random()` or `Date.now()` inside `src/sim/`. Always use the seeded PRNG (`src/sim/prng.js`).
4. **Creative Features Isolation**: Any extra visual/audio features (sky lanterns, procedural audio, particle trails) MUST live strictly in `src/client/` and never alter `src/sim/` state or headless JSONL output.

## Test Contract v1.0 Invariants
- 60 ticks/sec fixed (`DT = 1/60`). Snapshot tick 0 is post-scenario, pre-input.
- Step `k` reads input at tick `k` and produces state `k+1`; events record `tick = k + 1`.
- Distances for all tuning radii use horizontal XZ plane (`<= r`).
- Invalid `inputs` or `scenario` files MUST exit with code `2` and print an error to `stderr`.
- Scenario setup MUST NOT emit events or award score.
- Coordinates and `time_left_s` in JSONL are rounded to 3 decimal places.
- Timers set during a tick (e.g., `stunTimer`, `invulnTimer`, `pulseCooldown`) MUST NOT be decremented in the same tick they are assigned; lock every duration parameter with an exact-tick unit test.

## Verification Rule
- Never claim a task is done without running `npm test && npm run verify && npm run build` and checking real output.
