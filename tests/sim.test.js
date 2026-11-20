import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { GameEngine } from '../src/sim/engine.js';
import { SeededPRNG } from '../src/sim/prng.js';
import { TUNING, distXZ } from '../src/sim/tuning.js';

describe('Contract v1.1 & Tuning Consistency', () => {
  it('src/sim/tuning.js matches game.contract.json v1.1 exactly', () => {
    const contract = JSON.parse(fs.readFileSync(path.resolve('game.contract.json'), 'utf8'));
    assert.equal(contract.contract_version, '1.1');
    assert.deepEqual(TUNING, contract.tuning);
  });
});

describe('Movement, Jump & Dash (Standardized v1.1)', () => {
  it('moves at 6.0 m/s along yaw 0 and yaw 90 and normalizes diagonals', () => {
    const eng = new GameEngine({ seed: 1, night: 1, scenario: { random_motes: false, random_shades: false } });
    for (let i = 0; i < 60; i++) eng.step({ move: [0, 1], cam_yaw_deg: 0 });
    assert.ok(Math.abs(eng.player.pos[2] - 6.0) < 1e-3);

    const sx = eng.player.pos[0];
    for (let i = 0; i < 60; i++) eng.step({ move: [0, 1], cam_yaw_deg: 90 });
    assert.ok(Math.abs(eng.player.pos[0] - (sx + 6.0)) < 1e-3);

    const eng2 = new GameEngine({ seed: 1, night: 1, scenario: { random_motes: false, random_shades: false } });
    for (let i = 0; i < 60; i++) eng2.step({ move: [1, 1], cam_yaw_deg: 0 });
    assert.ok(Math.abs(Math.hypot(eng2.player.pos[0], eng2.player.pos[2]) - 6.0) < 1e-3);
  });

  it('dashes at 14 m/s for 12 ticks with 90-tick cooldown and holds altitude in air', () => {
    const eng = new GameEngine({ seed: 1, night: 1, scenario: { random_motes: false, random_shades: false } });
    eng.step({ jump: true });
    eng.step({ jump: false });
    const yBeforeDash = eng.player.pos[1];
    assert.ok(yBeforeDash > 0);

    const evs = eng.step({ dash: true, move: [0, 1] });
    assert.equal(evs.filter((e) => e.name === 'dash').length, 1);
    for (let i = 0; i < 11; i++) eng.step({ dash: false, move: [0, 1] });
    assert.ok(Math.abs(eng.player.pos[1] - yBeforeDash) < 1e-6);
    assert.ok(eng.player.pos[2] > 2.5);

    // Cooldown prevents immediate second dash
    const evs2 = eng.step({ dash: true });
    assert.equal(evs2.filter((e) => e.name === 'dash').length, 0);
  });
});

describe('Motes, Lanterns & Standardized Scoring', () => {
  it('picks motes (<=1m), deposits (<=2m, cost 10), awards +10/deposited +100/lantern + win bonus', () => {
    const eng = new GameEngine({
      seed: 2,
      night: 1,
      scenario: {
        player: { pos: [0, 0, 0], carried: 9, flames: 3 },
        random_motes: false,
        random_shades: false,
        motes: [[0, 0, 0.8]],
        lanterns: [
          { id: 'L1', pos: [0, 0, 1.5], deposited: 0, lit: false },
          { id: 'L2', lit: true },
          { id: 'L3', lit: true },
          { id: 'L4', lit: true },
          { id: 'L5', lit: true },
        ],
        time_left_s: 100,
      },
    });
    assert.equal(eng.score, 0);

    const evs = eng.step({ interact: true });
    assert.deepEqual(evs.map((e) => e.name), ['mote_picked', 'deposit', 'lantern_lit', 'game_over']);
    assert.equal(eng.state, 'won');
    // 10 deposited * 10 (100) + 1 lantern (100) + floor(99.983)*2 (198) + 3*50 (150) = 548
    assert.equal(eng.score, 548);
  });
});

