# AGENTS.md — Đảo Đèn Lồng (v1.0.0 · Contract v1.3)

## Commands
- Install & build: `npm install && npm run build`
- Run packaged 3D game: `node src/run.js` (or dev server: `npm run dev`)
- Export leaderboard: `node src/run.js --export-leaderboard out.json`
- Run unit + contract + Phase 4 tests: `npm test`
- Run headless Contract v1.2/v1.3 verifier: `npm run verify`
- Run 30s 1280×720 benchmark: `node src/bench.js --seed 42 --duration 30 --out bench.json`
- Run 10-night soak test: `node --max-semi-space-size=2 --expose-gc src/soak.js --seed 7 --nights 10 --out soak.json`
- Run headless CLI: `node src/headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl`

## Architecture Rules
1. **Strict Sim/View Separation**: `src/sim/` MUST have zero DOM, WebGL, or Three.js dependencies.
2. **Contract Single Source of Truth**: `src/sim/tuning.js` MUST match `game.contract.json` (`contract_version: "1.3"`). `npm test` enforces exact equality.
3. **Integer Fuel Math**: Compute lantern fuel in integer `1/60` units (`0..6000`) inside `src/sim/engine.js`.
4. **Creative & Benchmark Isolation**: Visual/audio features stay strictly in `src/client/`. In `?bench=1` mode and `soak.js`, creative extras are disabled so benchmark/soak measure the standardized scene only.

## Verification Rule
- Never claim a task is done without running `npm test`, `npm run verify`, and `npm run build` and checking real output.
