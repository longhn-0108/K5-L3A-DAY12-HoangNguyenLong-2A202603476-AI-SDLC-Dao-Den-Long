import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { GameEngine } from '../src/sim/engine.js';
import { SeededPRNG } from '../src/sim/prng.js';
import { TUNING, distXZ } from '../src/sim/tuning.js';

describe('Contract & Tuning Consistency', () => {
  it('src/sim/tuning.js matches game.contract.json exactly', () => {
    const contractPath = path.resolve('game.contract.json');
    const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
    assert.equal(contract.contract_version, '1.0');
    assert.deepEqual(TUNING, contract.tuning);
  });
});

describe('Movement, Camera Yaw & Jump', () => {
  it('moves along +X/+Z at yaw 0 and rotates properly at yaw 90', () => {
    const eng = new GameEngine({
      seed: 1,
      scenario: { random_motes: false, random_shades: false },
    });
    // 60 ticks = 1 second at move [0, 1], yaw 0 -> z = +player_speed
    for (let i = 0; i < 60; i++) {
      eng.step({ move: [0, 1], cam_yaw_deg: 0 });
    }
    assert.ok(Math.abs(eng.player.pos[0]) < 1e-6);
    assert.ok(Math.abs(eng.player.pos[2] - TUNING.player_speed) < 1e-3);

    // At yaw 90 deg, move [0, 1] -> x' = 1, z' = 0
    const startX = eng.player.pos[0];
    const startZ = eng.player.pos[2];
    for (let i = 0; i < 60; i++) {
      eng.step({ move: [0, 1], cam_yaw_deg: 90 });
    }
    assert.ok(Math.abs(eng.player.pos[0] - (startX + TUNING.player_speed)) < 1e-3);
    assert.ok(Math.abs(eng.player.pos[2] - startZ) < 1e-3);
  });

  it('normalizes diagonal move [1, 1] to unit length', () => {
    const eng = new GameEngine({
      seed: 1,
      scenario: { random_motes: false, random_shades: false },
    });
    for (let i = 0; i < 60; i++) {
      eng.step({ move: [1, 1], cam_yaw_deg: 0 });
    }
    const dist = Math.hypot(eng.player.pos[0], eng.player.pos[2]);
    assert.ok(Math.abs(dist - TUNING.player_speed) < 1e-3);
  });

  it('jumps on rising edge and lands back at y = 0', () => {
    const eng = new GameEngine({
      seed: 1,
      scenario: { random_motes: false, random_shades: false },
    });
    eng.step({ jump: true });
    assert.ok(eng.player.pos[1] > 0);
    let maxY = eng.player.pos[1];
    for (let i = 0; i < 60; i++) {
      eng.step({ jump: true }); // held true must not re-trigger jump on landing
      if (eng.player.pos[1] > maxY) maxY = eng.player.pos[1];
    }
    assert.ok(maxY > 0.8);
    assert.equal(eng.player.pos[1], 0);
  });
});

describe('Motes, Lanterns & Win Condition', () => {
  it('picks motes, deposits on interact rising edge, lights lantern and wins', () => {
    const eng = new GameEngine({
      seed: 2,
      scenario: {
        player: { pos: [0, 0, 0], carried: 4, flames: 3 },
        random_motes: false,
        random_shades: false,
        motes: [[0, 0, 1.5]],
        lanterns: [
          { id: 'L1', pos: [0, 0, 2], deposited: 0, lit: false },
          { id: 'L2', lit: true },
          { id: 'L3', lit: true },
          { id: 'L4', lit: true },
          { id: 'L5', lit: true },
        ],
        time_left_s: 100,
      },
    });
    // Setup must not award score
    assert.equal(eng.score, 0);

    // Tick 1: pick mote at [0,0,1.5] (within pickup_radius 1.8) + interact with L1 at [0,0,2]
    const evs = eng.step({ interact: true });
    const names = evs.map((e) => e.name);
    assert.deepEqual(names, ['mote_picked', 'deposit', 'lantern_lit', 'game_over']);
    assert.equal(eng.state, 'won');
    assert.equal(evs[3].data.reason, 'all_lit');
    // Score: 1 mote (10) + 1 lantern (100) + floor(99.983)*2 (198) + 3*50 (150) = 458
    assert.equal(eng.score, 10 + 100 + 99 * 2 + 3 * 50);
  });
});

