# AGENTS.md — Đảo Đèn Lồng (Phase 2 · Contract v1.1)

## Commands
- Install & build: `npm install && npm run build`
- Run 3D game: `npm run dev`
- Run unit + contract tests: `npm test`
- Run full Contract v1.1 & determinism verification: `npm run verify`
- Run headless CLI: `node src/headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl` (`--night 1|2|3`)

## Architecture Rules
1. **Strict Sim/View Separation**: `src/sim/` (`engine.js`, `maps.js`, `tuning.js`, `prng.js`, `inputs.js`, `scenario.js`) MUST have zero DOM, WebGL, or Three.js dependencies so headless mode runs purely in Node.js at 60 ticks/sec.
2. **Contract Single Source of Truth**: All standardized constants in `src/sim/tuning.js` MUST match `game.contract.json` (`contract_version: "1.1"`). `npm test` enforces exact equality.
3. **Determinism**: Never use `Math.random()` or `Date.now()` inside `src/sim/`. Always use `SeededPRNG` (`src/sim/prng.js`, with `seed === 0` mapped distinctly from `seed === 1`).
4. **Creative Features Isolation**: Visual/audio enhancements (Ninja Mây, spectral ghost shader, sky lanterns, Bloom, Web Audio) MUST live strictly in `src/client/` and never alter `src/sim/` state or headless JSONL output.

## Test Contract v1.1 Invariants
- 60 ticks/sec fixed (`DT = 1/60`). Snapshot tick 0 is post-scenario, pre-input.
- Mandatory 12-step tick order: (1) Input & pause → (2) Decrement timers → (3) Move Mây (jump, dash, jump pads, wind) + fall check → (4) Pick motes & charms → (5) Interact lanterns → (6) Safe zones → (7) Pulse → (8) Move Shades & Drifters → (9) Collisions (Drifters steal first, then Shades hit by ascending `id`) → (10) Scheduled spawns → (11) Win/Loss (`no_flames` → `all_lit` → `dawn`) → (12) Snapshot.
- When `paused`: `tick` increments, but `sim_tick` and all timers/spawns/TTL stay frozen; snapshot `state: "paused"`.
- Shade states MUST be strictly one of: `spawning`, `wander`, `chase`, `recoil`, `stunned`.
- Scoring: `+10` per deposited mote, `+100` per lit lantern, `+5` per stunned shade (even re-stun), win bonus `floor(time_left_s)*2 + flames*50`.
- Invalid `inputs` or `scenario` files MUST exit with code `2` and print to `stderr`.
- Full 21,600-tick headless Night MUST complete in `≤ 30s`.
- Timers set during a tick MUST NOT be decremented in the same tick they are assigned.

## Verification Rule
- Never claim a task is done without running `npm test`, `npm run verify`, and `npm run build` and checking real output.
