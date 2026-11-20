import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { GameEngine } from '../src/sim/engine.js';
import { SeededPRNG } from '../src/sim/prng.js';
import { TUNING } from '../src/sim/tuning.js';

describe('Contract v1.2 & Tuning Consistency', () => {
  it('src/sim/tuning.js matches game.contract.json v1.2 exactly', () => {
    const contract = JSON.parse(fs.readFileSync(path.resolve('game.contract.json'), 'utf8'));
    assert.equal(contract.contract_version, '1.2');
    assert.deepEqual(TUNING, contract.tuning);
  });
});

describe('Phase 1-2 Regression (Unchanged Mechanics)', () => {
  it('moves at 6.0 m/s, rotates with cam_yaw_deg, and dashes at 14 m/s holding air altitude', () => {
    const eng = new GameEngine({ seed: 1, night: 1, scenario: { random_motes: false, random_shades: false } });
    for (let i = 0; i < 60; i++) eng.step({ move: [0, 1], cam_yaw_deg: 0 });
    assert.ok(Math.abs(eng.player.pos[2] - 6.0) < 1e-3);

    eng.step({ jump: true });
    eng.step({ jump: false });
    const yAir = eng.player.pos[1];
    assert.ok(yAir > 0);
    const evs = eng.step({ dash: true, move: [0, 1] });
    assert.equal(evs.filter((e) => e.name === 'dash').length, 1);
    for (let i = 0; i < 11; i++) eng.step({ dash: false, move: [0, 1] });
    assert.ok(Math.abs(eng.player.pos[1] - yAir) < 1e-6);
  });

  it('handles fall, drifter steal/drop, wind charm, jump pad, pause/resume, and PRNG seed 0 != 1', () => {
    const eng = new GameEngine({
      seed: 10,
      night: 2,
      scenario: {
        player: { pos: [35, 0, 0], carried: 6, flames: 3 },
        random_motes: false,
        random_shades: false,
        random_drifters: false,
        drifters: [{ id: 'D1', pos: [35.5, 1.5, 0], state: 'chase' }],
      },
    });
    const ev1 = eng.step({});
    assert.ok(ev1.some((e) => e.name === 'charm_picked'));
    assert.ok(ev1.some((e) => e.name === 'drifter_steal' && e.data.amount === 3));
    const ev2 = eng.step({ pulse: true });
    assert.ok(ev2.some((e) => e.name === 'drifter_drop' && e.data.amount === 3));

    const p0 = new SeededPRNG(0);
    const p1 = new SeededPRNG(1);
    assert.notEqual(p0.next(), p1.next());
  });
});

describe('Phase 3 (TICKET-03): Fuel, Refuel, Lantern Out, Relight & Capacity', () => {
  it('decays fuel at 1.0/s, extinguishes at 0 (lantern_out), relights for 5 motes (+40), and grows capacity', () => {
    // Updated from Phase 2: lighting a lantern no longer triggers early all_lit win;
    // instead fuel decays, extinguishes, relights for 5 motes, and increases carry capacity.
    const eng = new GameEngine({
      seed: 20,
      night: 1,
      scenario: {
        player: { pos: [0, 0, 0], carried: 10, flames: 3 },
        random_motes: false,
        random_shades: false,
        lanterns: [{ id: 'L1', pos: [0, 0, 1.5], lit: false, deposited: 0 }],
        time_left_s: 200,
      },
    });
    assert.equal(eng.getCarryCapacity(), 10);

    // Light L1 for first time (cost 10, +5*10 + 100 = 150)
    const evLight = eng.step({ interact: true });
    assert.ok(evLight.some((e) => e.name === 'lantern_lit' && e.data.relight === false));
    assert.equal(eng.score, 150);
    assert.equal(eng.getCarryCapacity(), 12); // 10 + 2*1
    assert.equal(eng.state, 'playing');

    // Let L1 decay for 100 seconds (6000 ticks -> fuel = 0 -> lantern_out)
    let outEv = null;
    for (let i = 0; i < 6005 && !outEv; i++) {
      const evs = eng.step({ interact: false });
      outEv = evs.find((e) => e.name === 'lantern_out');
    }
    assert.ok(outEv);
    assert.equal(outEv.data.lantern_id, 'L1');
    assert.equal(eng.lanterns[0].lit, false);
    assert.equal(eng.lanterns[0].everLit, true);

    // Relight L1 with only 5 motes (+5*5 + 40 = +65 -> total 215), capacity -> 14
    eng.player.carried = 5;
    const evRelight = eng.step({ interact: true });
    assert.ok(evRelight.some((e) => e.name === 'lantern_lit' && e.data.relight === true));
    assert.equal(eng.score, 215);
    assert.equal(eng.lanterns[0].relitCount, 1);
    assert.equal(eng.getCarryCapacity(), 14);
  });

  it('refuels lit lantern with ceil((100 - fuel)/10) motes and ignores full lanterns', () => {
    const eng = new GameEngine({
      seed: 21,
      night: 1,
      scenario: {
        player: { pos: [0, 0, 0], carried: 10, flames: 3 },
        random_motes: false,
        random_shades: false,
        lanterns: [{ id: 'L1', pos: [0, 0, 1.5], lit: true, fuel: 75 }],
      },
    });
    // After 1 tick decay (~74.983), ceil((100 - 74.983)/10) = 3 motes -> fuel = 100
    const evs = eng.step({ interact: true });
    const refuel = evs.find((e) => e.name === 'refuel');
    assert.ok(refuel);
    assert.equal(refuel.data.amount, 3);
    assert.equal(refuel.data.fuel, 100);
    assert.equal(eng.player.carried, 7);
    assert.equal(eng.score, 15); // 3 * 5

    // Full lantern (at 100) must not be selected when interacted at exact full
    eng.lanterns[0].fuelUnits = 6000;
    eng.step({ interact: false });
    eng.lanterns[0].fuelUnits = 6001; // stays 6000 after 1-unit decay
    const evsFull = eng.step({ interact: true });
    assert.equal(evsFull.filter((e) => e.name === 'refuel').length, 0);
  });
});

