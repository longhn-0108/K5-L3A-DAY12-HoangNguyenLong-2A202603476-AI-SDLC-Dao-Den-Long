---
name: verify-phase
description: Run all unit tests, Phase 1 regression checks, Contract v1.1 headless scenarios (Nights 1-3, Dash, Drifters, Charms, Jump Pads, Wind, Pause, 21,600-tick speed), determinism checks, and production build verification.
---

# Verify Phase Skill (v1.1)

Use this skill before committing or tagging any phase (`phase-2` .. `phase-4`).

## Steps
1. Run unit and Contract v1.1 CLI tests (includes Phase 1 regression with standardized numbers):
   ```bash
   npm test
   ```
2. Run the headless Contract v1.1 verifier (Nights 1–3 determinism, Dash, Pause/Resume, Jump Pad A→B, Wind Charm, Drifter steal/drop, Fall & Respawn, and full 21,600-tick Night 3 speed ≤ 30s):
   ```bash
   npm run verify
   ```
3. Verify production web bundle builds cleanly:
   ```bash
   npm run build
   ```
4. Confirm all checks exit with code `0`, zero skipped tests without documented reason, and update `docs/proof/phase-N.md` with real command outputs.