describe('Pulse, Shades, Safe Zone, Recoil & Loss', () => {
  it('stuns shade for 120 ticks, pushes 4m over 15 ticks, awards +5 even on re-pulse', () => {
    const eng = new GameEngine({
      seed: 3,
      night: 1,
      scenario: {
        player: { pos: [0, 0, 0], carried: 6, flames: 3 },
        random_motes: false,
        random_shades: false,
        shades: [{ id: 'S1', pos: [3, 1, 0], state: 'chase' }],
      },
    });

    const evs = eng.step({ pulse: true });
    assert.equal(evs[0].name, 'pulse');
    assert.deepEqual(evs[0].data.stunned_ids, ['S1']);
    assert.equal(eng.score, 5);
    assert.equal(eng.player.carried, 3);

    for (let i = 0; i < 15; i++) eng.step({ pulse: false });
    assert.ok(Math.abs(eng.shades[0].pos[0] - 7.0) < 0.05);

    // Count remaining stunned ticks
    let stunned = 0;
    for (let i = 0; i < 120; i++) {
      if (eng.shades[0].state === 'stunned') stunned++;
      eng.step({ pulse: false });
    }
    assert.equal(stunned, 105); // 15 + 105 = 120 ticks total
  });

  it('drops floor(carried/2) motes on shade hit, shade recoils, and loses on 0 flames', () => {
    const eng = new GameEngine({
      seed: 5,
      night: 1,
      scenario: {
        player: { pos: [0, 0, 0], carried: 5, flames: 2 },
        random_motes: false,
        random_shades: false,
        shades: [{ id: 'S1', pos: [0.8, 1, 0], state: 'chase' }],
      },
    });
    const evs = eng.step({});
    assert.equal(evs[0].name, 'player_hit');
    assert.equal(evs[0].data.dropped, 2);
    assert.equal(eng.player.carried, 3);
    assert.equal(eng.motes.length, 2);
    assert.equal(eng.motes[0].kind, 'dropped');
    assert.equal(eng.shades[0].state, 'recoil');
    assert.equal(eng.player.invulnTicks, 90);
  });

  it('handles fall below Y < -10 with lost motes and 60-tick respawn', () => {
    const eng = new GameEngine({
      seed: 6,
      night: 1,
      scenario: {
        player: { pos: [41, -9.8, 0], carried: 4, flames: 2 },
        random_motes: false,
        random_shades: false,
      },
    });
    let hitEv = null;
    for (let i = 0; i < 10 && !hitEv; i++) {
      const evs = eng.step({});
      hitEv = evs.find((e) => e.name === 'player_hit');
    }
    assert.ok(hitEv);
    assert.equal(hitEv.data.by, 'fall');
    assert.equal(hitEv.data.lost, 4);
    assert.equal(eng.player.carried, 0);
    assert.equal(eng.player.flames, 1);

    for (let i = 0; i < 60; i++) eng.step({});
    assert.deepEqual(eng.player.pos, [0, 0, 0]);
    assert.ok(eng.player.invulnTicks > 0);
  });
});

describe('Phase 2 Features: Drifters, Charms, Jump Pads, Pause & PRNG', () => {
  it('drifter steals up to 3 motes and drops them when pulsed while fleeing', () => {
    const eng = new GameEngine({
      seed: 10,
      night: 2,
      scenario: {
        player: { pos: [0, 0, 0], carried: 6, flames: 3 },
        random_motes: false,
        random_shades: false,
        random_drifters: false,
        drifters: [{ id: 'D1', pos: [0.5, 1.5, 0], state: 'chase' }],
      },
    });
    const ev1 = eng.step({});
    const steal = ev1.find((e) => e.name === 'drifter_steal');
    assert.ok(steal);
    assert.equal(steal.data.amount, 3);
    assert.equal(eng.player.carried, 3);
    assert.equal(eng.drifters[0].state, 'flee');

    const ev2 = eng.step({ pulse: true });
    const drop = ev2.find((e) => e.name === 'drifter_drop');
    assert.ok(drop);
    assert.equal(drop.data.amount, 3);
    assert.equal(eng.motes.length, 3);
  });

  it('wind charm boosts speed to 7.2 m/s and removes dash cooldown', () => {
    const eng = new GameEngine({
      seed: 11,
      night: 2,
      scenario: {
        player: { pos: [35, 0, 0], carried: 0, flames: 3 },
        random_motes: false,
        random_shades: false,
        random_drifters: false,
      },
    });
    const ev1 = eng.step({});
    assert.ok(ev1.some((e) => e.name === 'charm_picked' && e.data.charm_id === 'C1'));
    assert.equal(eng.player.charmTicks, 600);

    // Dash twice back-to-back after 12 ticks (0 cooldown!)
    const d1 = eng.step({ dash: true, move: [1, 0] });
    assert.ok(d1.some((e) => e.name === 'dash'));
    for (let i = 0; i < 12; i++) eng.step({ dash: false });
    const d2 = eng.step({ dash: true, move: [1, 0] });
    assert.ok(d2.some((e) => e.name === 'dash'));
  });

  it('night 2 jump pad launches player from Island A to Island B', () => {
    const eng = new GameEngine({
      seed: 12,
      night: 2,
      scenario: {
        player: { pos: [20, 0, 18], carried: 0, flames: 3 },
        random_motes: false,
        random_shades: false,
        random_drifters: false,
      },
    });
    for (let i = 0; i < 95; i++) eng.step({});
    assert.ok(eng.player.grounded);
    assert.ok(Math.hypot(eng.player.pos[0] - 70, eng.player.pos[2]) <= 28);
  });

  it('pause freezes sim_tick and timers while tick continues', () => {
    const eng = new GameEngine({ seed: 13, night: 1, scenario: { random_motes: false, random_shades: false } });
    eng.step({});
    assert.equal(eng.tick, 1);
    assert.equal(eng.simTick, 1);

    const pEv = eng.step({ pause: true });
    assert.equal(pEv[0].name, 'paused');
    assert.equal(eng.state, 'paused');
    for (let i = 0; i < 10; i++) eng.step({ pause: false });
    assert.equal(eng.tick, 12);
    assert.equal(eng.simTick, 1);

    const rEv = eng.step({ pause: true });
    assert.equal(rEv[0].name, 'resumed');
    assert.equal(eng.state, 'playing');
    assert.equal(eng.simTick, 2);

    const p0 = new SeededPRNG(0);
    const p1 = new SeededPRNG(1);
    assert.notEqual(p0.next(), p1.next());
  });
});