describe('Phase 3 (TICKET-03): Shade Drain & Dawn Survived Win Rule', () => {
  it('shade drains low-fuel (<30) lantern at 5/s, emits fuel_drain every 60 ticks, and pulse awards +15', () => {
    const eng = new GameEngine({
      seed: 22,
      night: 1,
      scenario: {
        player: { pos: [0, 0, 15], carried: 5, flames: 3 },
        random_motes: false,
        random_shades: false,
        lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 25 }],
        shades: [{ id: 'S1', pos: [1.5, 1, 0], state: 'wander' }],
        time_left_s: 120,
      },
    });
    // Tick 1: S1 is within 2m of low-fuel L1 -> switches to drain
    eng.step({});
    assert.equal(eng.shades[0].state, 'drain');

    // Run 60 ticks -> fuel_drain emitted; fuel lost = 60*(1+5)/60 = 6.0 (plus 1 tick decay before drain)
    let drainEv = null;
    for (let i = 0; i < 60; i++) {
      const evs = eng.step({});
      const f = evs.find((e) => e.name === 'fuel_drain');
      if (f) drainEv = f;
    }
    assert.ok(drainEv);
    assert.equal(drainEv.data.lantern_id, 'L1');
    assert.equal(drainEv.data.shade_id, 'S1');

    // Move Mây within pulse radius (5m) and pulse while S1 is draining -> +15 points!
    eng.player.pos = [1.5, 0, 3.5];
    const scoreBefore = eng.score;
    const evPulse = eng.step({ pulse: true });
    assert.ok(evPulse.some((e) => e.name === 'pulse' && e.data.stunned_ids.includes('S1')));
    assert.equal(eng.score - scoreBefore, 15);
  });

  it('wins at dawn with dawn_survived when >= 3/5 lanterns lit, and awards dawn lantern + flame bonus', () => {
    // Replaces Phase 1/2 all_lit win test: win now requires surviving to dawn with >= ceil(0.6 * total) lit.
    const eng = new GameEngine({
      seed: 23,
      night: 1,
      scenario: {
        player: { pos: [0, 0, 0], carried: 0, flames: 3 },
        random_motes: false,
        random_shades: false,
        lanterns: [
          { id: 'L1', lit: true, fuel: 50 },
          { id: 'L2', lit: true, fuel: 40 },
          { id: 'L3', lit: true, fuel: 30 },
          { id: 'L4', lit: false },
          { id: 'L5', lit: false },
        ],
        time_left_s: 1.0,
      },
    });

    let endEv = null;
    for (let i = 0; i < 65 && eng.state === 'playing'; i++) {
      const evs = eng.step({});
      const g = evs.find((e) => e.name === 'game_over');
      if (g) endEv = g;
    }
    assert.ok(endEv);
    assert.equal(endEv.data.result, 'won');
    assert.equal(endEv.data.reason, 'dawn_survived');
    // After 1s decay: fuels are 49, 39, 29 -> (50+49)+(50+39)+(50+29) + 3*50 = 267 + 150 = 417
    assert.equal(eng.score, 417);
  });
});
