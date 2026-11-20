---
name: verify-phase
description: Run all unit tests, headless Test Contract scenarios, determinism checks, and production build verification for Đảo Đèn Lồng.
---

# Verify Phase Skill

Use this skill before committing or tagging any phase (`phase-1` .. `phase-4`).

## Steps
1. Run unit and contract tests:
   ```bash
   npm test
   ```
2. Run the headless contract and determinism verifier:
   ```bash
   npm run verify
   ```
3. Verify production web bundle builds cleanly:
   ```bash
   npm run build
   ```
4. Confirm all checks exit with code `0`, zero skipped tests without documented reason, and update `docs/proof/phase-N.md` with real command outputs.