describe('Pulse, Shades, Safe Radius & Loss Conditions', () => {
  it('stuns and pushes shade on pulse and enforces cooldown', () => {
    const eng = new GameEngine({
      seed: 3,
      scenario: {
        player: { pos: [0, 0, 0], carried: 5, flames: 3 },
        random_motes: false,
        random_shades: false,
        shades: [{ id: 'S1', pos: [5, 1, 0] }],
      },
    });

    const evs = eng.step({ pulse: true });
    assert.equal(evs.length, 1);
    assert.equal(evs[0].name, 'pulse');
    assert.deepEqual(evs[0].data.stunned_ids, ['S1']);
    assert.equal(eng.player.carried, 5 - TUNING.pulse_cost);
    assert.equal(eng.shades[0].state, 'stunned');
    assert.ok(eng.shades[0].pos[0] >= 5 + TUNING.pulse_push_m - 1e-6);

    // Immediate second pulse fails due to cooldown
    eng.step({ pulse: false });
    const evs2 = eng.step({ pulse: true });
    assert.equal(evs2.filter((e) => e.name === 'pulse').length, 0);
  });

  it('keeps shades outside safe_radius of lit lanterns', () => {
    const eng = new GameEngine({
      seed: 4,
      scenario: {
        player: { pos: [0, 0, 0], carried: 0, flames: 3 },
        random_motes: false,
        random_shades: false,
        lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }],
        shades: [{ id: 'S1', pos: [8, 1, 0] }],
      },
    });

    for (let i = 0; i < 180; i++) {
      eng.step({});
    }
    const d = distXZ(eng.shades[0].pos, eng.lanterns[0].pos);
    assert.ok(d >= TUNING.safe_radius - 1e-6, `Shade entered safe_radius: ${d}`);
    assert.equal(eng.player.flames, 3);
  });

  it('damages player, drops motes, grants invuln, and loses on 0 flames', () => {
    const eng = new GameEngine({
      seed: 5,
      scenario: {
        player: { pos: [0, 0, 0], carried: 5, flames: 1 },
        random_motes: false,
        random_shades: false,
        shades: [{ id: 'S1', pos: [1.0, 1, 0] }],
      },
    });

    const evs = eng.step({});
    assert.equal(evs[0].name, 'player_hit');
    assert.equal(evs[0].data.by, 'shade');
    assert.equal(evs[0].data.flames, 0);
    assert.equal(evs[0].data.dropped, Math.floor(5 * TUNING.hit_drop_ratio));
    assert.equal(evs[1].name, 'game_over');
    assert.equal(evs[1].data.reason, 'no_flames');
    assert.equal(eng.state, 'lost');
  });

  it('loses with reason dawn when time runs out', () => {
    const eng = new GameEngine({
      seed: 6,
      scenario: {
        random_motes: false,
        random_shades: false,
        time_left_s: 0.5,
      },
    });
    let gameOver = null;
    for (let i = 0; i < 60 && eng.state === 'playing'; i++) {
      const evs = eng.step({});
      for (const e of evs) {
        if (e.name === 'game_over') gameOver = e;
      }
    }
    assert.ok(gameOver);
    assert.equal(gameOver.data.result, 'lost');
    assert.equal(gameOver.data.reason, 'dawn');
    assert.equal(eng.tick, 30);
  });

  it('keeps shade stunned for exact pulse_stun_s * 60 ticks and distinguishes seed 0 vs 1', () => {
    const eng = new GameEngine({
      seed: 7,
      scenario: {
        player: { pos: [0, 0, 0], carried: 5, flames: 3 },
        random_motes: false,
        random_shades: false,
        shades: [{ id: 'S1', pos: [4, 1, 0] }],
      },
    });
    eng.step({ pulse: true });
    let stunnedTicks = 0;
    for (let i = 0; i < 200; i++) {
      if (eng.shades[0].state === 'stunned') stunnedTicks += 1;
      eng.step({ pulse: false });
    }
    assert.equal(stunnedTicks, TUNING.pulse_stun_s * 60);

    const p0 = new SeededPRNG(0);
    const p1 = new SeededPRNG(1);
    assert.notEqual(p0.next(), p1.next());
  });
});
