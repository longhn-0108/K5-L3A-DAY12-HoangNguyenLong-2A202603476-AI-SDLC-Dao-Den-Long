# ADR-001: Lantern Fuel State Machine & Dawn Survival Win Condition

- **Status:** Accepted (Phase 3 · TICKET-03 · Contract v1.2)
- **Date:** 2026-11-20

## Context
In Phase 1–2, once a lantern was lit it stayed lit permanently, and lighting all lanterns ended the Night immediately (`all_lit`). TICKET-03 replaces both rules to sustain tension until dawn: lanterns consume fuel continuously, Shades can drain low-fuel lanterns (`fuel < 30`), and victory requires surviving until dawn with at least `60%` of lanterns lit.

## Decision
1. **Integer Fixed-Point Fuel (`fuelUnits` in `1/60` units):**
   - Store `fuelUnits` as an integer (`0..6000`, where `6000 = 100.0` fuel).
   - Decay subtracts `1` unit/tick; each draining Shade subtracts `5` units/tick.
   - Refueling computes `needed = Math.ceil((6000 - fuelUnits) / 600)` with zero floating-point drift. Rounding (`round1(fuelUnits / 60)`) occurs strictly on snapshot/event serialization.
2. **Lantern Lifecycle State:**
   - Track `{ lit, deposited, fuelUnits, everLit, relitCount }`.
   - Safe zone predicate is centralized in `_hasSafeZone(l) = l.lit && l.fuelUnits >= 1800` (`>= 30.0`), used consistently across Shade movement, spawning, and safe-zone push-out on both lighting and refueling across the `30.0` boundary.
3. **Tick-Order Placement & Win Priority:**
   - Fuel decay and Shade drain run in Step 2, immediately followed by extinguishing lanterns with `fuelUnits <= 0` (`lantern_out`).
   - Step 11 removes early `all_lit` termination. `no_flames` is evaluated first (even on the dawn tick), followed by `dawn_survived` if `litCount >= ceil(0.6 * total)` at `time_left_s === 0`, otherwise `dawn`.

## Consequences
- 100% deterministic fuel arithmetic across platforms with zero floating-point boundary bugs at `30.0` or `0.0`.
- Existing Phase 1–2 tests asserting `all_lit` or `+10/mote` score are updated with explicit migration notes; all unchanged Phase 1–2 regression tests remain green.
